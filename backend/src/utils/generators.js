const crypto = require('crypto');

/**
 * Generates unique booking number: BK-YYYYMMDD-XXXX
 */
function generateBookingNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `BK-${dateStr}-${randomSuffix}`;
}

/**
 * Generates unique invoice number: INV-YYYYMMDD-XXXX
 */
function generateInvoiceNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `INV-${dateStr}-${randomSuffix}`;
}

module.exports = {
  generateBookingNumber,
  generateInvoiceNumber
};
