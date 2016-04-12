// import assert from 'assert';
var express = require('express');
var sinon = require('sinon');
var supertest = require('supertest');
var assert = require('assert');
var shortid = require('shortid');
var requestLogger = require('../lib/middleware/request-logger');

require('simple-errors');
require('dash-assert');

describe('requestLogger middleware', function() {
  var app;
  var statusCode;
  var extendedRequest;

  beforeEach(function() {
    app = express();

    app.settings.logger = {
      info: sinon.spy(function() {})
    };

    extendedRequest = {
      virtualApp: {appId: shortid.generate()},
      virtualAppVersion: {versionId: shortid.generate()}
    };

    app.use(function(req, res, next) {
      req.ext = extendedRequest;
      next();
    });

    app.use(requestLogger(app.settings));

    statusCode = 200;
    app.use(function(req, res, next) {
      res.status(statusCode).json({});
    });
  });

  it('logs request', function(done) {
    supertest(app).get('/foo?key=5')
      .expect(200)
      .expect(function(res) {
        assert.isTrue(app.settings.logger.info.calledWith('request for /foo', sinon.match({
          statusCode: 200,
          appId: extendedRequest.virtualApp.appId,
          versionId: extendedRequest.virtualAppVersion.versionId,
          url: 'http://127.0.0.1/foo'
        })));
      })
      .end(done);
  });

  it('does not log urls matching ignore pattern', function(done) {
    supertest(app).get('/image.png')
      .expect(200)
      .expect(function(res) {
        assert.isFalse(app.settings.logger.info.called);
      })
      .end(done);
  });

  it('does not log if req.ext.errorLogged', function(done) {
    extendedRequest.errorLogged = true;
    supertest(app).get('/')
      .expect(function(res) {
        assert.isFalse(app.settings.logger.info.called);
      })
      .end(done);
  });

  it('logs correct http status code', function(done) {
    statusCode = 304;
    supertest(app).get('/')
      .expect(function(res) {
        assert.isTrue(app.settings.logger.info.calledWith('request for /', sinon.match({
          statusCode: 304
        })));
      })
      .end(done);
  });
});
