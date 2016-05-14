var _ = require('lodash');
var onFinished = require('on-finished');
var shortid = require('shortid');
var reqSerializer = require('../req-serializer');

module.exports = function(options) {
  _.defaults(options, {
    ignoreRequestRegex: /\.(png|gif|jpg|js|css)$/,
    requestIdHeader: 'X-Request-Id'
  });

  return function(req, res, next) {
    if (options.ignoreRequestRegex.test(req.path)) return next();

    if (!req.ext) req.ext = {};

    req.ext.startTime = Date.now();
    req.ext.requestId = req.get(options.requestIdHeader);

    // If there isn't already a request-id (like from some upstream load balancer), create one.
    if (!req.ext.requestId) {
      req.ext.requestId = shortid.generate();
      req.headers[options.requestIdHeader] = req.ext.requestId;

      // Tack the x-request-id to the response headers
      res.set(options.requestIdHeader, req.ext.requestId);
    }

    onFinished(res, function(err) {
      // Avoid double logging if an error has already been logged.
      if (req.ext.noLogRequest === true || req.ext.errorLogged === true) return;

      var logData = _.assign({eventType: 'httpResponse'}, reqSerializer(req, res.statusCode));
      req.app.settings.logger.info(logData);
    });

    next();
  };
};
