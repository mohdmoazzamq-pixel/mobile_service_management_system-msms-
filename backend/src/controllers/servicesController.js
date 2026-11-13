const { query } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

async function listServices(req, res, next) {
  try {
    const isAdmin = req.user && req.user.role === 'admin';
    const sql = isAdmin && req.query.all === 'true'
      ? 'SELECT * FROM services ORDER BY service_name ASC'
      : 'SELECT * FROM services WHERE is_active = true ORDER BY service_name ASC';

    const result = await query(sql);
    return sendSuccess(res, result.rows, 'Services retrieved');
  } catch (error) {
    next(error);
  }
}

async function createService(req, res, next) {
  const { serviceName, description, basePrice, isActive } = req.body;

  try {
    if (!serviceName || !serviceName.trim()) {
      return sendError(res, 'Service name is required', 400);
    }

    const price = parseFloat(basePrice) || 0;
    if (price < 0) {
      return sendError(res, 'Base price cannot be negative', 400);
    }

    const result = await query(
      `INSERT INTO services (service_name, description, base_price, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [serviceName.trim(), description || null, price, isActive !== undefined ? isActive : true]
    );

    return sendSuccess(res, result.rows[0], 'Service created successfully', 201);
  } catch (error) {
    if (error.code === '23505') {
      return sendError(res, 'A service with this name already exists', 409);
    }
    next(error);
  }
}

async function updateService(req, res, next) {
  const { id } = req.params;
  const { serviceName, description, basePrice, isActive } = req.body;

  try {
    const current = await query('SELECT * FROM services WHERE id = $1', [id]);
    if (current.rowCount === 0) {
      return sendError(res, 'Service not found', 404);
    }

    const updated = await query(
      `UPDATE services 
       SET service_name = COALESCE($1, service_name),
           description = COALESCE($2, description),
           base_price = COALESCE($3, base_price),
           is_active = COALESCE($4, is_active)
       WHERE id = $5
       RETURNING *`,
      [
        serviceName ? serviceName.trim() : null,
        description !== undefined ? description : null,
        basePrice !== undefined ? parseFloat(basePrice) : null,
        isActive !== undefined ? isActive : null,
        id
      ]
    );

    return sendSuccess(res, updated.rows[0], 'Service updated successfully');
  } catch (error) {
    if (error.code === '23505') {
      return sendError(res, 'A service with this name already exists', 409);
    }
    next(error);
  }
}

async function deleteService(req, res, next) {
  const { id } = req.params;

  try {
    const serviceRes = await query('SELECT id, service_name FROM services WHERE id = $1', [id]);
    if (serviceRes.rowCount === 0) {
      return sendError(res, 'Service not found', 404);
    }

    // Check if bookings exist using this service
    const bookingRes = await query('SELECT id FROM bookings WHERE service_id = $1 LIMIT 1', [id]);
    if (bookingRes.rowCount > 0) {
      // Soft-deactivate if bookings exist
      await query('UPDATE services SET is_active = false WHERE id = $1', [id]);
      return sendSuccess(res, { id, is_active: false }, 'Service deactivated because past bookings reference it.');
    }

    await query('DELETE FROM services WHERE id = $1', [id]);
    return sendSuccess(res, { id }, 'Service removed successfully');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listServices,
  createService,
  updateService,
  deleteService
};
