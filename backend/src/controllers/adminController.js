const { query } = require('../config/database');
const { sendSuccess } = require('../utils/response');

async function getDashboardStats(req, res, next) {
  try {
    // Parallel queries for fast dashboard summary
    const [
      customersCount,
      techniciansCount,
      bookingsSummary,
      repairsSummary,
      revenueSummary,
      lowStockParts,
      recentBookings
    ] = await Promise.all([
      query('SELECT COUNT(*) AS total FROM customers'),
      query('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE availability = \'AVAILABLE\') AS available FROM technicians'),
      query(`
        SELECT 
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE booking_status = 'PENDING') AS pending,
          COUNT(*) FILTER (WHERE booking_status = 'APPROVED') AS approved,
          COUNT(*) FILTER (WHERE booking_status = 'REJECTED') AS rejected,
          COUNT(*) FILTER (WHERE booking_status = 'CANCELLED') AS cancelled
        FROM bookings
      `),
      query(`
        SELECT 
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE repair_status NOT IN ('REPAIR_COMPLETED', 'DELIVERED')) AS active,
          COUNT(*) FILTER (WHERE repair_status = 'REPAIR_COMPLETED') AS completed,
          COUNT(*) FILTER (WHERE repair_status = 'DELIVERED') AS delivered
        FROM repairs
      `),
      query(`
        SELECT 
          COALESCE(SUM(total_amount), 0) AS total_billed,
          COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'PAID'), 0) AS total_collected,
          COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'UNPAID'), 0) AS total_pending
        FROM invoices
      `),
      query(`
        SELECT id, part_name, part_code, stock_quantity, minimum_stock
        FROM spare_parts
        WHERE stock_quantity <= minimum_stock AND is_active = true
        ORDER BY stock_quantity ASC
      `),
      query(`
        SELECT b.id, b.booking_number, b.problem_category, b.booking_status, b.created_at,
               u.name AS customer_name, d.brand, d.model
        FROM bookings b
        JOIN customers c ON b.customer_id = c.id
        JOIN users u ON c.user_id = u.id
        JOIN devices d ON b.device_id = d.id
        ORDER BY b.created_at DESC
        LIMIT 5
      `)
    ]);

    return sendSuccess(res, {
      customers: {
        total: Number(customersCount.rows[0].total)
      },
      technicians: {
        total: Number(techniciansCount.rows[0].total),
        available: Number(techniciansCount.rows[0].available || 0)
      },
      bookings: {
        total: Number(bookingsSummary.rows[0].total),
        pending: Number(bookingsSummary.rows[0].pending),
        approved: Number(bookingsSummary.rows[0].approved),
        rejected: Number(bookingsSummary.rows[0].rejected),
        cancelled: Number(bookingsSummary.rows[0].cancelled)
      },
      repairs: {
        total: Number(repairsSummary.rows[0].total),
        active: Number(repairsSummary.rows[0].active),
        completed: Number(repairsSummary.rows[0].completed),
        delivered: Number(repairsSummary.rows[0].delivered)
      },
      revenue: {
        totalBilled: parseFloat(revenueSummary.rows[0].total_billed),
        totalCollected: parseFloat(revenueSummary.rows[0].total_collected),
        totalPending: parseFloat(revenueSummary.rows[0].total_pending)
      },
      lowStockAlerts: lowStockParts.rows,
      recentBookings: recentBookings.rows
    }, 'Admin dashboard metrics retrieved');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDashboardStats
};
