const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const { feedbackRules } = require('../validators/invoiceValidator');
const validate = require('../middleware/validatorMiddleware');
const authenticate = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');

// Public or authenticated list feedback
router.get('/', feedbackController.listFeedback);

// Customer submit feedback
router.post('/', authenticate, authorize('customer'), feedbackRules, validate, feedbackController.submitFeedback);

module.exports = router;
