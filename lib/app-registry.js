var _ = require('lodash');
var async = require('async');
var publicSuffixList = require('psl');
var debug = require('debug')('4front:shared:app-registry');

module.exports = function(settings) {
  settings = _.defaults({}, settings || {}, {
    useCustomDomains: true,
    forceGlobalHttps: false,
    sharedDomainHttps: true,
    metrics: {
      increment: function() {}
    }
  });

  var exports = {};

  // Get app by id
  exports.getById = function(appId, opts, callback) {
    if (_.isFunction(opts)) {
      callback = opts;
      opts = {};
    }

    fetchFromDatabase(appId, callback);
  };

  exports.batchGetById = function(appIds, opts, callback) {
    if (_.isFunction(opts)) {
      callback = opts;
      opts = {};
    }

    debug('batch get apps %o', appIds);
    async.map(appIds, function(appId, cb) {
      exports.getById(appId, opts, cb);
    }, function(err, apps) {
      if (err) return callback(err);

      callback(null, _.compact(apps));
    });
  };

  // Get the app by name
  exports.getByName = function(name, opts, callback) {
    if (_.isFunction(opts)) {
      callback = opts;
      opts = {};
    }

    debug('looking up app with name: %s', name);
    async.waterfall([
      function(cb) {
        settings.database.getApplicationByName(name, cb);
      },
      function(app, cb) {
        if (app) return cb(null, app);
        if (!settings.databaseFallback) return cb(null, null);

        debug('could not find app by name in primary database, try fallback');
        settings.metrics.increment('dynamo-fallback-read');
        settings.databaseFallback.getApplicationByName(name, cb);
      }
    ], function(err, app) {
      if (err) return callback(err);
      if (!app) {
        debug('could not find app %s in database', name);
        return callback(null, null);
      }
      fixUpApp(app);
      callback(null, app);
    });
  };

  exports.getByDomain = function(domainName, subDomain, opts, callback) {
    if (_.isFunction(opts)) {
      callback = opts;
      opts = {};
    }

    debug('get app for domain=%s, subdomain=%s', domainName, subDomain);
    async.waterfall([
      // First try looking up the app using the new domainName and subDomain attributes
      function(cb) {
        _getByDomain(settings.database, domainName, subDomain, cb);
      },
      function(app, cb) {
        if (app) return cb(null, app);
        if (!app && !settings.databaseFallback) return cb(null, null);

        debug('could not find app by domain in primary database, try fallback');
        settings.metrics.increment('dynamo-fallback-read');
        _getByDomain(settings.databaseFallback, domainName, subDomain, cb);
      }
    ], function(err, app) {
      if (err) return callback(err);
      if (!app) {
        debug('could not find app %s in the database', domainName);
        return callback(null, null);
      }

      fixUpApp(app);
      callback(null, app);
    });
  };

  function _getByDomain(database, domainName, subDomain, callback) {
    // First try looking up the app using the new domainName and subDomain attributes
    async.waterfall([
      function(cb) {
        // First look up the app by domain name.
        database.getAppByDomainName(domainName, subDomain, cb);
      },
      function(app, cb) {
        if (app) return cb(null, app);
        // If couldn't find it, try using the legacy domain.
        _getByLegacyDomain(database, domainName, subDomain, cb);
      }
    ], callback);
  }

  function _getByLegacyDomain(database, domainName, subDomain, callback) {
    var fullDomainName = subDomain === '@' ? domainName : subDomain + '.' + domainName;
    async.waterfall([
      function(cb) {
        database.getLegacyDomain(fullDomainName, function(err, legacyDomain) {
          if (err) return cb(err);
          if (!legacyDomain) return cb(null, null);
          cb(null, legacyDomain.appId);
        });
      },
      function(appId, cb) {
        database.getApplication(appId, cb);
      }
    ], function(err, app) {
      if (err) return callback(err);
      if (!app) return callback(null, null);
      app.domainName = domainName;
      app.subDomain = subDomain;
      callback(null, app);
    });
  }

  // Add the specified app to the registry.
  exports.add = function(app) {
    fixUpApp(app);
    return app;
  };

  function fetchFromDatabase(appId, callback) {
    async.waterfall([
      function(cb) {
        settings.database.getApplication(appId, cb);
      },
      function(app, cb) {
        if (app) return cb(null, app);
        if (!app && !settings.databaseFallback) return cb(null, null);

        debug('app not found in primary database, try fallback');
        settings.metrics.increment('dynamo-fallback-read');
        settings.databaseFallback.getApplication(appId, cb);
      }
    ], function(err, app) {
      if (err) return callback(err);

      if (!app) {
        debug('cannot find app %s in database', appId);
        return callback(null, null);
      }

      fixUpApp(app);
      callback(null, app);
    });
  }

  function getLegacyCustomDomain(virtualApp) {
    if (_.isArray(virtualApp.legacyDomains) && virtualApp.legacyDomains.length > 0) {
      // Find the first custom domain with a 'resolve' action.
      return _.find(virtualApp.legacyDomains, function(domain) {
        return domain.action === 'resolve' || _.isUndefined(domain.action);
      });
    }
    return null;
  }

  function buildUrl(domainName, subDomain, useSsl, envName) {
    // All custom domain URLs are SSL
    var url = 'http' + (useSsl ? 's' : '') + '://';

    // If the subDomain is '@' then this is the apex domain
    if (subDomain === '@') {
      if (envName === 'production') {
        url += domainName;
      } else {
        url += envName + '.' + domainName;
      }
    } else {
      if (envName === 'production') {
        url += subDomain + '.' + domainName;
      } else {
        url += subDomain + '--' + envName + '.' + domainName;
      }
    }
    return url;
  }

  function fixUpApp(app) {
    if (!app.trafficControlRules) app.trafficControlRules = [];

    if (_.isFunction(settings.visitApp)) {
      settings.visitApp(app);
    }

    if (_.isArray(app.environments)) {
      app.environments = _.union(['production'], app.environments);
    } else {
      app.environments = ['production'];
    }

    if (settings.forceGlobalHttps === true) {
      app.requireSsl = true;
    }

    var domainName;
    var subDomain;
    var useSsl;

    // If the app has a domainName property, then it's using a new custom domain
    if (!_.isEmpty(app.domainName)) {
      domainName = app.domainName;
      subDomain = app.subDomain;
      useSsl = true;
    } else {
      var legacyDomain = getLegacyCustomDomain(app);
      if (legacyDomain) {
        var parsedDomain = publicSuffixList.parse(legacyDomain.domain);
        domainName = parsedDomain.domain;
        subDomain = parsedDomain.subdomain || '@';
        useSsl = app.requireSsl === true;
      } else {
        domainName = settings.virtualHost;
        subDomain = app.name;
        useSsl = settings.sharedDomainHttps;
      }
    }

    app.urls = {};
    _.each(app.environments, function(envName) {
      app.urls[envName] = buildUrl(domainName, subDomain, useSsl, envName);
    });

    // For convenience expose the production url on its own property
    app.url = app.urls.production;
  }

  return exports;
};
