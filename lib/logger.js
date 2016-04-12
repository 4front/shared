var _ = require('lodash');
var winston = require('winston');
var debug = require('debug')('4front:shared:logger');

require('simple-errors');

module.exports = function(options) {
  // Per 12 factor app conventions, by default
  // stream logs directly to stdout and stderr
  options = _.defaults(options || {}, {
    loggerName: '4front-logger',
    requestIdHeader: 'x-request-id',
    awsRegion: process.env.AWS_DEFAULT_REGION,
    awsProfile: process.env.AWS_DEFAULT_PROFILE,

    nodeModulesRe: /\/node_modules\/([a-z\-_0-9]+)\//,
    // match a line in a core node file. Key is the leading open paren "(main.js" without a file path.
    coreFileRe: /\([a-z\-_0-9]+\.js/,
    nodeModulesWhitelist: [/^4front\-/, /htmlprep/, /express-request-proxy/],
    // match a line in a core node file. Key is the leading open paren "(main.js" without a file path.
    transports: [
      new (winston.transports.Console)({
        json: true,
        timestamp: true
      })
    ]
  });

  var logger = new (winston.Logger)({
    transports: options.transports
  });

  return {
    debug: function() {
      return logger.debug.apply(logger, arguments);
    },
    info: function() {
      return logger.info.apply(logger, arguments);
    },
    warn: function() {
      return logger.warn.apply(logger, arguments);
    },
    error: function(err) {
      if (err.log === false) return;

      if (err.stack) {
        err.stack = formatStack(err.stack);
      } else {
        err.stack = null;
      }

      var errorJson;
      if (_.isError(err)) {
        errorJson = Error.toJson(err);
      } else if (_.isObject(err)) {
        errorJson = err;
      }

      if (errorJson) {
        // Use the Error message property as the bunyan
        logger.error(errorJson.message, _.omit(errorJson, 'message'));
      } else {
        logger.error.apply(logger, arguments);
      }
    }
  };

  function formatStack(stack) {
    var stackLines = [];

    if (_.isEmpty(stack)) return [];

    var originalLines;
    if (_.isString(stack)) {
      originalLines = stack.split('\n');
    } else if (_.isArray(stack)) {
      originalLines = stack;
    } else {
      return null;
    }

    for (var i = 0; i < originalLines.length; i++) {
      var line = originalLines[i];

      // Filter lines out of the stack trace from /node_modules/ unless they match
      // pattern of ones to keep.
      if (options.coreFileRe.test(line)) {
        continue;
      }

      // Filter out lines that are just a dash seperator
      if (_.startsWith(line, '----------')) continue;

      var nodeModulesMatch = line.match(options.nodeModulesRe);
      if (nodeModulesMatch) {
        var whitelisted = whitelistedModule(nodeModulesMatch[1]);
        if (!whitelisted) continue;

        // Check if this is actually a nested node_nodule of the whitelisted module.
        // nodeModulesMatch.
        if (line.substr(line.indexOf(nodeModulesMatch[0]) + nodeModulesMatch[0].length, 12) === 'node_modules') {
          continue;
        }
      }

      // Strip the appBaseDir off the file path
      if (options.baseDir) {
        line = line.replace(options.baseDir, '');
      }

      stackLines.push(line.trim());
    }

    // Need to join lines up with newline as the
    // Error.toJson will resplit the stack
    return stackLines.join('\n');
  }

  function whitelistedModule(moduleName) {
    return _.any(options.nodeModulesWhitelist, function(pattern) {
      return pattern.test(moduleName);
    });
  }
};
