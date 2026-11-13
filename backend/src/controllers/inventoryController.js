const { getClient, query } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

async function listParts(req, res, next) {
  try {
    const search = req.query.search ? `%${req.query.search.trim()}%` : null;
    const lowStockOnly = req.query.lowStock === 'true';

    let sql = `
      SELECT id, part_name, part_code, brand, purchase_price, selling_price,
             stock_quantity, minimum_stock, is_active, created_at,
             (stock_quantity <= minimum_stock) AS is_low_stock
      FROM spare_parts
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      params.push(search);
      sql += ` AND (part_name ILIKE $${params.length} OR part_code ILIKE $${params.length} OR brand ILIKE $${params.length})`;
    }

    if (lowStockOnly) {
      sql += ' AND stock_quantity <= minimum_stock';
    }

    sql += ' ORDER BY is_low_stock DESC, part_name ASC';

    const result = await query(sql, params);
    return sendSuccess(res, result.rows, 'Spare parts inventory retrieved');
  } catch (error) {
    next(error);
  }
}

async function createPart(req, res, next) {
  const { partName, partCode, brand, purchasePrice, sellingPrice, stockQuantity, minimumStock } = req.body;
  const client = await getClient();

  try {
    const existing = await client.query('SELECT id FROM spare_parts WHERE part_code = $1', [partCode.trim()]);
    if (existing.rowCount > 0) {
      client.release();
      return sendError(res, 'Part code already exists', 409);
    }

    await client.query('BEGIN');

    const partRes = await client.query(
      `INSERT INTO spare_parts (
         part_name, part_code, brand, purchase_price, selling_price,
         stock_quantity, minimum_stock
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        partName.trim(),
        partCode.trim().toUpperCase(),
        brand ? brand.trim() : null,
        parseFloat(purchasePrice) || 0,
        parseFloat(sellingPrice) || 0,
        parseInt(stockQuantity) || 0,
        parseInt(minimumStock) || 0
      ]
    );

    const newPart = partRes.rows[0];

    // If initial stock > 0, log an initial stock transaction
    if (newPart.stock_quantity > 0) {
      await client.query(
        `INSERT INTO stock_transactions (part_id, transaction_type, quantity, remarks)
         VALUES ($1, 'IN', $2, 'Initial stock entry upon creation')`,
        [newPart.id, newPart.stock_quantity]
      );
    }

    await client.query('COMMIT');
    client.release();

    return sendSuccess(res, newPart, 'Spare part created successfully', 201);
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    if (error.code === '23505') {
      return sendError(res, 'Part code already exists', 409);
    }
    next(error);
  }
}

async function adjustStock(req, res, next) {
  const { id } = req.params;
  const { transactionType, quantity, remarks } = req.body;
  const qty = parseInt(quantity);
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const partRes = await client.query(
      'SELECT id, part_name, stock_quantity FROM spare_parts WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (partRes.rowCount === 0) {
      await client.query('ROLLBACK');
      client.release();
      return sendError(res, 'Spare part not found', 404);
    }

    const part = partRes.rows[0];
    let newQuantity = part.stock_quantity;

    if (transactionType === 'IN') {
      newQuantity += qty;
    } else if (transactionType === 'OUT') {
      if (part.stock_quantity < qty) {
        await client.query('ROLLBACK');
        client.release();
        return sendError(res, `Cannot reduce stock below zero. Current stock: ${part.stock_quantity}`, 400);
      }
      newQuantity -= qty;
    } else if (transactionType === 'ADJUSTMENT') {
      // Adjustment can set or reconcile quantity
      newQuantity = qty;
    }

    await client.query(
      'UPDATE spare_parts SET stock_quantity = $1 WHERE id = $2',
      [newQuantity, id]
    );

    const logRes = await client.query(
      `INSERT INTO stock_transactions (part_id, transaction_type, quantity, remarks)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, transactionType, qty, remarks || `Stock ${transactionType} processed`]
    );

    await client.query('COMMIT');
    client.release();

    return sendSuccess(
      res,
      {
        partId: id,
        previousStock: part.stock_quantity,
        newStock: newQuantity,
        transaction: logRes.rows[0]
      },
      'Stock adjusted successfully'
    );
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    next(error);
  }
}

async function getStockTransactions(req, res, next) {
  try {
    const { id } = req.params; // optional partId
    let sql = `
      SELECT st.*, sp.part_name, sp.part_code
      FROM stock_transactions st
      JOIN spare_parts sp ON st.part_id = sp.id
    `;
    const params = [];

    if (id) {
      params.push(id);
      sql += ' WHERE st.part_id = $1';
    }

    sql += ' ORDER BY st.created_at DESC LIMIT 100';

    const result = await query(sql, params);
    return sendSuccess(res, result.rows, 'Stock transactions retrieved');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listParts,
  createPart,
  adjustStock,
  getStockTransactions
};
