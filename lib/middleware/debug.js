var express = require('express');
var _ = require('lodash');

require('simple-errors');

module.exports = function(settings) {
  var router = express.Router();

  router.use(function(req, res, next) {
    res.set('Cache-Control', 'no-cache');
    next();
  });

  // Echo back properties of the request
  router.get('/req', function(req, res, next) {
    res.json(_.pick(req, 'headers', 'hostname', 'cookies', 'ip',
      'ips', 'originalUrl', 'protocol', 'secure', 'subdomains', 'baseUrl'));
  });

  // Test out error handling
  router.get('/error', function(req, res, next) {
    next(Error.create('Forcing an error', {log: false}));
  });

  // Intentionally crash the application
  router.get('/crash', function(req, res, next) {
    setTimeout(function() {
      throw new Error('Forcing an application crash');
    }, 0);
  });

  // Echo back the app settings omitting sensitive keys
  router.get('/settings', function(req, res, next) {
    var safeSettings = _.pick(settings, function(value, key) {
      return _.isString(key) &&
        !_.isObject(value) &&
        key.toLowerCase().indexOf('secret') === -1 &&
        key.toLowerCase().indexOf('password') === -1;
    });

    res.send(safeSettings);
  });

  return router;
};
