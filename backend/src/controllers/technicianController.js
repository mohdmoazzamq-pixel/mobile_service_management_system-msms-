const bcrypt = require('bcryptjs');
const { getClient, query } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

async function listTechnicians(req, res, next) {
  try {
    const techRes = await query(`
      SELECT t.id, t.user_id, t.specialization, t.experience_years, t.joining_date, t.availability,
             u.name, u.email, u.phone, u.is_active,
             COUNT(r.id) FILTER (WHERE r.repair_status NOT IN ('REPAIR_COMPLETED', 'DELIVERED')) AS active_jobs,
             COUNT(r.id) FILTER (WHERE r.repair_status = 'REPAIR_COMPLETED') AS completed_jobs
      FROM technicians t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN repairs r ON r.technician_id = t.id
      GROUP BY t.id, u.id
      ORDER BY t.availability ASC, u.name ASC
    `);

    return sendSuccess(res, techRes.rows, 'Technicians retrieved');
  } catch (error) {
    next(error);
  }
}

async function createTechnician(req, res, next) {
  const { name, email, phone, password, specialization, experienceYears, joiningDate, availability } = req.body;
  const client = await getClient();

  try {
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      client.release();
      return sendError(res, 'Email address is already in use', 409);
    }

    await client.query('BEGIN');

    const rawPassword = password || 'Technician123!';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(rawPassword, salt);

    const userRes = await client.query(
      `INSERT INTO users (name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, 'technician')
       RETURNING id, name, email, phone, role`,
      [name, email, phone || null, passwordHash]
    );

    const newUser = userRes.rows[0];

    const techRes = await client.query(
      `INSERT INTO technicians (user_id, specialization, experience_years, joining_date, availability)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, specialization, experience_years, joining_date, availability`,
      [
        newUser.id,
        specialization || 'General Hardware & Diagnostics',
        parseInt(experienceYears) || 0,
        joiningDate || new Date().toISOString().slice(0, 10),
        availability || 'AVAILABLE'
      ]
    );

    await client.query('COMMIT');
    client.release();

    return sendSuccess(
      res,
      {
        technician: {
          ...techRes.rows[0],
          user_id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone
        }
      },
      'Technician created successfully',
      201
    );
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    next(error);
  }
}

async function updateAvailability(req, res, next) {
  try {
    const { id } = req.params;
    const { availability } = req.body;

    if (!['AVAILABLE', 'BUSY', 'INACTIVE'].includes(availability)) {
      return sendError(res, 'Invalid availability status. Must be AVAILABLE, BUSY, or INACTIVE', 400);
    }

    // If technician is updating, verify they own this record
    if (req.user.role === 'technician' && req.user.technician_id !== parseInt(id)) {
      return sendError(res, 'You can only update your own availability status', 403);
    }

    const result = await query(
      `UPDATE technicians SET availability = $1 WHERE id = $2 RETURNING *`,
      [availability, id]
    );

    if (result.rowCount === 0) {
      return sendError(res, 'Technician not found', 404);
    }

    return sendSuccess(res, result.rows[0], 'Availability updated');
  } catch (error) {
    next(error);
  }
}

async function getAssignedJobs(req, res, next) {
  try {
    const technicianId = req.user.technician_id;
    if (!technicianId) {
      return sendError(res, 'Technician profile not found for current user', 403);
    }

    const jobs = await query(`
      SELECT r.id, r.booking_id, r.technician_id, r.diagnosis, r.estimated_cost, r.final_cost,
             r.estimated_completion, r.actual_completion, r.repair_status, r.created_at,
             b.booking_number, b.problem_category, b.problem_description, b.preferred_date,
             d.brand, d.model, d.imei, d.serial_number,
             u.name AS customer_name, u.phone AS customer_phone, u.email AS customer_email,
             s.service_name, s.base_price AS service_base_price
      FROM repairs r
      JOIN bookings b ON r.booking_id = b.id
      JOIN customers c ON b.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      JOIN devices d ON b.device_id = d.id
      LEFT JOIN services s ON b.service_id = s.id
      WHERE r.technician_id = $1
      ORDER BY 
        CASE 
          WHEN r.repair_status IN ('DEVICE_RECEIVED', 'UNDER_DIAGNOSIS', 'WAITING_FOR_SPARE_PARTS', 'REPAIR_IN_PROGRESS') THEN 1
          ELSE 2
        END,
        r.created_at DESC
    `, [technicianId]);

    return sendSuccess(res, jobs.rows, 'Assigned jobs retrieved');
  } catch (error) {
    next(error);
  }
}

async function toggleTechnicianActive(req, res, next) {
  const { id } = req.params;
  const client = await getClient();

  try {
    const techRes = await client.query('SELECT user_id, availability FROM technicians WHERE id = $1', [id]);
    if (techRes.rowCount === 0) {
      client.release();
      return sendError(res, 'Technician not found', 404);
    }

    const { user_id, availability } = techRes.rows[0];

    await client.query('BEGIN');

    // Toggle user active
    const userRes = await client.query(
      `UPDATE users
       SET is_active = NOT is_active,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING is_active`,
      [user_id]
    );

    const newActiveState = userRes.rows[0].is_active;

    // If deactivated, update availability to INACTIVE; if reactivated, set AVAILABLE
    const newAvail = newActiveState ? 'AVAILABLE' : 'INACTIVE';
    await client.query('UPDATE technicians SET availability = $1 WHERE id = $2', [newAvail, id]);

    await client.query('COMMIT');
    client.release();

    return sendSuccess(res, { id, is_active: newActiveState, availability: newAvail }, `Technician account ${newActiveState ? 'activated' : 'deactivated'}`);
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    next(error);
  }
}

module.exports = {
  listTechnicians,
  createTechnician,
  updateAvailability,
  getAssignedJobs,
  toggleTechnicianActive
};
