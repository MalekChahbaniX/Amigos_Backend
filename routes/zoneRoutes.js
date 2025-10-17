const express = require('express');
const router = express.Router();
const {
  getUserZone,
  updateZonePrice,
  updateCityZones
} = require('../controllers/zoneController');

router.post('/get-zone', getUserZone);
router.put('/update-price', updateZonePrice);
router.put('/update-city-zones', updateCityZones);

module.exports = router;
