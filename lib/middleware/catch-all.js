require('simple-errors');

module.exports = function(settings) {
  return function(req, res, next) {
    // If we fell all the way through to this point, raise a 404 error
    next(Error.http(404, 'Page not found'));
  };
};
