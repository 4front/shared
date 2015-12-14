exports.crypto = require('./lib/crypto');
exports.configure = require('./lib/configure');
exports.settingDefaults = require('./lib/setting-defaults');

exports.routes = {
  debug: require('./lib/middleware/debug'),
  error: require('./lib/middleware/error'),
  healthCheck: require('./lib/middleware/health'),
  catchAll: require('./lib/middleware/catch-all')
};
