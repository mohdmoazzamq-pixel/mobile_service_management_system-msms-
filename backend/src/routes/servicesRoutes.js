const express = require('express');
const router = express.Router();
const servicesController = require('../controllers/servicesController');
const authenticate = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');

// Public can list services; admin can create and edit
router.get('/', servicesController.listServices);
router.post('/', authenticate, authorize('admin'), servicesController.createService);
router.put('/:id', authenticate, authorize('admin'), servicesController.updateService);
router.delete('/:id', authenticate, authorize('admin'), servicesController.deleteService);

module.exports = router;
