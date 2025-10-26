const express = require('express');
const router = express.Router();
const {
  getCities,
  getCityById,
  createCity,
  updateCity,
  deleteCity,
  updateCityZones
} = require('../controllers/zoneController');

// City CRUD routes
router.get('/', getCities);
router.get('/:id', getCityById);
router.post('/', createCity);
router.put('/:id', updateCity);
router.delete('/:id', deleteCity);

// City utility routes
router.put('/:id/zones', updateCityZones);

module.exports = router;