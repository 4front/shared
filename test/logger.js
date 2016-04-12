var assert = require('assert');
var winston = require('winston');
var logger = require('../lib/logger');

require('dash-assert');
require('simple-errors');

describe('logger', function() {
  var logTransport;

  beforeEach(function() {
    logTransport = new (winston.transports.Memory)({
      json: true,
      timestamp: true
    });

    this.log = logger({
      transports: [logTransport],
      baseDir: '/var/app/current'
    });
  });

  it('logs info', function() {
    this.log.info('informational message');
    assert.equal(JSON.parse(logTransport.writeOutput[0]).message, 'informational message');
  });

  it('logs warn', function() {
    this.log.warn('warning message', {custom: 'foo'});
    var logEntry = JSON.parse(logTransport.writeOutput[0]);
    assert.isMatch(logEntry, {
      message: 'warning message',
      custom: 'foo'
    });
  });

  it('logs Error object', function() {
    var error = Error.create('message', {status: 500, appId: 1});
    this.log.error(error);
    var logEntry = JSON.parse(logTransport.errorOutput[0]);
    assert.isMatch(logEntry, {
      message: 'message',
      status: 500,
      appId: 1
    });
  });

  it('logs Error json object', function() {
    var errorJson = Error.toJson(Error.create('message', {status: 500, appId: 1}));

    this.log.error(errorJson);
    var logEntry = JSON.parse(logTransport.errorOutput[0]);
    assert.isMatch(logEntry, {
      message: 'message',
      status: 500,
      appId: 1
    });
  });

  it('supports log message interpolation', function() {
    var bob = 'bob';
    this.log.info('hi %s', bob);
    var logEntry = JSON.parse(logTransport.writeOutput[0]);
    assert.equal(logEntry.message, 'hi bob');
  });

  describe('stack format', function() {
    it('strips core lines', function() {
      var originalStack = [
        'at Object.<anonymous> (/var/app/current/aws-platform/node_modules/4front-logger/index.js:7:27)',
        'at Module._compile (module.js:435:26)',
        'at Object.Module._extensions..js (module.js:442:10)'
      ].join('\n');

      this.log.error(Error.create('test error', {stack: originalStack}));
      var logEntry = JSON.parse(logTransport.errorOutput[0]);
      assert.equal('test error', logEntry.message);
      assert.equal(logEntry.stack.length, 1);
      assert.ok(logEntry.stack[0].indexOf('(/aws-platform/node_modules/4front-logger/index.js') !== -1);
    });

    it('strips node_modules', function() {
      var originalStack = [
        'at /var/app/current/node_modules/4front-shared/lib/middleware/debug.js:22:16',
        '    at Layer.handle [as handle_request] (/var/app/current/node_modules/express/lib/router/layer.js:95:5)',
        '    at next (/var/app/current/node_modules/express/lib/router/route.js:131:13)'
      ].join('\n');

      this.log.error(Error.create('test error', {stack: originalStack}));
      var logEntry = JSON.parse(logTransport.errorOutput[0]);

      assert.equal(logEntry.stack.length, 1);
      assert.ok(/debug\.js/.test(logEntry.stack[0]));
    });

    it('strips nested node_modules beneath whitelisted module', function() {
      var originalStack = [
        'at /var/app/current/node_modules/4front-shared/node_modules/aws-sdk/debug.js:22:16',
        '    at Layer.handle [as handle_request] (/var/app/current/node_modules/express/lib/router/layer.js:95:5)',
        '    at next (/var/app/current/node_modules/express/lib/router/route.js:131:13)'
      ].join('\n');

      this.log.error(Error.create('test error', {stack: originalStack}));
      var logEntry = JSON.parse(logTransport.errorOutput[0]);
      assert.equal(0, logEntry.stack.length);
    });

    it('strips dashed lines', function() {
      var originalStack = [
        '----------------------------------------'
      ].join('\n');

      this.log.error(Error.create('test error', {stack: originalStack}));
      var logEntry = JSON.parse(logTransport.errorOutput[0]);
      assert.equal(0, logEntry.stack.length);
    });
  });
});
