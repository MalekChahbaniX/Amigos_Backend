const express = require('express');
const router = express.Router();
const {
  getCities,
  getCityById,
  createCity,
  updateCity,
  deleteCity,
  updateCityZones,
  getCitySettings,
  updateCityMultiplicateur
} = require('../controllers/zoneController');
const { protect, isAdminOrSuperAdmin } = require('../middleware/auth');

// City CRUD routes
router.get('/', getCities);
router.get('/:id', getCityById);
router.post('/', createCity);
router.put('/:id', updateCity);
router.delete('/:id', deleteCity);

// City utility routes
router.put('/:id/zones', updateCityZones);

// City settings and configuration routes
router.get('/:id/settings', getCitySettings);
router.put('/:id/multiplicateur', protect, isAdminOrSuperAdmin, updateCityMultiplicateur);

module.exports = router;