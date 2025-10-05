const express = require('express');
const router = express.Router();
const {
  getClients,
  getClientById,
  createClient,
  updateClientStatus,
  deleteClient
} = require('../controllers/clientsController');

// All client routes require authentication
// You can add middleware here to verify JWT token and super admin role

router.get('/', getClients);
router.get('/:id', getClientById);
router.post('/', createClient);
router.patch('/:id/status', updateClientStatus);
router.delete('/:id', deleteClient);

module.exports = router;