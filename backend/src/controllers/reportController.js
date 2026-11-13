const { query } = require('../config/database');
const { sendSuccess } = require('../utils/response');

async function getOperationalReports(req, res, next) {
  try {
    const [
      repairsByStatus,
      revenueStats,
      popularServices,
      topPartsUsed,
      technicianPerformance
    ] = await Promise.all([
      query(`
        SELECT repair_status, COUNT(*) AS count
        FROM repairs
        GROUP BY repair_status
        ORDER BY count DESC
      `),
      query(`
        SELECT 
          COUNT(*) AS total_invoices,
          COALESCE(SUM(subtotal), 0) AS total_subtotal,
          COALESCE(SUM(tax_amount), 0) AS total_tax,
          COALESCE(SUM(discount), 0) AS total_discount,
          COALESCE(SUM(total_amount), 0) AS gross_revenue,
          COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'PAID'), 0) AS net_collected,
          COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'UNPAID'), 0) AS pending_collection
        FROM invoices
      `),
      query(`
        SELECT s.service_name, COUNT(b.id) AS booking_count, COALESCE(SUM(s.base_price), 0) AS revenue_generated
        FROM services s
        LEFT JOIN bookings b ON b.service_id = s.id
        GROUP BY s.id, s.service_name
        ORDER BY booking_count DESC
      `),
      query(`
        SELECT sp.part_name, sp.part_code, SUM(rp.quantity) AS total_used, SUM(rp.quantity * rp.unit_price) AS total_value
        FROM repair_parts rp
        JOIN spare_parts sp ON rp.part_id = sp.id
        GROUP BY sp.id, sp.part_name, sp.part_code
        ORDER BY total_used DESC
        LIMIT 10
      `),
      query(`
        SELECT t.id, u.name, t.specialization, t.availability,
               COUNT(r.id) AS total_jobs,
               COUNT(r.id) FILTER (WHERE r.repair_status IN ('REPAIR_COMPLETED', 'DELIVERED')) AS completed_jobs,
               ROUND(AVG(f.rating), 1) AS avg_rating
        FROM technicians t
        JOIN users u ON t.user_id = u.id
        LEFT JOIN repairs r ON r.technician_id = t.id
        LEFT JOIN feedback f ON f.repair_id = r.id
        GROUP BY t.id, u.name, t.specialization, t.availability
        ORDER BY completed_jobs DESC
      `)
    ]);

    return sendSuccess(res, {
      repairsByStatus: repairsByStatus.rows,
      revenue: revenueStats.rows[0],
      popularServices: popularServices.rows,
      topPartsUsed: topPartsUsed.rows,
      technicianPerformance: technicianPerformance.rows
    }, 'Operational reports generated');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getOperationalReports
};
