const express = require('express');
const router = express.Router();
const {
  getDeliverers,
  getDelivererById,
  createDeliverer,
  updateDelivererStatus,
  deleteDeliverer,
  getDelivererSessions
} = require('../controllers/deliverersController');
const { protect, isAdminOrSuperAdmin } = require('../middleware/auth');

// Deliverer routes: accessible to super admins and city admins (protected)
router.get('/', protect, isAdminOrSuperAdmin, getDeliverers);
router.get('/sessions', protect, isAdminOrSuperAdmin, getDelivererSessions);
router.get('/:id', protect, isAdminOrSuperAdmin, getDelivererById);
router.post('/', protect, isAdminOrSuperAdmin, createDeliverer);
router.put('/:id/status', protect, isAdminOrSuperAdmin, updateDelivererStatus);
router.delete('/:id', protect, isAdminOrSuperAdmin, deleteDeliverer);

module.exports = router;