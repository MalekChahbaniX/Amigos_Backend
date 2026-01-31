const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  initiatePayment,
  createTransfer,
  getTransactionHistory,
  getTransactionStatus,
} = require('../controllers/transactionController');

// Routes pour les paiements
router.post('/payments/online', initiatePayment);
router.post('/transfers', createTransfer);
router.get('/user/:id', getTransactionHistory);
router.get('/:transactionId/status', protect, getTransactionStatus);

module.exports = router;