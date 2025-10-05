const express = require('express');
const router = express.Router();
const {
  getProviders,
  getProviderById,
  getProvidersByType,
  getProductsByProviderId,
  search,
  createProvider,
  updateProviderStatus,
  deleteProvider,
} = require('../controllers/providerController');

// Routes pour les prestataires et produits
router.get('/', getProviders);
router.get('/type/:type', getProvidersByType);
router.get('/:id', getProviderById);
router.post('/', createProvider);
router.patch('/:id/status', updateProviderStatus);
router.delete('/:id', deleteProvider);

// Route pour la recherche
router.get('/search', search);

// Route pour les produits
router.get('/products/:providerId', getProductsByProviderId);

module.exports = router;