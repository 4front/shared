// import assert from 'assert';
var express = require('express');
var sinon = require('sinon');
var supertest = require('supertest');
var assert = require('assert');
var shortid = require('shortid');
var errorMiddleware = require('../lib/middleware/error');

require('simple-errors');
require('dash-assert');

describe('error middleware', function() {
  var app;
  var error;
  var extendedRequest;

  beforeEach(function() {
    app = express();

    app.settings.logger = {
      error: sinon.spy(function() {})
    };

    extendedRequest = {
      virtualApp: {appId: shortid.generate()},
      virtualAppVersion: {versionId: shortid.generate()}
    };

    error = new Error('error');
    app.use(function(req, res, next) {
      req.ext = extendedRequest;
      next(error);
    });

    app.use(errorMiddleware(app.settings));
  });

  it('does something', function(done) {
    supertest(app).get('/')
      .expect(500)
      .expect(function(res) {
        assert.isTrue(app.settings.logger.error.calledWith(sinon.match({
          status: 500,
          appId: extendedRequest.virtualApp.appId,
          versionId: extendedRequest.virtualAppVersion.versionId
        })));
      })
      .end(done);
  });

  it('preserves error status', function(done) {
    error = Error.http(400);
    supertest(app).get('/')
      .expect(400)
      .end(done);
  });

  it('includes url in error dump', function(done) {
    error = Error.http(500);
    supertest(app).get('/some/path')
      .set('Accept', 'application/json')
      .expect(500)
      .expect('Content-Type', /application\/json/)
      .expect(function(res) {
        assert.equal(res.body.method, 'GET');
        assert.equal(res.body.url, 'http://127.0.0.1/some/path');
      })
      .end(done);
  });

  it('includes virtual app and version in error dump', function(done) {
    error = Error.http(500);
    supertest(app).get('/some/path')
      .set('Accept', 'application/json')
      .expect(500)
      .expect('Content-Type', /application\/json/)
      .expect(function(res) {
        assert.equal(res.body.appId, extendedRequest.virtualApp.appId);
        assert.equal(res.body.versionId, extendedRequest.virtualAppVersion.versionId);
      })
      .end(done);
  });

  it('does not log errors with log === false', function(done) {
    error = Error.http(400, 'Invalid', {log: false});
    supertest(app).get('/favicon.ico')
      .expect(400)
      .expect(function() {
        assert.isFalse(app.settings.logger.error.called);
      })
      .end(done);
  });

  it('serves default favicon', function(done) {
    error = Error.http(404);
    supertest(app).get('/favicon.ico')
      .expect(200)
      .end(done);
  });
});
