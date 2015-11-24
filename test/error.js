// import assert from 'assert';
var express = require('express');
var supertest = require('supertest');
var errorMiddleware = require('../lib/middleware/error');
require('dash-assert');

describe('error middleware', function() {
  var app;

  beforeEach(function() {
    app = express();

    app.use(function(req, res, next) {
      next(new Error('error'));
    });

    app.use(errorMiddleware());
  });

  it('does something', function(done) {
    supertest(app).get('/')
      .expect(500)
      .end(done);
  });
});
