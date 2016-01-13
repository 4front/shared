var assert = require('assert');
var async = require('async');
var _ = require('lodash');
var shortid = require('shortid');
var urljoin = require('url-join');
var supertest = require('supertest');
var express = require('express');
var debug = require('debug')('4front:shared:health');
require('simple-errors');

// Health check endpoint
module.exports = function(settings, apiRouter, hostRouter) {
  var router = express.Router();

  router.use(function(req, res, next) {
    res.set('Cache-Control', 'no-cache');
    next();
  });

  // Very basic health check that simply echos OK
  router.get('/', function(req, res, next) {
    res.send('OK');
  });

  // Advanced health check that exercises a large portion of application functionality.
  router.get('/full', function(req, res, next) {
    // Create an app, deploy an index.html file, load the app, delete the app.
    var testApi = createTestApiInstance(settings);

    var userId = 'health-check-' + shortid.generate();
    var providerUser = {username: userId, userId: userId, forceSameId: true};

    // Using Date.now() rather than shortid to ensure the name meets the validation rules
    // Tack on a random number. Since the health check may be running on multiple
    // instances, it's possible to get the same appName using only Date.now().
    var appName = 'health-check-' + Date.now().toString() + _.random(10, 99).toString();

    var orgName = 'health-check-' + shortid.generate();
    var loggedInUser;
    var testOrg;
    var testApp;
    var testVersion;

    try {
      async.series([
        createUser,
        loginUser,
        createOrganization,
        createApplication,
        createVersion,
        deployIndexHtml,
        activateVersion,
        curlAppIndexUrl
      ], function(err) {
        // Cleanup the objects created by the health-check
        cleanup(function(cleanupErr) {
          if (cleanupErr && !err) err = cleanupErr;

          if (err) {
            return res.status(500).json(Error.toJson(err));
          }

          res.json({
            user: loggedInUser,
            org: testOrg,
            app: testApp,
            version: testVersion
          });
        });
      });
    } catch (err) {
      return res.status(500).json(Error.toJson(err));
    }

    function cleanup(callback) {
      var tasks = [];
      if (testApp) tasks.push(deleteApplication);
      if (testOrg) tasks.push(deleteOrganization);
      if (loggedInUser) tasks.push(deleteUser);

      async.series(tasks, callback);
    }

    // Create a new test user
    function createUser(callback) {
      debug('create health-check user %s', providerUser.username);
      settings.membership.createUser(providerUser, callback);
    }

    function loginUser(callback) {
      debug('login health-check user %s', providerUser.username);
      settings.membership.providerLogin(providerUser, function(err, user) {
        if (err) return callback(err);
        loggedInUser = user;
        callback();
      });
    }

    function createOrganization(callback) {
      debug('create health-check organization');
      makeApiCall({url: '/orgs', method: 'post', body: {name: orgName}}, function(err, org) {
        if (err) return callback(err);
        testOrg = org;
        callback();
      });
    }

    function createApplication(callback) {
      debug('create health-check application');
      makeApiCall({url: '/orgs/' + testOrg.orgId + '/apps', method: 'post', body: {name: appName}}, function(err, app) {
        if (err) return callback(err);
        testApp = app;
        callback();
      });
    }

    function createVersion(callback) {
      debug('create health-check version');
      var postData = {
        manifest: {
          _virtualApp: {
            router: [{module: 'webpage'}]
          }
        }
      };

      makeApiCall({url: '/apps/' + testApp.appId + '/versions', body: postData, method: 'post'}, function(err, version) {
        if (err) return callback(err);
        testVersion = version;
        callback();
      });
    }

    function activateVersion(callback) {
      debug('activate health-check version');
      var apiOptions = {
        method: 'PUT',
        url: '/apps/' + testApp.appId + '/versions/' + testVersion.versionId + '/complete',
        body: {
          forceAllTrafficToNewVersion: true //eslint-disable-line
        }
      };

      makeApiCall(apiOptions, callback);
    }

    function deployIndexHtml(callback) {
      debug('deploy health-check index.html');
      var apiOptions = {
        url: '/apps/' + testApp.appId + '/versions/' + testVersion.versionId + '/deploy/index.html',
        method: 'post',
        body: '<html><head></head><body>' + testApp.appId + ',' + testVersion.versionId + '</body></html>'
      };

      makeApiCall(apiOptions, callback);
    }

    function curlAppIndexUrl(callback) {
      debug('curl the health-check app url %s', appName + '.' + settings.virtualHost);
      var apphost = express();
      _.extend(apphost.settings, settings);

      apphost.use(hostRouter);
      supertest(apphost).get('/')
        .set('Host', appName + '.' + settings.virtualHost)
        .expect(200)
        .expect(function(resp) {
          assert.equal(resp.statusCode, 200);
          assert.ok(resp.text.indexOf('<body>' + testApp.appId + ',' + testVersion.versionId + '</body>') > 0);
        })
        .end(callback);
    }

    function deleteApplication(callback) {
      debug('deleting health-check application %s', testApp.appId);
      var apiOptions = {
        method: 'DELETE',
        url: '/apps/' + testApp.appId,
        json: true
      };

      makeApiCall(apiOptions, callback);
    }

    function deleteOrganization(callback) {
      debug('deleting health-check organization %s', testOrg.orgId);
      var apiOptions = {
        method: 'DELETE',
        url: '/orgs/' + testOrg.orgId,
        json: true
      };

      makeApiCall(apiOptions, callback);
    }

    function deleteUser(callback) {
      debug('delete health-check user');

      settings.database.deleteUser(loggedInUser.userId, callback);
    }

    function makeApiCall(options, callback) {
      var method = (options.method || 'get').toLowerCase();

      var apiRequest = testApi[method](urljoin('/api', options.url))
        .set('X-Access-Token', loggedInUser.jwt.token);

      if (options.body) {
        apiRequest = apiRequest.send(options.body);
      }

      apiRequest.end(function(err, resp) {
        if (err || resp.status >= 400) {
          var errorData = {url: options.url};
          if (_.isObject(resp.body)) {
            _.extend(errorData, resp.body);
          }

          return callback(Error.create('Error invoking API', errorData, err));
        }

        callback(null, resp.body);
      });
    }
  });

  function createTestApiInstance() {
    var app = express();
    _.extend(app.settings, settings);
    app.use('/api', apiRouter);
    return supertest(app);
  }

  return router;
};
