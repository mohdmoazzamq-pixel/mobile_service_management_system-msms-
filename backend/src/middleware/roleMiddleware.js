const { sendError } = require('../utils/response');

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Authentication required', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(
        res,
        `Access denied. Requires one of: ${allowedRoles.join(', ')}`,
        403
      );
    }

    next();
  };
}

module.exports = authorize;
