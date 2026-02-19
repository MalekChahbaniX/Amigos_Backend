const express = require('express');
const router = express.Router();
const marginSettingsController = require('../controllers/marginSettingsController');

// Middleware d'authentification et d'autorisation (à adapter selon votre système)
const { protect, authorize } = require('../middleware/auth');

// Routes protégées (admin et superAdmin)
router.use(protect);
router.use(authorize('admin', 'superAdmin'));

// @route   GET /api/margin-settings
// @desc    Get current margin settings
router.get('/', marginSettingsController.getMarginSettings);

// @route   PUT /api/margin-settings
// @desc    Update margin settings
router.put('/', marginSettingsController.updateMarginSettings);

// @route   POST /api/margin-settings/calculate
// @desc    Calculate margin for specific order type and amount
router.post('/calculate', marginSettingsController.calculateMargin);

// @route   GET /api/margin-settings/history
// @desc    Get margin settings history
router.get('/history', marginSettingsController.getMarginHistory);

module.exports = router;
