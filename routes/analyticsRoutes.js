const express = require('express');
const router = express.Router();
const {
  getAnalyticsOverview,
  getRevenueAnalytics,
  getUserAnalytics,
  getProductAnalytics,
  getBalanceAnalytics,
} = require('../controllers/analyticsController');

// All analytics routes require authentication
// You can add middleware here to verify JWT token and super admin role

router.get('/overview', getAnalyticsOverview);
router.get('/revenue', getRevenueAnalytics);
router.get('/users', getUserAnalytics);
router.get('/products', getProductAnalytics);
router.get('/balances', getBalanceAnalytics);

module.exports = router;