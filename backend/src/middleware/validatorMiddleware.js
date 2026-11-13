const { validationResult } = require('express-validator');
const { sendError } = require('../utils/response');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg
    }));
    return sendError(res, 'Validation failed', 422, formatted);
  }
  next();
}

module.exports = validate;
