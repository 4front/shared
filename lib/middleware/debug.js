var express = require('express');
var _ = require('lodash');

module.exports = function(settings) {
  var router = express.Router();

  router.get('/req', function(req, res, next) {
    res.json(_.pick(req, 'headers', 'hostname', 'cookies', 'ip',
      'ips', 'originalUrl', 'protocol', 'secure', 'subdomains'));
  });

  return router;
};
