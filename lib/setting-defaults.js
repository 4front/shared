var path = require('path');

module.exports = {
  awsRegion: 'us-west-2',
  port: process.env.PORT || 1903,
  jwtTokenExpireMinutes: 10,
  sessionTimeout: 1440,
  sslEnabled: true,
  cookiePrefix: '4front_',
  faviconPath: path.join(__dirname, '../public/images/favicon.ico'),
  sandboxCacheMaxAge: 4 * 60 * 60,
  networkTimeout: 10000,
  maxNetworkRetries: 3,

  // This is the default environment when there is no virtual environment name
  // specified in the URL, i.e. appname.webapps.nordstrom.net. This is only when
  // there is not a virtual environment specified like so:
  // appname--test.webapps.nordstrom.net.
  defaultVirtualEnvironment: 'production'
};
