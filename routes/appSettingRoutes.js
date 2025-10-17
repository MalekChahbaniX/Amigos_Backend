const express = require('express');
const router = express.Router();
const {
  getAppSettings,
  updateAppSettings,
  resetAppSettings,
  getAppFee
} = require('../controllers/appSettingController');

// 🔹 Récupérer les paramètres actuels de l'application
router.get('/', getAppSettings);

// 🔹 Récupérer uniquement les frais d'application
router.get('/fee', getAppFee);

// 🔹 Mettre à jour les paramètres de l'application
router.put('/', updateAppSettings);

// 🔹 Réinitialiser les paramètres aux valeurs par défaut
router.put('/reset', resetAppSettings);

module.exports = router;
