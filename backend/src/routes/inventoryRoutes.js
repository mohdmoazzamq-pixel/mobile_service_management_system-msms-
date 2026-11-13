const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { createPartRules, stockAdjustRules } = require('../validators/inventoryValidator');
const validate = require('../middleware/validatorMiddleware');
const authenticate = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');

router.use(authenticate);

// Parts listing (accessible by admin and technician to check availability)
router.get('/', authorize('admin', 'technician'), inventoryController.listParts);
router.post('/', authorize('admin'), createPartRules, validate, inventoryController.createPart);
router.post('/:id/stock', authorize('admin'), stockAdjustRules, validate, inventoryController.adjustStock);
router.get('/transactions', authorize('admin'), inventoryController.getStockTransactions);
router.get('/:id/transactions', authorize('admin'), inventoryController.getStockTransactions);

module.exports = router;
