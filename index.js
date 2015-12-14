exports.crypto = require('./lib/crypto');
exports.configure = require('./lib/configure');

exports.routes = {
  crypto: require('./lib/crypto'),
  debug: require('./lib/middleware/debug'),
  error: require('./lib/middleware/error'),
  healthCheck: require('./lib/middleware/health'),
  catchAll: require('./lib/middleware/catch-all')
};
