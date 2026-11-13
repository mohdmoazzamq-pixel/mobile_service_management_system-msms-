const { getClient, query } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

async function getRepairById(req, res, next) {
  try {
    const { id } = req.params;

    const repairRes = await query(`
      SELECT r.*,
             b.booking_number, b.problem_category, b.problem_description, b.preferred_date, b.booking_status,
             c.id AS customer_id, cu.name AS customer_name, cu.email AS customer_email, cu.phone AS customer_phone,
             c.address AS customer_address, c.city AS customer_city,
             d.id AS device_id, d.brand, d.model, d.imei, d.serial_number,
             s.id AS service_id, s.service_name, s.base_price AS service_base_price,
             tu.name AS technician_name, tu.email AS technician_email, tu.phone AS technician_phone,
             inv.id AS invoice_id, inv.invoice_number, inv.total_amount AS invoice_total, inv.payment_status
      FROM repairs r
      JOIN bookings b ON r.booking_id = b.id
      JOIN customers c ON b.customer_id = c.id
      JOIN users cu ON c.user_id = cu.id
      JOIN devices d ON b.device_id = d.id
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN technicians t ON r.technician_id = t.id
      LEFT JOIN users tu ON t.user_id = tu.id
      LEFT JOIN invoices inv ON inv.repair_id = r.id
      WHERE r.id = $1
    `, [id]);

    if (repairRes.rowCount === 0) {
      return sendError(res, 'Repair record not found', 404);
    }

    const repair = repairRes.rows[0];

    // Authorization checks
    if (req.user.role === 'customer' && repair.customer_id !== req.user.customer_id) {
      return sendError(res, 'Access denied. You do not own this repair job.', 403);
    }
    if (req.user.role === 'technician' && repair.technician_id !== req.user.technician_id) {
      return sendError(res, 'Access denied. You are not assigned to this repair job.', 403);
    }

    // Parallel fetch parts and status history
    const [partsRes, historyRes, feedbackRes] = await Promise.all([
      query(`
        SELECT rp.id, rp.repair_id, rp.part_id, rp.quantity, rp.unit_price, rp.used_at,
               sp.part_name, sp.part_code, sp.brand,
               u.name AS used_by_name
        FROM repair_parts rp
        JOIN spare_parts sp ON rp.part_id = sp.id
        JOIN users u ON rp.used_by = u.id
        WHERE rp.repair_id = $1
        ORDER BY rp.used_at ASC
      `, [id]),
      query(`
        SELECT rsh.id, rsh.repair_id, rsh.old_status, rsh.new_status, rsh.remarks, rsh.created_at,
               u.name AS updated_by_name, u.role AS updated_by_role
        FROM repair_status_history rsh
        JOIN users u ON rsh.updated_by = u.id
        WHERE rsh.repair_id = $1
        ORDER BY rsh.created_at ASC
      `, [id]),
      query(`
        SELECT f.id, f.rating, f.comments, f.created_at
        FROM feedback f
        WHERE f.repair_id = $1
      `, [id])
    ]);

    repair.parts = partsRes.rows;
    repair.history = historyRes.rows;
    repair.feedback = feedbackRes.rowCount > 0 ? feedbackRes.rows[0] : null;

    return sendSuccess(res, repair, 'Repair details retrieved');
  } catch (error) {
    next(error);
  }
}

async function updateRepairStatus(req, res, next) {
  const { id } = req.params;
  const { status, remarks } = req.body;
  const client = await getClient();

  try {
    const repairRes = await client.query('SELECT * FROM repairs WHERE id = $1', [id]);
    if (repairRes.rowCount === 0) {
      client.release();
      return sendError(res, 'Repair record not found', 404);
    }

    const repair = repairRes.rows[0];

    // Check permissions (TC-10: Technician updates unassigned repair -> denied)
    if (req.user.role === 'technician') {
      if (!repair.technician_id || repair.technician_id !== req.user.technician_id) {
        client.release();
        return sendError(res, 'Access denied. You can only update repairs assigned to you.', 403);
      }
    } else if (req.user.role !== 'admin') {
      client.release();
      return sendError(res, 'Access denied', 403);
    }

    const oldStatus = repair.repair_status;
    if (oldStatus === status) {
      client.release();
      return sendError(res, `Repair is already in status '${status}'`, 400);
    }

    await client.query('BEGIN');

    // If status is completed, record actual completion timestamp
    const actualCompletionClause = status === 'REPAIR_COMPLETED' || status === 'DELIVERED'
      ? ', actual_completion = CURRENT_TIMESTAMP'
      : '';

    const updateRes = await client.query(
      `UPDATE repairs
       SET repair_status = $1 ${actualCompletionClause}
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    // Insert into repair_status_history (immutable audit log)
    await client.query(
      `INSERT INTO repair_status_history (repair_id, old_status, new_status, updated_by, remarks)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, oldStatus, status, req.user.id, remarks || `Status changed from ${oldStatus} to ${status}`]
    );

    await client.query('COMMIT');
    client.release();

    return sendSuccess(res, updateRes.rows[0], `Repair status updated to ${status}`);
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    next(error);
  }
}

