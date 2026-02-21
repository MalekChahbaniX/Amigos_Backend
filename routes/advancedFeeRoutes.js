const express = require('express');
const router = express.Router();
const {
  calculateAdvancedFees,
  updateOrderWithAdvancedFees,
  batchUpdateOrdersWithAdvancedFees,
  getAdvancedFeesBreakdown,
  compareCalculations
} = require('../controllers/advancedFeeController');

// Middleware d'authentification (à adapter selon votre système)
const { protect, authorize } = require('../middleware/auth');

// @route   POST /api/advanced-fees/calculate
// @desc    Calculate advanced fees for an order (Zone 5 logic)
// @access  Private (admin)
router.post('/calculate', protect, authorize('admin'), calculateAdvancedFees);

// @route   PUT /api/advanced-fees/update-order/:orderId
// @desc    Update an order with advanced fees (Zone 5 logic)
// @access  Private (admin)
router.put('/update-order/:orderId', protect, authorize('admin'), updateOrderWithAdvancedFees);

// @route   POST /api/advanced-fees/batch-update
// @desc    Batch update multiple orders with advanced fees
// @access  Private (admin)
router.post('/batch-update', protect, authorize('admin'), batchUpdateOrdersWithAdvancedFees);

// @route   GET /api/advanced-fees/breakdown/:orderId
// @desc    Get advanced fees breakdown for existing orders
// @access  Private (admin)
router.get('/breakdown/:orderId', protect, authorize('admin'), getAdvancedFeesBreakdown);

// @route   GET /api/advanced-fees/compare/:orderId
// @desc    Compare standard vs advanced calculation for an order
// @access  Private (admin)
router.get('/compare/:orderId', protect, authorize('admin'), compareCalculations);

module.exports = router;
