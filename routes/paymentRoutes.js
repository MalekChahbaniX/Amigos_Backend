const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.post('/initiate-flouci', paymentController.initiateFlouciPayment);
router.post('/flouci-webhook', paymentController.flouciWebhook);
router.get('/flouci-success', paymentController.handleFlouciSuccess);
router.get('/flouci-failure', paymentController.handleFlouciFailure);

module.exports = router;
