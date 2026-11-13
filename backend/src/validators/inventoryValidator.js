const { body } = require('express-validator');

const createPartRules = [
  body('partName')
    .trim()
    .notEmpty()
    .withMessage('Part name is required')
    .isLength({ max: 150 })
    .withMessage('Part name cannot exceed 150 characters'),
  body('partCode')
    .trim()
    .notEmpty()
    .withMessage('Part code is required')
    .isLength({ max: 50 })
    .withMessage('Part code cannot exceed 50 characters'),
  body('brand')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 100 }),
  body('purchasePrice')
    .notEmpty()
    .withMessage('Purchase price is required')
    .isFloat({ min: 0 })
    .withMessage('Purchase price must be 0 or greater'),
  body('sellingPrice')
    .notEmpty()
    .withMessage('Selling price is required')
    .isFloat({ min: 0 })
    .withMessage('Selling price must be 0 or greater'),
  body('stockQuantity')
    .notEmpty()
    .withMessage('Stock quantity is required')
    .isInt({ min: 0 })
    .withMessage('Stock quantity must be 0 or greater'),
  body('minimumStock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Minimum stock must be 0 or greater')
];

const stockAdjustRules = [
  body('transactionType')
    .trim()
    .notEmpty()
    .withMessage('Transaction type is required')
    .isIn(['IN', 'OUT', 'ADJUSTMENT'])
    .withMessage('Type must be IN, OUT, or ADJUSTMENT'),
  body('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isInt({ min: 1 })
    .withMessage('Quantity must be an integer greater than 0'),
  body('remarks')
    .optional({ checkFalsy: true })
    .trim()
];

module.exports = {
  createPartRules,
  stockAdjustRules
};
