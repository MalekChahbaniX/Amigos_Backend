const express = require('express');
const router = express.Router();
const {
  createPromo,
  updatePromoStatus,
  updatePromo,
  getAllPromos,
  getPromoById,
  deletePromo
} = require('../controllers/promoController');

// 🔹 Créer une nouvelle promotion
router.post('/create', createPromo);

// 🔹 Récupérer une promotion par son ID
router.get('/:id', getPromoById);

// 🔹 Activer/Désactiver une promotion
router.put('/:id/status', updatePromoStatus);

// 🔹 Modifier une promotion
router.put('/:id', updatePromo);

// 🔹 Supprimer une promotion
router.delete('/:id', deletePromo);

// 🔹 Liste des promotions (avec pagination et filtres)
router.get('/', getAllPromos);

module.exports = router;
