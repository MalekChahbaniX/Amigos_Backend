const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getPlatformBalance,
  getDelivererBalance,
  getDelivererOrders,
  getRecentOrders,
  getActiveDeliverers
} = require('../controllers/dashboardController');

// All dashboard routes require authentication
// You can add middleware here to verify JWT token and super admin role

router.get('/stats', getDashboardStats);
router.get('/platform-balance', getPlatformBalance);
router.get('/deliverer-balance', getDelivererBalance);
router.get('/deliverer/:id/orders', getDelivererOrders);
router.get('/recent-orders', getRecentOrders);
router.get('/active-deliverers', getActiveDeliverers);

module.exports = router;