const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const authenticate = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');

router.use(authenticate);

router.get('/', authorize('admin', 'customer'), deviceController.listDevices);
router.post('/', authorize('admin', 'customer'), deviceController.createDevice);
router.get('/:id', authorize('admin', 'customer'), deviceController.getDeviceById);
router.put('/:id', authorize('admin', 'customer'), deviceController.updateDevice);
router.delete('/:id', authorize('admin', 'customer'), deviceController.deleteDevice);

module.exports = router;
