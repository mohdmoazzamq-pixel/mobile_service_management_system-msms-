const { sendError } = require('../utils/response');

function errorHandler(err, req, res, next) {
  console.error('Unhandled Server Error:', err);

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 'File size exceeds maximum allowed limit of 5MB', 400);
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return sendError(res, 'Too many files uploaded (maximum 5)', 400);
    }
    return sendError(res, err.message, 400);
  }

  if (err.message && err.message.includes('Invalid file type')) {
    return sendError(res, err.message, 400);
  }

  const statusCode = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : (err.message || 'Internal server error');

  return sendError(res, message, statusCode);
}

module.exports = errorHandler;
