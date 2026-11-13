const { body } = require('express-validator');

const createInvoiceRules = [
  body('repairId')
    .notEmpty()
    .withMessage('Repair ID is required')
    .isInt({ min: 1 })
    .withMessage('Valid Repair ID is required'),
  body('taxAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Tax amount must be 0 or greater'),
  body('discount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Discount must be 0 or greater'),
  body('paymentStatus')
    .optional()
    .isIn(['UNPAID', 'PARTIAL', 'PAID', 'REFUNDED'])
    .withMessage('Invalid payment status'),
  body('paymentMethod')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 30 })
];

const updatePaymentRules = [
  body('paymentStatus')
    .trim()
    .notEmpty()
    .withMessage('Payment status is required')
    .isIn(['UNPAID', 'PARTIAL', 'PAID', 'REFUNDED'])
    .withMessage('Invalid payment status'),
  body('paymentMethod')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 30 })
];

const feedbackRules = [
  body('repairId')
    .notEmpty()
    .withMessage('Repair ID is required')
    .isInt({ min: 1 })
    .withMessage('Valid Repair ID is required'),
  body('rating')
    .notEmpty()
    .withMessage('Rating is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comments')
    .optional({ checkFalsy: true })
    .trim()
];

module.exports = {
  createInvoiceRules,
  updatePaymentRules,
  feedbackRules
};
