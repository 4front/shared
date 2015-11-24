var _ = require('lodash');
var path = require('path');

module.exports = function(app) {
  _.extend(app.settings, {
    port: process.env.PORT || 1903,
    // The virtual host is the domain that the platform runs, i.e. "myapphost.com"
    virtualHost: process.env.FF_VIRTUAL_HOST,
    jwtTokenSecret: process.env.FF_JWT_TOKEN_SECRET,
    jwtTokenExpireMinutes: parseInt(process.env.FF_JWT_TOKEN_EXPIRE || '30', 10),
    sessionSecret: process.env.FF_SESSION_SECRET,
    sessionTimeout: process.env.FF_SESSION_TIMEOUT ? parseInt(process.env.FF_SESSION_TIMEOUT, 10) : null,
    forceGlobalHttps: process.env.FF_FORCE_GLOBAL_HTTPS === '1',
    sslEnabled: process.env.FF_SSL_ENABLED === '1',
    cookiePrefix: '4front_',
    faviconPath: path.join(__dirname, '../public/images/favicon.ico'),
    sandboxCacheMaxAge: parseInt(process.env.FF_SANDBOX_CACHE_MAX_AGE || (4 * 60 * 60), 10),
    networkTimeout: parseInt(process.env.FF_NETWORK_TIMEOUT, 10) || 10000,
    maxNetworkRetries: 3,

    // This is the default environment when there is no virtual environment name
    // specified in the URL, i.e. appname.webapps.nordstrom.net. This is only when
    // there is not a virtual environment specified like so:
    // appname--test.webapps.nordstrom.net.
    defaultVirtualEnvironment: process.env.FF_DEFAULT_ENV || 'production',

    cryptoPassword: process.env.FF_CRYPTO_PASSWORD,

    // Normally this would be an absolute S3 url or a CDN whose origin is set to
    // the S3 bucket, but for 4front local just serving static assets out of
    // the same Express app.
    deployedAssetsPath: process.env.FF_DEPLOYED_ASSETS_PATH,

    // TODO: This should live in a JSON file
    starterTemplates: [
      {
        name: 'React Startify',
        description: 'React JS application skeleton using Browserify, Gulp, and ES6',
        url: 'https://github.com/4front/react-starterify/archive/master.zip'
      }
    ]
  });

  app.settings.crypto = require('./crypto')(app.settings.cryptoPassword);
};
