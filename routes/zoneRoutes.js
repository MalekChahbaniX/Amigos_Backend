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
const { protect, isAdminOrSuperAdmin, isSuperAdmin } = require('../middleware/auth');

// Zone utility routes
router.post('/get-zone', getUserZone);
router.put('/update-price', protect, isAdminOrSuperAdmin, updateZonePrice);
router.put('/update-city-zones/:id', protect, isAdminOrSuperAdmin, updateCityZones);

// Zone CRUD routes
router.get('/', getZones);
router.get('/:id', getZoneById);
router.post('/', protect, isSuperAdmin, createZone);
router.put('/:id', protect, isSuperAdmin, updateZone);
router.delete('/:id', protect, isSuperAdmin, deleteZone);



module.exports = router;
