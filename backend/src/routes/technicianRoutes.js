const express = require('express');
const router = express.Router();
const technicianController = require('../controllers/technicianController');
const authenticate = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');

// Technician jobs endpoint (used by technician)
router.get('/jobs', authenticate, authorize('technician'), technicianController.getAssignedJobs);

// Admin or public listing
router.get('/', technicianController.listTechnicians);
router.post('/', authenticate, authorize('admin'), technicianController.createTechnician);
router.patch('/:id/availability', authenticate, authorize('admin', 'technician'), technicianController.updateAvailability);
router.patch('/:id/toggle-active', authenticate, authorize('admin'), technicianController.toggleTechnicianActive);

module.exports = router;
