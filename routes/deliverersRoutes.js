const express = require('express');
const router = express.Router();
const {
  getDeliverers,
  getDelivererById,
  createDeliverer,
  updateDelivererStatus,
  deleteDeliverer
} = require('../controllers/deliverersController');

// All deliverer routes require authentication
// You can add middleware here to verify JWT token and super admin role

router.get('/', getDeliverers);
router.get('/:id', getDelivererById);
router.post('/', createDeliverer);
router.put('/:id/status', updateDelivererStatus);
router.delete('/:id', deleteDeliverer);

module.exports = router;