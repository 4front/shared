var formatStack = require('../lib/format-stack');
var assert = require('assert');

describe('formatStack', function() {
  it('strips core lines', function() {
    var originalStack = [
      'at Object.<anonymous> (/Users/xakg/src/4front/aws-platform/node_modules/4front-logger/index.js:7:27)',
      'at Module._compile (module.js:435:26)',
      'at Object.Module._extensions..js (module.js:442:10)'
    ].join('\n');

    var formatted = formatStack(originalStack).split('\n');

    assert.equal(formatted.length, 1);
  });

  it('strips node_modules', function() {
    var originalStack = [
      'at /var/app/current/node_modules/4front-shared/lib/middleware/debug.js:22:16',
      '    at Layer.handle [as handle_request] (/var/app/current/node_modules/express/lib/router/layer.js:95:5)',
      '    at next (/var/app/current/node_modules/express/lib/router/route.js:131:13)'
    ].join('\n');

    var formatted = formatStack(originalStack).split('\n');

    assert.equal(formatted.length, 1);
    assert.ok(/debug\.js/.test(formatted[0]));
  });

  it('strips nested node_modules beneath whitelisted module', function() {
    var originalStack = [
      'at /var/app/current/node_modules/4front-shared/node_modules/aws-sdk/debug.js:22:16',
      '    at Layer.handle [as handle_request] (/var/app/current/node_modules/express/lib/router/layer.js:95:5)',
      '    at next (/var/app/current/node_modules/express/lib/router/route.js:131:13)'
    ].join('\n');

    var formatted = formatStack(originalStack);
    assert.equal(0, formatted.length);
  });
});
