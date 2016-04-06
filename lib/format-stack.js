
var _ = require('lodash');

var options = {
  nodeModulesRe: /\/node_modules\/([a-z\-_0-9]+)\//,
  // match a line in a core node file. Key is the leading open paren "(main.js" without a file path.
  coreFileRe: /\([a-z\-_0-9]+\.js/,
  nodeModulesWhitelist: [/^4front\-/, /htmlprep/, /express-request-proxy/]
};

function whitelistedModule(moduleName) {
  return _.any(options.nodeModulesWhitelist, function(pattern) {
    return pattern.test(moduleName);
  });
}

// Format error stack trace for logging and output
module.exports = function(stack, baseDir) {
  var stackLines = [];

  if (_.isEmpty(stack)) return '';

  var originalLines = stack.split('\n');
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

    // Strip the baseDir off the file path
    if (baseDir) {
      line = line.replace(baseDir, '');
    }

    stackLines.push(line.trim());
  }

  return stackLines.join('\n');
};
