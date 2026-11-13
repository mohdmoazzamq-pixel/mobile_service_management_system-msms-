const { query } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

async function listDevices(req, res, next) {
  try {
    let sql = `
      SELECT d.id, d.customer_id, d.brand, d.model, d.imei, d.serial_number, d.created_at,
             u.name AS owner_name, u.email AS owner_email,
             COUNT(b.id) AS booking_count
      FROM devices d
      JOIN customers c ON d.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      LEFT JOIN bookings b ON b.device_id = d.id
    `;
    const params = [];

    if (req.user.role === 'customer') {
      sql += ' WHERE d.customer_id = $1';
      params.push(req.user.customer_id);
    } else if (req.query.customerId) {
      sql += ' WHERE d.customer_id = $1';
      params.push(req.query.customerId);
    }

    sql += ' GROUP BY d.id, u.name, u.email ORDER BY d.created_at DESC';

    const result = await query(sql, params);
    return sendSuccess(res, result.rows, 'Devices retrieved');
  } catch (error) {
    next(error);
  }
}

async function createDevice(req, res, next) {
  const { brand, model, imei, serialNumber, customerId } = req.body;

  try {
    if (!brand || !brand.trim() || !model || !model.trim()) {
      return sendError(res, 'Brand and Model are required', 400);
    }

    let targetCustomerId = req.user.customer_id;
    if (req.user.role === 'admin') {
      if (customerId) {
        targetCustomerId = customerId;
      } else {
        return sendError(res, 'customerId is required when creating device as administrator', 400);
      }
    }

    if (!targetCustomerId) {
      return sendError(res, 'Customer profile not found for this account', 400);
    }

    const cleanImei = imei && imei.trim() ? imei.trim() : null;
    if (cleanImei && (cleanImei.length < 8 || cleanImei.length > 30)) {
      return sendError(res, 'IMEI must be between 8 and 30 characters', 400);
    }

    // Check if IMEI already exists
    if (cleanImei) {
      const existing = await query('SELECT id FROM devices WHERE imei = $1', [cleanImei]);
      if (existing.rowCount > 0) {
        return sendError(res, 'A device with this IMEI is already registered', 409);
      }
    }

    const result = await query(
      `INSERT INTO devices (customer_id, brand, model, imei, serial_number)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [targetCustomerId, brand.trim(), model.trim(), cleanImei, serialNumber ? serialNumber.trim() : null]
    );

    return sendSuccess(res, result.rows[0], 'Device registered successfully', 201);
  } catch (error) {
    if (error.code === '23505') {
      return sendError(res, 'A device with this IMEI is already registered', 409);
    }
    next(error);
  }
}

async function getDeviceById(req, res, next) {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT d.*, u.name AS owner_name, u.email AS owner_email
      FROM devices d
      JOIN customers c ON d.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE d.id = $1
    `, [id]);

    if (result.rowCount === 0) {
      return sendError(res, 'Device not found', 404);
    }

    const device = result.rows[0];

    // Ownership check for customer
    if (req.user.role === 'customer' && device.customer_id !== req.user.customer_id) {
      return sendError(res, 'Access denied. You do not own this device record.', 403);
    }

    return sendSuccess(res, device, 'Device retrieved');
  } catch (error) {
    next(error);
  }
}

async function updateDevice(req, res, next) {
  try {
    const { id } = req.params;
    const { brand, model, serialNumber } = req.body;

    const deviceRes = await query('SELECT * FROM devices WHERE id = $1', [id]);
    if (deviceRes.rowCount === 0) {
      return sendError(res, 'Device not found', 404);
    }

    const device = deviceRes.rows[0];
    if (req.user.role === 'customer' && device.customer_id !== req.user.customer_id) {
      return sendError(res, 'Access denied. You do not own this device.', 403);
    }

    const updated = await query(
      `UPDATE devices
       SET brand = COALESCE($1, brand),
           model = COALESCE($2, model),
           serial_number = COALESCE($3, serial_number)
       WHERE id = $4
       RETURNING *`,
      [brand ? brand.trim() : null, model ? model.trim() : null, serialNumber !== undefined ? serialNumber : null, id]
    );

    return sendSuccess(res, updated.rows[0], 'Device details updated');
  } catch (error) {
    next(error);
  }
}

async function deleteDevice(req, res, next) {
  try {
    const { id } = req.params;

    const deviceRes = await query('SELECT * FROM devices WHERE id = $1', [id]);
    if (deviceRes.rowCount === 0) {
      return sendError(res, 'Device not found', 404);
    }

    const device = deviceRes.rows[0];
    if (req.user.role === 'customer' && device.customer_id !== req.user.customer_id) {
      return sendError(res, 'Access denied. You do not own this device.', 403);
    }

    // Check if device has bookings
    const bookingsRes = await query('SELECT id FROM bookings WHERE device_id = $1 LIMIT 1', [id]);
    if (bookingsRes.rowCount > 0) {
      return sendError(res, 'Cannot delete device because it is associated with existing repair bookings.', 400);
    }

    await query('DELETE FROM devices WHERE id = $1', [id]);
    return sendSuccess(res, { id }, 'Device removed successfully');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listDevices,
  createDevice,
  getDeviceById,
  updateDevice,
  deleteDevice
};
