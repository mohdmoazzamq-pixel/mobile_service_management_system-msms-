const { getClient, query } = require('../config/database');
const { generateInvoiceNumber } = require('../utils/generators');
const { sendSuccess, sendError } = require('../utils/response');

async function listInvoices(req, res, next) {
  try {
    let sql = `
      SELECT inv.*,
             u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
             b.booking_number, d.brand, d.model,
             r.repair_status
      FROM invoices inv
      JOIN customers c ON inv.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      JOIN repairs r ON inv.repair_id = r.id
      JOIN bookings b ON r.booking_id = b.id
      JOIN devices d ON b.device_id = d.id
    `;
    const params = [];

    if (req.user.role === 'customer') {
      params.push(req.user.customer_id);
      sql += ' WHERE inv.customer_id = $1';
    }

    sql += ' ORDER BY inv.created_at DESC';

    const result = await query(sql, params);
    return sendSuccess(res, result.rows, 'Invoices retrieved');
  } catch (error) {
    next(error);
  }
}

async function getInvoiceById(req, res, next) {
  try {
    const { id } = req.params;

    const invoiceRes = await query(`
      SELECT inv.*,
             u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
             c.address AS customer_address, c.city AS customer_city,
             b.booking_number, b.problem_category, b.problem_description,
             d.brand, d.model, d.imei, d.serial_number,
             s.service_name, s.base_price AS service_base_price,
             r.repair_status, r.diagnosis,
             tu.name AS technician_name
      FROM invoices inv
      JOIN customers c ON inv.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      JOIN repairs r ON inv.repair_id = r.id
      JOIN bookings b ON r.booking_id = b.id
      JOIN devices d ON b.device_id = d.id
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN technicians t ON r.technician_id = t.id
      LEFT JOIN users tu ON t.user_id = tu.id
      WHERE inv.id = $1
    `, [id]);

    if (invoiceRes.rowCount === 0) {
      return sendError(res, 'Invoice not found', 404);
    }

    const invoice = invoiceRes.rows[0];

    // Crucial Security Rule (Section 4.3 / 10 / TC-13):
    // Customer requests another customer's invoice -> request is denied with 403
    if (req.user.role === 'customer' && invoice.customer_id !== req.user.customer_id) {
      return sendError(res, 'Access denied. You do not have permission to view this invoice.', 403);
    }

    // Fetch line items (parts used)
    const partsRes = await query(`
      SELECT rp.id, rp.quantity, rp.unit_price, (rp.quantity * rp.unit_price) AS line_total,
             sp.part_name, sp.part_code
      FROM repair_parts rp
      JOIN spare_parts sp ON rp.part_id = sp.id
      WHERE rp.repair_id = $1
      ORDER BY rp.used_at ASC
    `, [invoice.repair_id]);

    invoice.parts = partsRes.rows;

    return sendSuccess(res, invoice, 'Invoice retrieved');
  } catch (error) {
    next(error);
  }
}

async function createInvoice(req, res, next) {
  const { repairId, taxAmount, discount, paymentStatus, paymentMethod } = req.body;
  const client = await getClient();

  try {
    // Check if invoice already exists for this repair
    const existing = await client.query('SELECT id FROM invoices WHERE repair_id = $1', [repairId]);
    if (existing.rowCount > 0) {
      client.release();
      return sendError(res, 'An invoice has already been generated for this repair', 409);
    }

    // Get repair and booking details
    const repRes = await client.query(`
      SELECT r.id, r.booking_id, r.repair_status,
             b.customer_id, b.service_id,
             COALESCE(s.base_price, 0) AS service_base_price
      FROM repairs r
      JOIN bookings b ON r.booking_id = b.id
      LEFT JOIN services s ON b.service_id = s.id
      WHERE r.id = $1
    `, [repairId]);

    if (repRes.rowCount === 0) {
      client.release();
      return sendError(res, 'Repair record not found', 404);
    }

    const repair = repRes.rows[0];

    // Calculate line items for parts
    const partsRes = await client.query(`
      SELECT SUM(quantity * unit_price) AS parts_total
      FROM repair_parts
      WHERE repair_id = $1
    `, [repairId]);

    const partsTotal = parseFloat(partsRes.rows[0].parts_total || 0);
    const servicePrice = parseFloat(repair.service_base_price || 0);

    // Section 4.3 / 7.6: Server-side calculation
    const subtotal = parseFloat((servicePrice + partsTotal).toFixed(2));
    const tax = parseFloat((parseFloat(taxAmount) || 0).toFixed(2));
    const disc = parseFloat((parseFloat(discount) || 0).toFixed(2));
    const totalAmount = parseFloat((subtotal + tax - disc).toFixed(2));

    if (totalAmount < 0) {
      client.release();
      return sendError(res, 'Total amount cannot be negative. Discount exceeds subtotal.', 400);
    }

    await client.query('BEGIN');

    const invoiceNumber = generateInvoiceNumber();

    const invRes = await client.query(
      `INSERT INTO invoices (
         invoice_number, repair_id, customer_id, subtotal, tax_amount, discount,
         total_amount, payment_status, payment_method
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        invoiceNumber,
        repairId,
        repair.customer_id,
        subtotal,
        tax,
        disc,
        totalAmount,
        paymentStatus || 'UNPAID',
        paymentMethod || 'CASH'
      ]
    );

    // Update repair final_cost
    await client.query(
      'UPDATE repairs SET final_cost = $1 WHERE id = $2',
      [totalAmount, repairId]
    );

    await client.query('COMMIT');
    client.release();

    return sendSuccess(res, invRes.rows[0], 'Invoice generated successfully', 201);
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    next(error);
  }
}

async function updatePaymentStatus(req, res, next) {
  const { id } = req.params;
  const { paymentStatus, paymentMethod } = req.body;

  try {
    const result = await query(
      `UPDATE invoices
       SET payment_status = $1,
           payment_method = COALESCE($2, payment_method)
       WHERE id = $3
       RETURNING *`,
      [paymentStatus, paymentMethod ? paymentMethod.trim() : null, id]
    );

    if (result.rowCount === 0) {
      return sendError(res, 'Invoice not found', 404);
    }

    return sendSuccess(res, result.rows[0], 'Payment status updated');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listInvoices,
  getInvoiceById,
  createInvoice,
  updatePaymentStatus
};
