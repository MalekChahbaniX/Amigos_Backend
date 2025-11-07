// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const {
  initiatePayment,
  paymentCallback,
  checkPaymentStatus,
} = require('../controllers/paymentController');

router.post('/initiate', initiatePayment);
router.post('/callback', paymentCallback);
router.get('/status/:id', checkPaymentStatus);

module.exports = router;
