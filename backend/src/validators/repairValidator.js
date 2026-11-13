const { body } = require('express-validator');

const updateStatusRules = [
  body('status')
    .trim()
    .notEmpty()
    .withMessage('Status is required')
    .isIn([
      'DEVICE_RECEIVED',
      'UNDER_DIAGNOSIS',
      'REPAIR_IN_PROGRESS',
      'WAITING_FOR_SPARE_PARTS',
      'REPAIR_COMPLETED',
      'DELIVERED'
    ])
    .withMessage('Invalid repair status value'),
  body('remarks')
    .optional({ checkFalsy: true })
    .trim()
];

const usePartRules = [
  body('partId')
    .notEmpty()
    .withMessage('Part ID is required')
    .isInt({ min: 1 })
    .withMessage('Valid Part ID is required'),
  body('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isInt({ min: 1 })
    .withMessage('Quantity must be an integer greater than 0')
];

const updateDiagnosisRules = [
  body('diagnosis')
    .trim()
    .notEmpty()
    .withMessage('Diagnosis notes are required'),
  body('estimatedCost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Estimated cost must be 0 or greater'),
  body('estimatedCompletion')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Estimated completion must be a valid timestamp')
];

module.exports = {
  updateStatusRules,
  usePartRules,
  updateDiagnosisRules
};
