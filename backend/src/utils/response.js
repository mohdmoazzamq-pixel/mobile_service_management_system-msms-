/**
 * Standard JSON API response helpers
 * Follows MSMS Document Section 9.2 Standard Response Format
 */

function sendSuccess(res, data = null, message = 'Operation completed', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    message
  });
}

function sendError(res, message = 'An error occurred', statusCode = 500, errors = null) {
  const payload = {
    success: false,
    message
  };

  if (errors && Array.isArray(errors) && errors.length > 0) {
    payload.errors = errors;
  } else if (errors) {
    payload.errors = [errors];
  }

  return res.status(statusCode).json(payload);
}

module.exports = {
  sendSuccess,
  sendError
};
