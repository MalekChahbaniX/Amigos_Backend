const express = require('express');
const router = express.Router();
const {
  getDelivererOrders,
  getDelivererAvailableOrders,
  acceptOrder,
  rejectOrder,
  updateOrderStatus,
  getDelivererEarnings,
  getDelivererProfile,
  updateDelivererLocation
} = require('../controllers/delivererController');
const { isDeliverer } = require('../middleware/auth');

// Routes pour les livreurs - nécessitent une authentification
router.get('/orders', isDeliverer, getDelivererOrders);
router.get('/orders/available', isDeliverer, getDelivererAvailableOrders);
router.put('/orders/:orderId/accept', isDeliverer, acceptOrder);
router.put('/orders/:orderId/reject', isDeliverer, rejectOrder);
router.put('/orders/:orderId/status', isDeliverer, updateOrderStatus);
router.get('/earnings', isDeliverer, getDelivererEarnings);
router.get('/profile', isDeliverer, getDelivererProfile);
router.put('/profile/location', isDeliverer, updateDelivererLocation);

module.exports = router;