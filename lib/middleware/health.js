var assert = require('assert');
var async = require('async');
var _ = require('lodash');
var shortid = require('shortid');
var request = require('request');
var urljoin = require('url-join');
var debug = require('debug')('4front:shared:health');
require('simple-errors');

// Health check endpoint
module.exports = function(settings) {
  return function(req, res, next) {
    // Create an app, deploy an index.html file, load the app, delete the app.

    var userId = shortid.generate();
    var testUser = {username: userId, userId: userId};
    var appName = 'health-check-' + Date.now();
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
        curlAppIndexUrl,
        deleteApplication,
        deleteOrganization,
        deleteUser
      ], function(err) {
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
    } catch (err) {
      return res.status(500).json(Error.toJson(err));
    }

    // Create a new test user
    function createUser(callback) {
      debug('create health-check user %s', testUser.username);
      settings.membership.createUser(testUser, callback);
    }

    function loginUser(callback) {
      debug('login health-check user %s', testUser.username);
      settings.membership.providerLogin(testUser, function(err, user) {
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
        json: true,
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
      request({url: 'http://' + appName + '.' + settings.virtualHost}, function(err, resp, body) {
        assert.equal(resp.statusCode, 200);
        assert.ok(body.indexOf('<body>' + testApp.appId + ',' + testVersion.versionId + '</body>' > 0));
        callback();
      });
    }

    function deleteApplication(callback) {
      debug('deleting health-check application');
      var apiOptions = {
        method: 'DELETE',
        url: '/apps/' + testApp.appId,
        json: true
      };

      makeApiCall(apiOptions, callback);
    }

    function deleteOrganization(callback) {
      debug('deleting health-check organization');
      var apiOptions = {
        method: 'DELETE',
        url: '/orgs/' + testOrg.orgId,
        json: true
      };

      makeApiCall(apiOptions, callback);
    }

    function deleteUser(callback) {
      debug('delete health-check user');

      settings.database.deleteUser(testUser.userId, callback);
    }

    function makeApiCall(options, callback) {
      _.extend(options, {
        url: (req.secure ? 'https' : 'http') + '://' + urljoin(settings.virtualHost, 'api', options.url),
        json: true,
        headers: {
          'X-Access-Token': loggedInUser.jwt.token
        }
      });

      request(options, function(err, resp, body) {
        var statusCode = 0;
        if (resp && _.isNumber(resp.statusCode)) {
          statusCode = resp.statusCode;
        }

        if (err || statusCode >= 300) {
          var data = _.isObject(body) ? body : {};
          data.url = options.url;
          return callback(Error.create('Error invoking api', data, err));
        }

        callback(null, body);
      });
    }
  };
};
