const express = require('express');
const router = express.Router();
const {
  getZones,
  getZoneById,
  createZone,
  updateZone,
  deleteZone,
  getUserZone,
  updateZonePrice,
  updateCityZones
} = require('../controllers/zoneController');

// Zone utility routes
router.post('/get-zone', getUserZone);
router.put('/update-price', updateZonePrice);
router.put('/update-city-zones', updateCityZones);

// Zone CRUD routes
router.get('/', getZones);
router.get('/:id', getZoneById);
router.post('/', createZone);
router.put('/:id', updateZone);
router.delete('/:id', deleteZone);



module.exports = router;
