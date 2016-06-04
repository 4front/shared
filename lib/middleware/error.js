var path = require('path');
var debug = require('debug')('4front:shared:error');
var _ = require('lodash');
var accepts = require('accepts');
var jsonStringify = require('json-stringify-safe');
var reqSerializer = require('../req-serializer');

require('simple-errors');

// Register the error middleware together with middleware to display the error page.
// This is the most reliable way I've found to reliably log the error first before
// the error page rendering middleware steals final control.
module.exports = function(settings) {
  settings = _.defaults({} || settings, settings);

  return function(err, req, res, next) {
    if (_.isString(err)) {
      err = new Error(err);
    }

    if (!err.status) err.status = 500;

    // Omit the status field, for consistency we want it called statusCode
    var omitFields = ['status'];
    if (err.status !== 500) omitFields.push('stack');

    var errorJson = _.omit(Error.toJson(err), omitFields);

    // Tack on additional req context to the error.
    _.assign(errorJson, {eventType: 'httpResponse', statusCode: err.status}, reqSerializer(req));

    // Log the error
    if (err.log !== false && req.ext.errorLogged !== true) {
      req.app.settings.logger.error(errorJson);
      req.ext.errorLogged = true;
    }

    // TODO: Come up with a more secure way to allow error details in production.
    var showErrorDetails = process.env.NODE_ENV === 'development' || _.has(req.query, '__debug__');

    // If not showing full error details, ensure the err stack is nulled out.
    if (showErrorDetails !== true && errorJson.stack) {
      errorJson = _.omit(errorJson, 'stack');
    }

    // Make sure the CDN doesn't cache error responses
    res.set('Cache-Control', 'no-cache');

    res.statusCode = err.status;

    var accept = accepts(req);
    switch (accept.type(['json', 'html'])) {
      case 'json':
        res.setHeader('Content-Type', 'application/json');
        res.send(jsonStringify(errorJson));
        break;
      case 'html':
        var errorView;
        if (req.ext) {
          errorView = req.ext.customErrorView;
        }

        if (!errorView) {
          errorView = settings.customErrorView || path.join(__dirname, '../../views/error.jade');
        }

        res.setHeader('Content-Type', 'text/html');
        res.render(errorView, {showDetails: showErrorDetails, error: errorJson});
        break;
      default:
        // the fallback is text/plain, so no need to specify it above
        res.setHeader('Content-Type', 'text/plain');
        res.write(jsonStringify(errorJson));
        break;
    }
  };
};
