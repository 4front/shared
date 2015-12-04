// import assert from 'assert';
var express = require('express');
var sinon = require('sinon');
var supertest = require('supertest');
var errorMiddleware = require('../lib/middleware/error');

require('simple-errors');
require('dash-assert');

describe('error middleware', function() {
  var app;
  var error;

  beforeEach(function() {
    app = express();

    app.settings.logger = {
      middleware: {
        error: sinon.spy(function(err, req, res, next) {
          next();
        })
      }
    };

    error = new Error('error');
    app.use(function(req, res, next) {
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

  it('serves default favicon', function(done) {
    error = Error.http(404);
    supertest(app).get('/favicon.ico')
      .expect(200)
      .end(done);
  });
});
