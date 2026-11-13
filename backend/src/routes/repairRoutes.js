const express = require('express');
const router = express.Router();
const repairController = require('../controllers/repairController');
const { updateStatusRules, usePartRules, updateDiagnosisRules } = require('../validators/repairValidator');
const validate = require('../middleware/validatorMiddleware');
const authenticate = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');

router.use(authenticate);

router.get('/:id', authorize('admin', 'customer', 'technician'), repairController.getRepairById);
router.patch(
  '/:id/status',
  authorize('admin', 'technician'),
  updateStatusRules,
  validate,
  repairController.updateRepairStatus
);
router.patch(
  '/:id/diagnosis',
  authorize('admin', 'technician'),
  updateDiagnosisRules,
  validate,
  repairController.updateDiagnosis
);
router.post(
  '/:id/parts',
  authorize('admin', 'technician'),
  usePartRules,
  validate,
  repairController.usePart
);

module.exports = router;
