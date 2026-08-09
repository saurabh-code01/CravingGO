const express = require('express');
const router = express.Router();
const { createPaymentIntent, confirmMockPayment } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

router.post('/create-intent', protect, createPaymentIntent);
router.post('/confirm-mock', protect, confirmMockPayment);

module.exports = router;
