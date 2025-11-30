const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getPlatformBalance,
  getDelivererBalance,
  getDelivererOrders,
  getRecentOrders,
  getAllOrders,
  updateOrderStatus,
  assignDeliverer,
  getActiveDeliverers
} = require('../controllers/dashboardController');
const { isSuperAdmin } = require('../middleware/auth');

// All dashboard routes require super admin authentication
router.use(isSuperAdmin);

router.get('/stats', getDashboardStats);
router.get('/platform-balance', getPlatformBalance);
router.get('/deliverer-balance', getDelivererBalance);
router.get('/deliverer/:id/orders', getDelivererOrders);
router.get('/recent-orders', getRecentOrders);
router.get('/orders', getAllOrders);
router.put('/orders/:id/status', updateOrderStatus);
router.put('/orders/:id/assign-deliverer', assignDeliverer);
router.get('/active-deliverers', getActiveDeliverers);

module.exports = router;