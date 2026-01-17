const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

router.post('/initiate-flouci', paymentController.initiateFlouciPayment);
router.post('/flouci-webhook', paymentController.flouciWebhook);
router.get('/flouci-success', paymentController.handleFlouciSuccess);
router.get('/flouci-failure', paymentController.handleFlouciFailure);

// Wallet balance route (optional but recommended)
router.get('/wallet/balance', protect, async (req, res) => {
  try {
    const walletService = require('../services/walletService');
    const balanceInfo = await walletService.getApplicationWalletBalance();
    res.json({ success: true, data: balanceInfo });
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    res.status(500).json({ success: false, message: 'Error fetching wallet balance' });
  }
});

module.exports = router;
