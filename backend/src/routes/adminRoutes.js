const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authenticate = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');

router.use(authenticate, authorize('admin'));

router.get('/dashboard', adminController.getDashboardStats);

module.exports = router;
