const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authenticate = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');

router.use(authenticate, authorize('admin'));

router.get('/summary', reportController.getOperationalReports);

module.exports = router;