async function updateDiagnosis(req, res, next) {
  const { id } = req.params;
  const { diagnosis, estimatedCost, estimatedCompletion } = req.body;

  try {
    const repairRes = await query('SELECT * FROM repairs WHERE id = $1', [id]);
    if (repairRes.rowCount === 0) {
      return sendError(res, 'Repair record not found', 404);
    }

    const repair = repairRes.rows[0];

    // Permissions check
    if (req.user.role === 'technician') {
      if (!repair.technician_id || repair.technician_id !== req.user.technician_id) {
        return sendError(res, 'Access denied. You can only update repairs assigned to you.', 403);
      }
    } else if (req.user.role !== 'admin') {
      return sendError(res, 'Access denied', 403);
    }

    const updated = await query(
      `UPDATE repairs
       SET diagnosis = $1,
           estimated_cost = COALESCE($2, estimated_cost),
           estimated_completion = COALESCE($3, estimated_completion)
       WHERE id = $4
       RETURNING *`,
      [
        diagnosis,
        estimatedCost !== undefined ? parseFloat(estimatedCost) : null,
        estimatedCompletion || null,
        id
      ]
    );

    return sendSuccess(res, updated.rows[0], 'Diagnosis and estimates updated');
  } catch (error) {
    next(error);
  }
}

async function usePart(req, res, next) {
  const { id } = req.params; // repair id
  const { partId, quantity } = req.body;
  const qty = parseInt(quantity);
  const client = await getClient();

  try {
    const repairRes = await client.query('SELECT * FROM repairs WHERE id = $1', [id]);
    if (repairRes.rowCount === 0) {
      client.release();
      return sendError(res, 'Repair record not found', 404);
    }

    const repair = repairRes.rows[0];

    // Permissions check
    if (req.user.role === 'technician') {
      if (!repair.technician_id || repair.technician_id !== req.user.technician_id) {
        client.release();
        return sendError(res, 'Access denied. You can only issue parts for repairs assigned to you.', 403);
      }
    } else if (req.user.role !== 'admin') {
      client.release();
      return sendError(res, 'Access denied', 403);
    }

    await client.query('BEGIN');

    // Atomic stock check using SELECT FOR UPDATE
    const partRes = await client.query(
      'SELECT id, part_name, part_code, selling_price, stock_quantity, is_active FROM spare_parts WHERE id = $1 FOR UPDATE',
      [partId]
    );

    if (partRes.rowCount === 0) {
      await client.query('ROLLBACK');
      client.release();
      return sendError(res, 'Spare part not found', 404);
    }

    const part = partRes.rows[0];

    if (!part.is_active) {
      await client.query('ROLLBACK');
      client.release();
      return sendError(res, 'This spare part is inactive and cannot be issued', 400);
    }

    // Crucial Business Rule (Section 4.3 / 7.6 / TC-11):
    // Part quantity exceeds available stock -> transaction fails and stock remains unchanged.
    if (part.stock_quantity < qty) {
      await client.query('ROLLBACK');
      client.release();
      return sendError(
        res,
        `Insufficient stock for part "${part.part_name}". Available: ${part.stock_quantity}, Requested: ${qty}`,
        400
      );
    }

    // 1. Decrement stock
    await client.query(
      'UPDATE spare_parts SET stock_quantity = stock_quantity - $1 WHERE id = $2',
      [qty, partId]
    );

    // 2. Insert into repair_parts
    const rpRes = await client.query(
      `INSERT INTO repair_parts (repair_id, part_id, quantity, unit_price, used_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, partId, qty, part.selling_price, req.user.id]
    );

    // 3. Insert into stock_transactions (Ledger entry OUT)
    await client.query(
      `INSERT INTO stock_transactions (part_id, transaction_type, quantity, reference_id, remarks)
       VALUES ($1, 'OUT', $2, $3, $4)`,
      [partId, qty, id, `Issued for Repair #${id}`]
    );

    await client.query('COMMIT');
    client.release();

    return sendSuccess(
      res,
      {
        repairPart: rpRes.rows[0],
        partName: part.part_name,
        remainingStock: part.stock_quantity - qty
      },
      'Spare part issued and recorded successfully',
      201
    );
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    next(error);
  }
}

module.exports = {
  getRepairById,
  updateRepairStatus,
  updateDiagnosis,
  usePart
};
