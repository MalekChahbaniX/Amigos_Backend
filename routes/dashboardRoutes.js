const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getRecentOrders,
  getActiveDeliverers
} = require('../controllers/dashboardController');

// All dashboard routes require authentication
// You can add middleware here to verify JWT token and super admin role

router.get('/stats', getDashboardStats);
router.get('/recent-orders', getRecentOrders);
router.get('/active-deliverers', getActiveDeliverers);

module.exports = router;