var path = require('path');
var debug = require('debug')('4front:shared:error');
var _ = require('lodash');
var accepts = require('accepts');
var favicon = require('serve-favicon');

require('simple-errors');

var defaultFavicon = path.join(__dirname, '../../public/images/favicon.ico');

// Register the error middleware together with middleware to display the error page.
// This is the most reliable way I've found to reliably log the error first before
// the error page rendering middleware steals final control.
module.exports = function(settings) {
  settings = _.defaults({} || settings, settings);

  return function(err, req, res, next) {
    // This is the last chance to serve the default favicon.
    if (err.status === 404 && req.path === '/favicon.ico') {
      return favicon(settings.faviconPath || defaultFavicon)(req, res, next);
    }

    // Tack on additional context to the error.
    _.extend(err, {
      method: req.method,
      url: req.protocol + '://' + req.hostname + req.originalUrl
    });

    if (_.isObject(req.ext)) {
      if (_.isObject(req.ext.virtualApp)) {
        err.appId = req.ext.virtualApp.appId;
      }
      if (_.isObject(req.ext.virtualAppVersion)) {
        err.versionId = req.ext.virtualAppVersion.versionId;
      }
    }

    // Log the error
    settings.logger.middleware.error(err, req, res, function() {
      debug('last chance error page middleware %s', err.message);

      if (!err.status) err.status = 500;

      var errorJson = Error.toJson(err);

      // TODO: Come up with a more secure way to allow error details in production.
      var showErrorDetails = process.env.NODE_ENV === 'development' || _.has(req.query, '__debug__');

      // If not showing full error details, pick out only a few safe attributes
      if (showErrorDetails !== true) {
        errorJson = _.pick(errorJson, 'status', 'message', 'code', 'help');
      }

      // We don't care about the error stack for anything but 500 errors
      if (err.status !== 500) {
        errorJson.stack = null;
      }

      res.set('Cache-Control', 'no-cache');

      res.statusCode = err.status;

      var errorView;
      if (req.ext) {
        errorView = req.ext.customErrorView || settings.customErrorView;
      }

      var accept = accepts(req);
      switch (accept.type(['json', 'html'])) {
      case 'json':
        res.json(errorJson);
        break;
      case 'html':
        if (!errorView) {
          errorView = path.join(__dirname, '../../views/error.jade');
        }

        res.render(errorView, {showDetails: showErrorDetails, error: errorJson});
        break;
      default:
        // the fallback is text/plain, so no need to specify it above
        res.setHeader('Content-Type', 'text/plain');
        res.write(JSON.stringify(errorJson));
        break;
      }
    });
  };
};
