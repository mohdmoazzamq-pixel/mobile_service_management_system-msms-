const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const authenticate = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');

router.use(authenticate);

// Admin-only endpoints for customer management
router.get('/', authorize('admin'), customerController.listCustomers);
router.post('/', authorize('admin'), customerController.createCustomer);
router.get('/:id', authorize('admin'), customerController.getCustomerById);

module.exports = router;
