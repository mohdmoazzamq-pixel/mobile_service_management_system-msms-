const { query } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

async function submitFeedback(req, res, next) {
  const { repairId, rating, comments } = req.body;

  try {
    const customerId = req.user.customer_id;
    if (!customerId) {
      return sendError(res, 'Customer profile required to submit feedback', 400);
    }

    // Verify repair belongs to this customer
    const repRes = await query(`
      SELECT r.id, r.repair_status, b.customer_id
      FROM repairs r
      JOIN bookings b ON r.booking_id = b.id
      WHERE r.id = $1
    `, [repairId]);

    if (repRes.rowCount === 0) {
      return sendError(res, 'Repair record not found', 404);
    }

    const repair = repRes.rows[0];

    if (repair.customer_id !== customerId) {
      return sendError(res, 'Access denied. You can only review repairs for your own bookings.', 403);
    }

    // Check if feedback already submitted for this repair (TC-15)
    const existing = await query('SELECT id FROM feedback WHERE repair_id = $1', [repairId]);
    if (existing.rowCount > 0) {
      return sendError(res, 'Feedback has already been submitted for this repair', 409);
    }

    const result = await query(
      `INSERT INTO feedback (customer_id, repair_id, rating, comments)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [customerId, repairId, parseInt(rating), comments ? comments.trim() : null]
    );

    return sendSuccess(res, result.rows[0], 'Thank you for your feedback!', 201);
  } catch (error) {
    if (error.code === '23505') {
      return sendError(res, 'Feedback has already been submitted for this repair', 409);
    }
    next(error);
  }
}

async function listFeedback(req, res, next) {
  try {
    const result = await query(`
      SELECT f.*,
             u.name AS customer_name,
             b.booking_number, d.brand, d.model,
             s.service_name
      FROM feedback f
      JOIN customers c ON f.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      JOIN repairs r ON f.repair_id = r.id
      JOIN bookings b ON r.booking_id = b.id
      JOIN devices d ON b.device_id = d.id
      LEFT JOIN services s ON b.service_id = s.id
      ORDER BY f.created_at DESC
      LIMIT 50
    `);

    return sendSuccess(res, result.rows, 'Feedback retrieved');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  submitFeedback,
  listFeedback
};
