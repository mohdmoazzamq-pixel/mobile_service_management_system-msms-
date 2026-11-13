const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { createBookingRules, decisionRules, assignRules } = require('../validators/bookingValidator');
const validate = require('../middleware/validatorMiddleware');
const authenticate = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Public tracking endpoint (no auth required)
router.get('/public-track/:bookingNumber', bookingController.publicTrackBooking);

router.use(authenticate);

router.get('/', authorize('admin', 'customer', 'technician'), bookingController.listBookings);
router.post(
  '/',
  authorize('admin', 'customer'),
  upload.array('images', 5),
  createBookingRules,
  validate,
  bookingController.createBooking
);
router.get('/:id', authorize('admin', 'customer', 'technician'), bookingController.getBookingById);
router.patch('/:id/decision', authorize('admin'), decisionRules, validate, bookingController.decideBooking);
router.patch('/:id/assign', authorize('admin'), assignRules, validate, bookingController.assignTechnician);
router.patch('/:id/cancel', authorize('admin', 'customer'), bookingController.cancelBooking);

module.exports = router;
