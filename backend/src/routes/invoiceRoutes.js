const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { createInvoiceRules, updatePaymentRules } = require('../validators/invoiceValidator');
const validate = require('../middleware/validatorMiddleware');
const authenticate = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');

router.use(authenticate);

router.get('/', authorize('admin', 'customer'), invoiceController.listInvoices);
router.post('/', authorize('admin'), createInvoiceRules, validate, invoiceController.createInvoice);
router.get('/:id', authorize('admin', 'customer'), invoiceController.getInvoiceById);
router.patch('/:id/payment', authorize('admin'), updatePaymentRules, validate, invoiceController.updatePaymentStatus);

module.exports = router;
