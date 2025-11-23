const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.post('/initiate-konnect', paymentController.initiateKonnectPayment);
router.post('/konnect-webhook', paymentController.konnectWebhook);

module.exports = router;
