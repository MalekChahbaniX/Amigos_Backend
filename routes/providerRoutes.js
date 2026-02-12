const express = require('express');
const router = express.Router();
const { isProvider, protect } = require('../middleware/auth');
const {
  getProviders,
  getProviderById,
  getProvidersByType,
  getProductsByProviderId,
  search,
  createProvider,
  updateProvider,
  updateProviderStatus,
  deleteProvider,
  getProviderProfile,
  getProviderEarnings,
  getProviderDailyBalance,
  payProviderBalance,
  logoutProvider,
  getProviderOrders,
  updateProviderOrderStatus,
  getProviderOrderStats,
  acceptOrder,
} = require('../controllers/providerController');

// Routes protégées pour les prestataires connectés (DOIVENT VENIR EN PREMIER)
// GET /api/providers/me/profile - Récupérer le profil du prestataire connecté
router.get('/me/profile', isProvider, getProviderProfile);

// GET /api/providers/me/earnings - Récupérer les gains du prestataire
router.get('/me/earnings', isProvider, getProviderEarnings);

// GET /api/providers/me/daily-balance - Récupérer l'historique des soldes quotidiens
router.get('/me/daily-balance', isProvider, getProviderDailyBalance);

// PUT /api/providers/me/balance/pay - Marquer un solde comme payé
router.put('/me/balance/pay', isProvider, payProviderBalance);

// POST /api/providers/logout - Déconnexion du prestataire
router.post('/logout', isProvider, logoutProvider);

// GET /api/providers/me/orders - Récupérer les commandes du prestataire
router.get('/me/orders', isProvider, getProviderOrders);

// GET /api/providers/me/orders/stats - Statistiques des commandes
router.get('/me/orders/stats', isProvider, getProviderOrderStats);

// PUT /api/providers/me/orders/:orderId/status - Mettre à jour le statut
router.put('/me/orders/:orderId/status', isProvider, updateProviderOrderStatus);

// PUT /api/providers/me/orders/:orderId/accept - Accepter une commande
router.put('/me/orders/:orderId/accept', isProvider, acceptOrder);

// Routes publiques pour les prestataires et produits
router.get('/', getProviders);
router.get('/type/:type', getProvidersByType);
router.post('/', createProvider);
router.put('/:id', updateProvider);
router.patch('/:id/status', updateProviderStatus);
router.delete('/:id', deleteProvider);

// Route pour la recherche (statique, avant :id)
router.get('/search', search);

// Route pour les produits (statique, avant :id)
router.get('/products/:providerId', getProductsByProviderId);

// Route paramétrée (DOIT VENIR EN DERNIER)
router.get('/:id', getProviderById);

module.exports = router;