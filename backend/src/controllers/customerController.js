const bcrypt = require('bcryptjs');
const { getClient, query } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

async function listCustomers(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search.trim()}%` : null;

    let countQuery = `
      SELECT COUNT(*) AS total 
      FROM customers c 
      JOIN users u ON c.user_id = u.id
    `;
    let dataQuery = `
      SELECT c.id, c.user_id, c.address, c.city, c.created_at,
             u.name, u.email, u.phone, u.is_active,
             COUNT(DISTINCT d.id) AS device_count,
             COUNT(DISTINCT b.id) AS booking_count
      FROM customers c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN devices d ON d.customer_id = c.id
      LEFT JOIN bookings b ON b.customer_id = c.id
    `;

    const params = [];
    if (search) {
      countQuery += ` WHERE u.name ILIKE $1 OR u.email ILIKE $1 OR u.phone ILIKE $1 OR c.city ILIKE $1`;
      dataQuery += ` WHERE u.name ILIKE $1 OR u.email ILIKE $1 OR u.phone ILIKE $1 OR c.city ILIKE $1`;
      params.push(search);
    }

    dataQuery += ` GROUP BY c.id, u.id ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    const [countRes, dataRes] = await Promise.all([
      query(countQuery, params),
      query(dataQuery, [...params, limit, offset])
    ]);

    const total = parseInt(countRes.rows[0].total);

    return sendSuccess(res, {
      customers: dataRes.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }, 'Customers retrieved');
  } catch (error) {
    next(error);
  }
}

async function getCustomerById(req, res, next) {
  try {
    const { id } = req.params;

    const customerRes = await query(`
      SELECT c.id, c.user_id, c.address, c.city, c.created_at,
             u.name, u.email, u.phone, u.is_active
      FROM customers c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = $1
    `, [id]);

    if (customerRes.rowCount === 0) {
      return sendError(res, 'Customer not found', 404);
    }

    const customer = customerRes.rows[0];

    const [devicesRes, bookingsRes] = await Promise.all([
      query(`
        SELECT id, brand, model, imei, serial_number, created_at
        FROM devices
        WHERE customer_id = $1
        ORDER BY created_at DESC
      `, [id]),
      query(`
        SELECT b.id, b.booking_number, b.problem_category, b.booking_status, b.created_at,
               d.brand, d.model, s.service_name
        FROM bookings b
        JOIN devices d ON b.device_id = d.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.customer_id = $1
        ORDER BY b.created_at DESC
      `, [id])
    ]);

    customer.devices = devicesRes.rows;
    customer.bookings = bookingsRes.rows;

    return sendSuccess(res, customer, 'Customer details retrieved');
  } catch (error) {
    next(error);
  }
}

async function createCustomer(req, res, next) {
  const { name, email, phone, password, address, city } = req.body;
  const client = await getClient();

  try {
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      client.release();
      return sendError(res, 'A user with this email already exists', 409);
    }

    await client.query('BEGIN');

    const rawPassword = password || 'Customer123!';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(rawPassword, salt);

    const userRes = await client.query(
      `INSERT INTO users (name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, 'customer')
       RETURNING id, name, email, phone, role`,
      [name, email, phone || null, passwordHash]
    );

    const newUser = userRes.rows[0];

    const custRes = await client.query(
      `INSERT INTO customers (user_id, address, city)
       VALUES ($1, $2, $3)
       RETURNING id, address, city, created_at`,
      [newUser.id, address || null, city || null]
    );

    await client.query('COMMIT');
    client.release();

    return sendSuccess(
      res,
      {
        customer: {
          ...custRes.rows[0],
          user_id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone
        }
      },
      'Customer account created successfully',
      201
    );
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    next(error);
  }
}

module.exports = {
  listCustomers,
  getCustomerById,
  createCustomer
};
