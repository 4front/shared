var express = require('express');
var _ = require('lodash');
var stringify = require('json-stringify-safe');

module.exports = function(settings) {
  var router = express.Router();

  // Echo back properties of the request
  router.get('/req', function(req, res, next) {
    res.json(_.pick(req, 'headers', 'hostname', 'cookies', 'ip',
      'ips', 'originalUrl', 'protocol', 'secure', 'subdomains'));
  });

  // Test out error handling
  router.get('/error', function(req, res, next) {
    next(new Error('Forcing an error'));
  });

  // Intentionally throw an unhandled exception
  router.get('/crash', function(req, res, next) {
    throw new Error('Forcing an application crash');
  });

  // Echo back the app settings omitting sensitive keys
  router.get('/settings', function(req, res, next) {
    res.set('Content-Type', 'application/json');

    var safeKeys = _.pick(settings, function(value, key) {
      return _.isString(key) &&
        key.toLowerCase().indexOf('secret') === -1 &&
        key.toLowerCase().indexOf('password') === -1;
    });

    res.send(stringify(safeKeys));
  });

  return router;
};
