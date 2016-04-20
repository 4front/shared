exports.crypto = require('./lib/crypto');
exports.configure = require('./lib/configure');
exports.settingDefaults = require('./lib/setting-defaults');
exports.logger = require('./lib/logger');
exports.appRegistry = require('./lib/app-registry');
exports.membership = require('./lib/membership');

exports.middleware = {
  debug: require('./lib/middleware/debug'),
  error: require('./lib/middleware/error'),
  requestLogger: require('./lib/middleware/request-logger'),
  healthCheck: require('./lib/middleware/health'),
  catchAll: require('./lib/middleware/catch-all')
};
