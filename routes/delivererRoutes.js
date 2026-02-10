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
  updateDelivererLocation,
  updateDelivererPushToken,
  logoutDeliverer,
  startSession,
  stopSession,
  pauseSession,
  resumeSession,
  getDelivererStatistics
} = require('../controllers/delivererController');
const { getDelivererSessions } = require('../controllers/delivererController');
const { isDeliverer, checkDelivererSession } = require('../middleware/auth');

// Routes pour les livreurs - nécessitent une authentification
// Session start should be allowed without an active session
router.post('/session/start', isDeliverer, startSession);

// List past sessions for the authenticated deliverer
router.get('/sessions', isDeliverer, getDelivererSessions);

// All other deliverer routes require an active session
router.get('/orders', isDeliverer, checkDelivererSession, getDelivererOrders);
router.get('/orders/available', isDeliverer, checkDelivererSession, getDelivererAvailableOrders);
router.put('/orders/:orderId/accept', isDeliverer, checkDelivererSession, acceptOrder);
router.put('/orders/:orderId/reject', isDeliverer, checkDelivererSession, rejectOrder);

/**
 * @route   PUT /api/deliverers/orders/:orderId/status
 * @desc    Update order status with security code verification
 * @access  Private (deliverer with active session)
 * @body    {string} status - New status ('collected', 'in_delivery', 'delivered', 'cancelled')
 * @body    {string} securityCode - 6-digit security code (required for 'collected' and 'delivered')
 * @body    {string|array} providerPaymentMode - Payment mode (required for 'collected')
 * @returns {object} Updated order information
 */
router.put('/orders/:orderId/status', isDeliverer, checkDelivererSession, updateOrderStatus);
router.get('/earnings', isDeliverer, checkDelivererSession, getDelivererEarnings);
router.get('/statistics', isDeliverer, checkDelivererSession, getDelivererStatistics);
router.get('/daily-balance', isDeliverer, checkDelivererSession, require('../controllers/delivererController').getDailyBalance);
router.post('/pay-balance', isDeliverer, checkDelivererSession, require('../controllers/delivererController').payDailyBalance);
router.get('/profile', isDeliverer, checkDelivererSession, getDelivererProfile);
router.put('/profile/location', isDeliverer, checkDelivererSession, updateDelivererLocation);
router.put('/profile/push-token', isDeliverer, checkDelivererSession, updateDelivererPushToken);
// Allow logout without requiring an active session (deliverer should be able to logout even if session expired)
router.post('/logout', isDeliverer, logoutDeliverer);

// End session
router.post('/session/stop', isDeliverer, stopSession);

// Pause/Resume session
router.post('/session/pause', isDeliverer, pauseSession);
router.post('/session/resume', isDeliverer, resumeSession);

module.exports = router;