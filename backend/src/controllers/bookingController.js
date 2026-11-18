const { getClient, query } = require('../config/database');
const { generateBookingNumber } = require('../utils/generators');
const { sendSuccess, sendError } = require('../utils/response');

async function listBookings(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const search = req.query.search ? `%${req.query.search.trim()}%` : null;

    let baseQuery = `
      FROM bookings b
      JOIN customers c ON b.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      JOIN devices d ON b.device_id = d.id
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN repairs r ON r.booking_id = b.id
      LEFT JOIN technicians t ON r.technician_id = t.id
      LEFT JOIN users tu ON t.user_id = tu.id
    `;

    const whereClauses = [];
    const params = [];

    // Role-based restrictions
    if (req.user.role === 'customer') {
      params.push(req.user.customer_id);
      whereClauses.push(`b.customer_id = $${params.length}`);
    } else if (req.user.role === 'technician') {
      params.push(req.user.technician_id);
      whereClauses.push(`r.technician_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      whereClauses.push(`b.booking_status = $${params.length}`);
    }

    if (search) {
      params.push(search);
      whereClauses.push(`(b.booking_number ILIKE $${params.length} OR u.name ILIKE $${params.length} OR d.model ILIKE $${params.length})`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS total ${baseQuery} ${whereSql}`;
    const dataSql = `
      SELECT b.id, b.booking_number, b.customer_id, b.device_id, b.service_id,
             b.problem_category, b.problem_description, b.preferred_date, b.booking_status, b.created_at,
             u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
             d.brand, d.model, d.imei,
             s.service_name, s.base_price AS service_base_price,
             r.id AS repair_id, r.repair_status, r.technician_id,
             tu.name AS technician_name
      ${baseQuery}
      ${whereSql}
      ORDER BY b.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const [countRes, dataRes] = await Promise.all([
      query(countSql, params),
      query(dataSql, [...params, limit, offset])
    ]);

    const total = parseInt(countRes.rows[0].total);

    return sendSuccess(res, {
      bookings: dataRes.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }, 'Bookings retrieved');
  } catch (error) {
    next(error);
  }
}

async function createBooking(req, res, next) {
  const { deviceId, serviceId, problemCategory, problemDescription, preferredDate } = req.body;
  const client = await getClient();

  try {
    const customerId = req.user.role === 'customer' 
      ? req.user.customer_id 
      : (req.body.customerId || req.user.customer_id);

    if (!customerId) {
      client.release();
      return sendError(res, 'Customer profile is required to book a repair', 400);
    }

    // Crucial Business Rule (Section 7.6 / 9.4 / TC-06):
    // Verify that the target device is actually owned by this customer
    const deviceCheck = await client.query(
      'SELECT id, customer_id FROM devices WHERE id = $1',
      [deviceId]
    );

    if (deviceCheck.rowCount === 0) {
      client.release();
      return sendError(res, 'Device not found', 404);
    }

    if (String(deviceCheck.rows[0].customer_id) !== String(customerId) && req.user.role !== 'admin') {
      client.release();
      return sendError(res, 'Access denied. You do not own this device.', 403);
    }

    // Verify service if provided
    if (serviceId) {
      const sCheck = await client.query('SELECT id, is_active FROM services WHERE id = $1', [serviceId]);
      if (sCheck.rowCount === 0) {
        client.release();
        return sendError(res, 'Service not found', 404);
      }
    }

    await client.query('BEGIN');

    const bookingNumber = generateBookingNumber();

    const bookingRes = await client.query(
      `INSERT INTO bookings (
         booking_number, customer_id, device_id, service_id,
         problem_category, problem_description, preferred_date, booking_status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
       RETURNING *`,
      [
        bookingNumber,
        customerId,
        deviceId,
        serviceId || null,
        problemCategory,
        problemDescription,
        preferredDate || null
      ]
    );

    const newBooking = bookingRes.rows[0];

    // Handle uploaded images if any
    const imagePaths = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      for (const file of req.files) {
        const relativePath = `uploads/${file.filename}`;
        await client.query(
          'INSERT INTO booking_images (booking_id, image_path) VALUES ($1, $2)',
          [newBooking.id, relativePath]
        );
        imagePaths.push(relativePath);
      }
    }

    await client.query('COMMIT');
    client.release();

    newBooking.images = imagePaths;

    return sendSuccess(res, newBooking, 'Repair booking created successfully', 201);
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    next(error);
  }
}

async function getBookingById(req, res, next) {
  try {
    const { id } = req.params;

    const bookingRes = await query(`
      SELECT b.*,
             u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
             c.address AS customer_address, c.city AS customer_city,
             d.brand, d.model, d.imei, d.serial_number,
             s.service_name, s.base_price AS service_base_price,
             r.id AS repair_id, r.repair_status, r.technician_id, r.diagnosis,
             r.estimated_cost, r.final_cost, r.estimated_completion, r.actual_completion,
             tu.name AS technician_name, tu.email AS technician_email, tu.phone AS technician_phone
      FROM bookings b
      JOIN customers c ON b.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      JOIN devices d ON b.device_id = d.id
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN repairs r ON r.booking_id = b.id
      LEFT JOIN technicians t ON r.technician_id = t.id
      LEFT JOIN users tu ON t.user_id = tu.id
      WHERE b.id = $1
    `, [id]);

    if (bookingRes.rowCount === 0) {
      return sendError(res, 'Booking not found', 404);
    }

    const booking = bookingRes.rows[0];

    // Customer can only view own booking
    if (req.user.role === 'customer' && String(booking.customer_id) !== String(req.user.customer_id)) {
      return sendError(res, 'Access denied. You do not own this booking.', 403);
    }

    // Technician can only view assigned booking
    if (req.user.role === 'technician' && String(booking.technician_id) !== String(req.user.technician_id)) {
      return sendError(res, 'Access denied. You are not assigned to this repair.', 403);
    }

    // Fetch images
    const imagesRes = await query(
      'SELECT id, image_path, uploaded_at FROM booking_images WHERE booking_id = $1 ORDER BY uploaded_at ASC',
      [id]
    );
    booking.images = imagesRes.rows;

    return sendSuccess(res, booking, 'Booking details retrieved');
  } catch (error) {
    next(error);
  }
}

async function decideBooking(req, res, next) {
  const { id } = req.params;
  const { decision } = req.body;
  const client = await getClient();

  try {
    const bookingRes = await client.query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (bookingRes.rowCount === 0) {
      client.release();
      return sendError(res, 'Booking not found', 404);
    }

    const booking = bookingRes.rows[0];
    if (booking.booking_status !== 'PENDING') {
      client.release();
      return sendError(res, `Booking is already ${booking.booking_status}`, 400);
    }

    await client.query('BEGIN');

    // Update booking status
    await client.query(
      'UPDATE bookings SET booking_status = $1 WHERE id = $2',
      [decision, id]
    );

    let repairRecord = null;

    // Per Section 4.3 / 7.6 / TC-07:
    // If APPROVED, create the initial repair record and repair_status_history
    if (decision === 'APPROVED') {
      const repRes = await client.query(
        `INSERT INTO repairs (booking_id, repair_status)
         VALUES ($1, 'DEVICE_RECEIVED')
         RETURNING *`,
        [id]
      );
      repairRecord = repRes.rows[0];

      await client.query(
        `INSERT INTO repair_status_history (repair_id, old_status, new_status, updated_by, remarks)
         VALUES ($1, NULL, 'DEVICE_RECEIVED', $2, 'Booking approved by administrator. Device received for processing.')`,
        [repairRecord.id, req.user.id]
      );
    }

    await client.query('COMMIT');
    client.release();

    return sendSuccess(
      res,
      {
        bookingId: id,
        status: decision,
        repair: repairRecord
      },
      `Booking ${decision.toLowerCase()} successfully`
    );
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    next(error);
  }
}

async function assignTechnician(req, res, next) {
  const { id } = req.params; // booking id
  const { technicianId } = req.body;
  const client = await getClient();

  try {
    // Check technician exists and is active
    const techCheck = await client.query(
      `SELECT t.id, t.availability, u.name 
       FROM technicians t 
       JOIN users u ON t.user_id = u.id 
       WHERE t.id = $1 AND u.is_active = true`,
      [technicianId]
    );

    if (techCheck.rowCount === 0) {
      client.release();
      return sendError(res, 'Technician not found or inactive', 404);
    }

    // Find repair associated with this booking
    const repairCheck = await client.query('SELECT id, technician_id FROM repairs WHERE booking_id = $1', [id]);
    if (repairCheck.rowCount === 0) {
      client.release();
      return sendError(res, 'Repair record not found. Booking may not be approved yet.', 400);
    }

    const repair = repairCheck.rows[0];

    await client.query('BEGIN');

    // Assign technician
    const updatedRepair = await client.query(
      `UPDATE repairs 
       SET technician_id = $1 
       WHERE id = $2 
       RETURNING *`,
      [technicianId, repair.id]
    );

    // Record in history
    await client.query(
      `INSERT INTO repair_status_history (repair_id, old_status, new_status, updated_by, remarks)
       VALUES ($1, $2, $2, $3, $4)`,
      [
        repair.id,
        updatedRepair.rows[0].repair_status,
        req.user.id,
        `Technician ${techCheck.rows[0].name} assigned by administrator`
      ]
    );

    await client.query('COMMIT');
    client.release();

    return sendSuccess(
      res,
      {
        repairId: repair.id,
        technicianId,
        technicianName: techCheck.rows[0].name
      },
      'Technician assigned successfully'
    );
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    next(error);
  }
}

async function cancelBooking(req, res, next) {
  const { id } = req.params;
  const client = await getClient();

  try {
    const bookingRes = await client.query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (bookingRes.rowCount === 0) {
      client.release();
      return sendError(res, 'Booking not found', 404);
    }

    const booking = bookingRes.rows[0];

    // Customer can only cancel their own pending booking
    if (req.user.role === 'customer') {
      if (String(booking.customer_id) !== String(req.user.customer_id)) {
        client.release();
        return sendError(res, 'Access denied. You do not own this booking.', 403);
      }
      if (booking.booking_status !== 'PENDING') {
        client.release();
        return sendError(res, `Cannot cancel booking that is already ${booking.booking_status}. Please contact service support.`, 400);
      }
    }

    await client.query('BEGIN');

    await client.query('UPDATE bookings SET booking_status = \'CANCELLED\' WHERE id = $1', [id]);

    // Check if repair was created
    const repRes = await client.query('SELECT id, repair_status FROM repairs WHERE booking_id = $1', [id]);
    if (repRes.rowCount > 0) {
      const rep = repRes.rows[0];
      await client.query(
        `INSERT INTO repair_status_history (repair_id, old_status, new_status, updated_by, remarks)
         VALUES ($1, $2, 'CANCELLED', $3, 'Booking cancelled by user request')`,
        [rep.id, rep.repair_status, req.user.id]
      );
    }

    await client.query('COMMIT');
    client.release();

    return sendSuccess(res, { id, status: 'CANCELLED' }, 'Booking cancelled successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    next(error);
  }
}

async function publicTrackBooking(req, res, next) {
  try {
    const { bookingNumber } = req.params;
    if (!bookingNumber || !bookingNumber.trim()) {
      return sendError(res, 'Booking reference number is required', 400);
    }

    const result = await query(`
      SELECT b.booking_number, b.problem_category, b.booking_status, b.created_at,
             d.brand, d.model,
             s.service_name,
             r.id AS repair_id, r.repair_status, r.diagnosis, r.estimated_completion, r.actual_completion
      FROM bookings b
      JOIN devices d ON b.device_id = d.id
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN repairs r ON r.booking_id = b.id
      WHERE UPPER(b.booking_number) = UPPER($1)
    `, [bookingNumber.trim()]);

    if (result.rowCount === 0) {
      return sendError(res, `Booking reference "${bookingNumber}" was not found. Please verify and try again.`, 404);
    }

    const trackData = result.rows[0];

    // Fetch public status timeline
    if (trackData.repair_id) {
      const historyRes = await query(`
        SELECT old_status, new_status, remarks, created_at
        FROM repair_status_history
        WHERE repair_id = $1
        ORDER BY created_at ASC
      `, [trackData.repair_id]);
      trackData.timeline = historyRes.rows;
    } else {
      trackData.timeline = [];
    }

    return sendSuccess(res, trackData, 'Tracking information retrieved');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listBookings,
  createBooking,
  getBookingById,
  decideBooking,
  assignTechnician,
  cancelBooking,
  publicTrackBooking
};
