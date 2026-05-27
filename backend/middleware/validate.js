const ApiError = require('../utils/ApiError');

// Generic body validator. Pass a function that takes req.body and returns
// { valid: boolean, error?: string }. Replace with zod / joi once a schema lib is chosen.
function validate(check) {
  return (req, _res, next) => {
    const result = check(req.body);
    if (!result.valid) {
      return next(new ApiError(400, result.error || 'Invalid request body'));
    }
    next();
  };
}

module.exports = validate;
