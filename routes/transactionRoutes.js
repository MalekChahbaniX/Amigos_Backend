const express = require('express');
const router = express.Router();
const {
  initiatePayment,
  createTransfer,
  getTransactionHistory,
} = require('../controllers/transactionController');

// Routes pour les paiements
router.post('/payments/online', initiatePayment);
router.post('/transfers', createTransfer);
router.get('/user/:id', getTransactionHistory);

module.exports = router;