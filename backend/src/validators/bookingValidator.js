const { body } = require('express-validator');

const createBookingRules = [
  body('deviceId')
    .notEmpty()
    .withMessage('Device ID is required')
    .isInt({ min: 1 })
    .withMessage('Valid Device ID is required'),
  body('serviceId')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage('Valid Service ID is required if provided'),
  body('problemCategory')
    .trim()
    .notEmpty()
    .withMessage('Problem category is required')
    .isLength({ max: 100 })
    .withMessage('Problem category cannot exceed 100 characters'),
  body('problemDescription')
    .trim()
    .notEmpty()
    .withMessage('Problem description is required')
    .isLength({ min: 5, max: 2000 })
    .withMessage('Problem description must be at least 5 characters'),
  body('preferredDate')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Preferred date must be a valid date (YYYY-MM-DD)')
];

const decisionRules = [
  body('decision')
    .trim()
    .notEmpty()
    .withMessage('Decision is required')
    .isIn(['APPROVED', 'REJECTED', 'CANCELLED'])
    .withMessage('Decision must be APPROVED, REJECTED, or CANCELLED')
];

const assignRules = [
  body('technicianId')
    .notEmpty()
    .withMessage('Technician ID is required')
    .isInt({ min: 1 })
    .withMessage('Valid Technician ID is required')
];

module.exports = {
  createBookingRules,
  decisionRules,
  assignRules
};
