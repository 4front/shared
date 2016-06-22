var appRegistry = require('../lib/app-registry');
var assert = require('assert');
var _ = require('lodash');
var sinon = require('sinon');
var shortid = require('shortid');

require('dash-assert');

function mockDatabase(storage) {
  return {
    getApplication: sinon.spy(function(appId, callback) {
      callback(null, _.find(storage.apps, {appId: appId}));
    }),
    getApplicationByName: sinon.spy(function(name, callback) {
      callback(null, _.find(storage.apps, {name: name}));
    }),
    getLegacyDomain: sinon.spy(function(domain, callback) {
      callback(null, _.find(storage.domains, {domain: domain}));
    })
  };
}

describe('appRegistry', function() {
  var self;

  beforeEach(function() {
    self = this;

    this.cache = {};
    this.database = {
      apps: [],
      domains: []
    };

    this.settings = {
      cacheEnabled: true,
      sslEnabled: true,
      virtualHost: 'apphost.com',
      database: mockDatabase(this.database)
    };

    this.addAppToDatabase = function(app) {
      this.database.apps.push(app);
    };

    this.registry = appRegistry(this.settings);
  });

  describe('getById', function() {
    it('load app from database', function(done) {
      var appId = '123';
      var appName = 'appname';
      this.database.apps.push({appId: appId, name: appName});

      this.registry.getById(appId, function(err, app) {
        if (err) return done(err);

        assert.ok(self.settings.database.getApplication.calledWith(appId));
        assert.equal(appId, app.appId);
        done();
      });
    });

    it('app not in database', function(done) {
      var appId = '123';
      this.registry.getById(appId, function(err, app) {
        assert.ok(self.settings.database.getApplication.calledWith(appId));
        assert.ok(_.isNull(app));
        done();
      });
    });

    it('force reload', function(done) {
      var appId = '123';
      this.database.apps.push({appId: appId, name: 'appname'});

      this.registry.getById(appId, {forceReload: true}, function(err, app) {
        assert.ok(self.settings.database.getApplication.calledWith(appId));
        assert.equal(appId, app.appId);
        done();
      });
    });
  });

  describe('getByName', function() {
    it('app in database', function(done) {
      var appId = '123';
      var appName = 'appname';
      this.database.apps.push({appId: appId, name: appName});

      this.registry.getByName(appName, function(err) {
        assert.ok(self.settings.database.getApplicationByName.calledWith(appName));
        done();
      });
    });
  });

  describe('batchGetById()', function() {
    it('some in database, some not', function(done) {
      this.database.apps.push({appId: '1', name: 'app1'}, {appId: '2', name: 'app2'});

      this.registry.batchGetById(['1', '2', '3'], function(err, apps) {
        assert.equal(apps.length, 2);
        assert.ok(self.settings.database.getApplication.calledWith('1'));
        assert.ok(self.settings.database.getApplication.calledWith('2'));
        assert.ok(self.settings.database.getApplication.calledWith('3'));
        done();
      });
    });
  });

  describe('getByDomain', function() {
    beforeEach(function() {
      self = this;
      this.appId = shortid.generate();
      this.settings.database.getAppByDomainName = sinon.spy(
        function(domainName, subDomain, callback) {
          callback(null, {appId: self.appId});
        });

      this.settings.database.getLegacyDomain = sinon.spy(function(fullDomainName, callback) {
        callback(null, {domain: fullDomainName, appId: self.appId});
      });
    });

    it('new style domain exists', function(done) {
      this.addAppToDatabase({appId: self.appId});

      this.registry.getByDomain('app.com', '@', function(err, app) {
        if (err) return done(err);
        assert.isTrue(self.settings.database.getAppByDomainName.calledWith('app.com', '@'));
        assert.isFalse(self.settings.database.getLegacyDomain.called);
        assert.equal(app.appId, self.appId);
        done();
      });
    });

    it('new style domain does not exist', function(done) {
      this.addAppToDatabase({appId: self.appId});
      this.settings.database.getAppByDomainName = sinon.spy(
        function(domainName, subDomain, callback) {
          callback(null, null);
        });

      this.registry.getByDomain('app.com', 'www', function(err, app) {
        assert.isTrue(self.settings.database.getAppByDomainName.calledWith('app.com', 'www'));
        assert.isTrue(self.settings.database.getLegacyDomain.calledWith('www.app.com'));
        assert.equal(app.appId, self.appId);
        done();
      });
    });

    it('no matching new style or legacy domain', function(done) {
      this.settings.database.getAppByDomainName = sinon.spy(
        function(domainName, subDomain, callback) {
          callback(null, null);
        });

      this.settings.database.getLegacyDomain = sinon.spy(function(fullDomainName, callback) {
        callback(null, null);
      });

      this.registry.getByDomain('app.com', 'www', function(err, app) {
        assert.isTrue(self.settings.database.getAppByDomainName.calledWith('app.com', 'www'));
        assert.isTrue(self.settings.database.getLegacyDomain.calledWith('www.app.com'));
        assert.isNull(app);
        done();
      });
    });
  });

  it('add to registry', function() {
    var app = {
      appId: '1',
      name: 'test',
      requireSsl: true
    };

    this.registry.add(app);
    assert.equal(app.url, 'https://test.apphost.com');
  });

  describe('fixUpApp', function() {
    it('sets http app url', function(done) {
      this.database.apps.push({appId: '1', name: 'app', requireSsl: true});

      this.registry.getById('1', function(err, app) {
        assert.equal(app.url, 'https://app.apphost.com');
        done();
      });
    });

    it('uses default virtual host if no custom domain with resolve action', function(done) {
      var domain = {domain: 'www.app.com', action: 'redirect'};
      this.database.apps.push({appId: '1', name: 'app', domains: [domain]});

      this.registry.getById('1', function(err, app) {
        assert.equal(app.url, 'https://app.apphost.com');
        done();
      });
    });

    it('sets legacy custom domain app url', function(done) {
      var domain = {domain: 'www.app.com', action: 'resolve'};

      this.addAppToDatabase({
        appId: '1',
        name: 'app',
        legacyDomains: [domain],
        requireSsl: true
      });

      this.registry.getById('1', function(err, app) {
        assert.equal(app.url, 'https://www.app.com');
        done();
      });
    });

    it('custom domain when requireSsl is false is http', function(done) {
      var domain = {domain: 'www.app.com', action: 'resolve'};
      this.addAppToDatabase({appId: '1', name: 'app', legacyDomains: [domain], requireSsl: false});

      this.registry.getById('1', function(err, app) {
        assert.equal(app.url, 'http://www.app.com');
        done();
      });
    });

    it('global ssl setting uses https', function(done) {
      this.registry = appRegistry(_.extend({}, this.settings, {
        forceGlobalHttps: true
      }));

      var appId = '123';
      this.addAppToDatabase({appId: appId});

      this.registry.getById(appId, function(err, app) {
        assert.isTrue(/^https:/.test(app.url));

        done();
      });
    });
  });

  describe('custom domain urls', function() {
    beforeEach(function() {
      self = this;
      this.registry = appRegistry(_.extend(this.settings, {
        visitApp: function(virtualApp) {
          virtualApp.environments = ['production', 'test', 'dev'];
        }
      }));
    });

    it('domainName and subDomain', function(done) {
      this.addAppToDatabase({appId: '1', domainName: 'foo.com', subDomain: 'www'});

      this.registry.getById('1', function(err, app) {
        assert.equal(app.url, 'https://www.foo.com');
        assert.equal(app.urls.test, 'https://www--test.foo.com');
        assert.equal(app.urls.dev, 'https://www--dev.foo.com');
        done();
      });
    });

    it('apex domainName', function(done) {
      this.addAppToDatabase({appId: '1', domainName: 'foo.com', subDomain: '@'});

      this.registry.getById('1', function(err, app) {
        assert.equal(app.url, 'https://foo.com');
        assert.equal(app.urls.test, 'https://test.foo.com');
        assert.equal(app.urls.dev, 'https://dev.foo.com');
        done();
      });
    });
  });

  describe('database operations', function() {
    beforeEach(function() {
      self = this;

      this.appId = '123';
      this.appName = 'appname';
      this.database.apps.push({appId: this.appId, name: this.appName});
    });

    it('getById', function(done) {
      this.registry.getById(this.appId, function(err) {
        if (err) return done(err);

        assert.isTrue(self.settings.database.getApplication.calledWith(self.appId));
        done();
      });
    });

    it('getById missing', function(done) {
      this.registry.getById('xyz', function(err, app) {
        if (err) return done(err);

        assert.isNull(app);
        done();
      });
    });

    it('getByName', function(done) {
      this.registry.getByName(this.appName, function(err) {
        if (err) return done(err);

        assert.isTrue(self.settings.database.getApplicationByName.calledWith(self.appName));
        done();
      });
    });

    it('getByName missing', function(done) {
      this.registry.getByName('missing-name', function(err, app) {
        if (err) return done(err);

        assert.isNull(app);
        done();
      });
    });
  });

  it('env specific urls', function(done) {
    var environments = ['production', 'test', 'dev'];
    var registry = appRegistry(_.extend(this.settings, {
      visitApp: function(virtualApp) {
        virtualApp.environments = environments;
      }
    }));

    var appId = shortid.generate();
    this.database.apps.push({appId: appId, name: 'test-site', requireSsl: true});

    registry.getById(appId, function(err, app) {
      assert.noDifferences(_.keys(app.urls), environments);
      assert.equal(app.urls.production, 'https://test-site.apphost.com');
      assert.equal(app.urls.test, 'https://test-site--test.apphost.com');
      assert.equal(app.urls.dev, 'https://test-site--dev.apphost.com');
      done();
    });
  });

  it('env specific urls with legacy custom domain', function(done) {
    var domain = {
      action: 'resolve',
      domain: 'site.market.net'
    };

    var environments = ['production', 'test', 'dev'];
    var registry = appRegistry(_.extend(this.settings, {
      visitApp: function(virtualApp) {
        virtualApp.environments = environments;
      }
    }));

    var appId = shortid.generate();
    this.database.apps.push({
      appId: appId,
      name: 'market',
      requireSsl: true,
      legacyDomains: [domain]
    });

    registry.getById(appId, function(err, app) {
      assert.noDifferences(_.keys(app.urls), environments);
      assert.equal(app.urls.production, 'https://site.market.net');
      assert.equal(app.urls.test, 'https://site--test.market.net');
      assert.equal(app.urls.dev, 'https://site--dev.market.net');
      done();
    });
  });

  describe('fallback database', function() {
    beforeEach(function() {
      this.appId = shortid.generate();
      this._fallbackDatabase = {
        apps: [],
        domains: []
      };

      this.settings.database.getAppByDomainName = sinon.spy(
        function(dn, sd, callback) {
          callback(null, null);
        });

      this.settings.database.getLegacyDomain = sinon.spy(
        function(dn, callback) { callback(null, null); }
      );

      this.settings.databaseFallback = self.databaseFallback = mockDatabase(this._fallbackDatabase);
      this.registry = appRegistry(this.settings);
    });

    it('gets app by name', function(done) {
      var appName = 'appname';
      this._fallbackDatabase.apps.push({appId: this.appId, name: appName});

      this.registry.getByName(appName, function(err, app) {
        assert.isTrue(self.settings.database.getApplicationByName.calledWith(appName));
        assert.isTrue(self.settings.databaseFallback.getApplicationByName.calledWith(appName));
        assert.equal(app.name, appName);
        done();
      });
    });

    it('gets app by domain name', function(done) {
      var domainName = 'domain.com';
      var subDomain = 'www';

      this.settings.databaseFallback.getAppByDomainName = sinon.spy(
        function(dn, sd, callback) {
          callback(null, {appId: self.appId, domainName, subDomain});
        });

      this.registry.getByDomain(domainName, subDomain, function(err, app) {
        assert.isTrue(self.settings.database.getAppByDomainName.calledWith(domainName, subDomain));
        assert.isTrue(self.settings.database.getLegacyDomain.calledWith(
          subDomain + '.' + domainName));
        assert.isTrue(self.databaseFallback.getAppByDomainName.calledWith(domainName, subDomain));
        assert.isMatch(app, {appId: self.appId, domainName, subDomain});

        done();
      });
    });

    it('get app by legacy domain', function(done) {
      var domainName = 'domain.com';
      var subDomain = 'www';

      this.databaseFallback.getAppByDomainName = sinon.spy(
        function(dn, sd, callback) { callback(null, null); }
      );

      this.settings.databaseFallback.getLegacyDomain = sinon.spy(
        function(dn, callback) {
          callback(null, {appId: self.appId, domainName, subDomain});
        });

      this.databaseFallback.getApplication = sinon.spy(function(appId, callback) {
        callback(null, {appId});
      });

      this.registry.getByDomain(domainName, subDomain, function(err, app) {
        if (err) return done(err);

        assert.isTrue(self.settings.database.getAppByDomainName.calledWith(
          domainName, subDomain));
        assert.isTrue(self.settings.database.getLegacyDomain.calledWith(
          subDomain + '.' + domainName));
        assert.isTrue(self.databaseFallback.getAppByDomainName.calledWith(
          domainName, subDomain));

        assert.isTrue(self.databaseFallback.getLegacyDomain.calledWith(
          subDomain + '.' + domainName));

        assert.isTrue(self.databaseFallback.getApplication.calledWith(self.appId));

        assert.ok(app);
        assert.isMatch(app, {appId: self.appId});

        done();
      });
    });
  });
});
