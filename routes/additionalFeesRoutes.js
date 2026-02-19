const express = require('express');
const router = express.Router();
const additionalFeesController = require('../controllers/additionalFeesController');

// Middleware d'authentification et d'autorisation (à adapter selon votre système)
const { protect, authorize } = require('../middleware/auth');

// Routes protégées (admin et superAdmin)
router.use(protect);
router.use(authorize('admin', 'superAdmin'));

// @route   GET /api/additional-fees
// @desc    Get current additional fees
router.get('/', additionalFeesController.getAdditionalFees);

// @route   PUT /api/additional-fees
// @desc    Update additional fees
router.put('/', additionalFeesController.updateAdditionalFees);

// @route   POST /api/additional-fees/calculate
// @desc    Calculate applicable fees for order type
router.post('/calculate', additionalFeesController.calculateApplicableFees);

// @route   GET /api/additional-fees/history
// @desc    Get fees history
router.get('/history', additionalFeesController.getFeesHistory);

// @route   GET /api/additional-fees/test-all
// @desc    Test fees calculation for all order types
router.get('/test-all', additionalFeesController.testAllOrderTypes);

module.exports = router;
