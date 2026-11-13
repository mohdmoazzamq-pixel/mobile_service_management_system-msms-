const { verifyToken } = require('../utils/jwt');
const { sendError } = require('../utils/response');
const { query } = require('../config/database');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authentication token required', 401);
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return sendError(res, 'Invalid or expired token', 401);
    }

    // Verify user exists and is active in database
    const userRes = await query(
      'SELECT id, name, email, role, is_active FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userRes.rowCount === 0) {
      return sendError(res, 'User account not found', 401);
    }

    const user = userRes.rows[0];
    if (!user.is_active) {
      return sendError(res, 'Account has been deactivated', 403);
    }

    req.user = user;

    // Attach profile IDs if customer or technician
    if (user.role === 'customer') {
      const custRes = await query('SELECT id FROM customers WHERE user_id = $1', [user.id]);
      req.user.customer_id = custRes.rowCount > 0 ? custRes.rows[0].id : null;
    } else if (user.role === 'technician') {
      const techRes = await query('SELECT id FROM technicians WHERE user_id = $1', [user.id]);
      req.user.technician_id = techRes.rowCount > 0 ? techRes.rows[0].id : null;
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return sendError(res, 'Authentication verification failed', 500);
  }
}

module.exports = authenticate;
