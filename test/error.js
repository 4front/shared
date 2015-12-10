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
      middleware: {
        error: sinon.spy(function(err, req, res, next) {
          next();
        })
      }
    };

    extendedRequest = null;

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
        app.settings.logger.middleware.error.calledWith(sinon.match({status: 500}));
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
      .expect(function(res) {
        assert.equal(res.body.method, 'GET');
        assert.equal(res.body.url, 'http://127.0.0.1/some/path');
      })
      .end(done);
  });

  it('includes virtual app and version in error dump', function(done) {
    var appId = shortid.generate();
    var versionId = shortid.generate();

    extendedRequest = {
      virtualApp: {appId: appId},
      virtualAppVersion: {versionId: versionId}
    };

    error = Error.http(500);
    supertest(app).get('/some/path')
      .set('Accept', 'application/json')
      .expect(500)
      .expect(function(res) {
        assert.equal(res.body.appId, appId);
        assert.equal(res.body.versionId, versionId);
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
