
module.exports = function(req, res, next) {
  if (req.protocol === 'https') return next();

  // Monkeypatch the req.protocol getter with custom logic that
  // recognizes the cloud front header. For some reason requests
  // to https://appname.aerobatic.io do not have X-Forwarded-Proto set
  // to https, but requests to https://aerobatic.io do. But the
  // cloudfront-forwarded-proto is https.
  if (req.get('cloudfront-forwarded-proto') === 'https') {
    Object.defineProperty(req, 'protocol', {
      get: function() {
        return 'https';
      }
    });
  }

  next();
};
