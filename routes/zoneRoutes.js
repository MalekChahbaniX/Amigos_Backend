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
  updateCityZones,
  getZoneGaranties,
  updateZoneGaranties,
  applyGlobalPromo
} = require('../controllers/zoneController');
const { protect, isAdminOrSuperAdmin, isSuperAdmin } = require('../middleware/auth');

// Zone utility routes
router.post('/get-zone', getUserZone);
router.put('/update-price', protect, isAdminOrSuperAdmin, updateZonePrice);
router.put('/update-city-zones/:id', protect, isAdminOrSuperAdmin, updateCityZones);
router.post('/apply-global-promo', protect, isSuperAdmin, applyGlobalPromo);

// Zone CRUD routes
router.get('/', getZones);
router.get('/:id', getZoneById);
router.post('/', protect, isSuperAdmin, createZone);
router.put('/:id', protect, isSuperAdmin, updateZone);
router.delete('/:id', protect, isSuperAdmin, deleteZone);

// Zone configuration routes
router.get('/:id/garanties', getZoneGaranties);
router.put('/:id/garanties', protect, isAdminOrSuperAdmin, updateZoneGaranties);

module.exports = router;
