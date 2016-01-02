var _ = require('lodash');
var path = require('path');
var AWS = require('aws-sdk');

// Common configuration setup for the Express app.
module.exports = function(app) {
  var localInstance = (process.env.NODE_ENV === 'development');

  app.enable('trust proxy');
  app.set('view engine', 'jade');
  app.disable('x-powered-by');

  // 4front has it's own custom etag logic
  app.disable('etag');

  // Set a global timeout for all AWS services
  AWS.config.httpOptions = {timeout: parseInt(process.env.AWS_HTTP_TIMEOUT || '5000', 10)};

  _.extend(app.settings, {
    awsRegion: process.env.AWS_REGION || 'us-west-2',
    localInstance: localInstance,
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
    clientConfigVar: '__4front__',
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
