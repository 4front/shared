var _ = require('lodash');

// Custom serialization of the http request
module.exports = function(req, statusCode) {
  var serialized = _.assign({}, {
    requestId: req.ext.requestId,
    method: req.method,
    url: requestedUrl(req)
  }, _.pick(req.headers, 'host'));

  if (statusCode) serialized.statusCode = statusCode;

  if (req.headers.referer) {
    serialized.referer = stripQuerystring(req.headers.referer);
  }

  if (req.headers['x-real-ip']) {
    serialized.ip = req.headers['x-real-ip'];
  }

  if (req.ext.startTime) {
    serialized.duration = Date.now() - req.ext.startTime;
  }

  // Augment the log record with some additional properties
  if (req.ext.virtualApp) {
    serialized.appId = req.ext.virtualApp.appId;
  }

  if (req.ext.virtualEnv) {
    serialized.virtualEnv = req.ext.virtualEnv;
  }

  if (req.ext.virtualAppVersion) {
    serialized.versionId = req.ext.virtualAppVersion.versionId;
  }

  if (_.isBoolean(req.ext.cacheHit)) {
    serialized.cacheHit = req.ext.cacheHit;
  }
  if (_.isBoolean(req.ext.appCacheHit)) {
    serialized.appCacheHit = req.ext.appCacheHit;
  }

  return serialized;
};

function requestedUrl(req) {
  return (req.secure ? 'https' : 'http') + '://' +
    req.hostname + stripQuerystring(req.originalUrl);
}

function stripQuerystring(url) {
  var queryIndex = url.indexOf('?');
  if (queryIndex !== -1) {
    return url.substr(0, queryIndex);
  }
  return url;
}
