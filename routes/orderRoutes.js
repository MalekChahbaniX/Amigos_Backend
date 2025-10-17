const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrdersByClient,
  getOrdersBySuperAdmin,
  getAvailableOrders,
  assignOrder,
  updateOrderStatus,
  getOrdersSummary,
} = require('../controllers/orderController');

// Routes pour les clients et les livreurs
router.post('/', createOrder);
router.get('/user/:id', getOrdersByClient);
router.get('/superadmin/:id', getOrdersBySuperAdmin);
router.get('/superadmin/available', getAvailableOrders);
router.put('/assign/:orderId', assignOrder);
router.put('/:id/status', updateOrderStatus);
router.get('/summary', getOrdersSummary);

module.exports = router;