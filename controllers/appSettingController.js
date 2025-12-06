const AppSetting = require('../models/AppSetting');

/**
 * Récupérer les paramètres actuels de l'application
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const getAppSettings = async (req, res) => {
  try {
    const setting = await AppSetting.findOne();

    // Si aucun paramètre n'existe, retourner les valeurs par défaut
    if (!setting) {
      return res.status(200).json({
        success: true,
        data: {
          appFee: 1.0,
          currency: 'TND',
          message: 'Paramètres par défaut utilisés'
        }
      });
    }

    res.status(200).json({
      success: true,
      data: setting
    });
  } catch (err) {
    console.error('Erreur lors de la récupération des paramètres:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des paramètres'
    });
  }
};

/**
 * Créer ou mettre à jour les paramètres de l'application
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const updateAppSettings = async (req, res) => {
  try {
    const { appFee, currency, updatedBy } = req.body;

    // Validation des données
    if (appFee !== undefined && (isNaN(appFee) || appFee < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Les frais d\'application doivent être un nombre positif'
      });
    }

    if (currency && typeof currency !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'La devise doit être une chaîne de caractères'
      });
    }

    // Préparation des données de mise à jour
    const updateData = {
      updatedAt: new Date()
    };

    if (appFee !== undefined) updateData.appFee = appFee;
    if (currency !== undefined) updateData.currency = currency;
    // Ne pas inclure updatedBy si ce n'est pas fourni
    if (updatedBy !== undefined && updatedBy !== null && updatedBy !== '') {
      updateData.updatedBy = updatedBy;
    }

    // Création ou mise à jour des paramètres
    const setting = await AppSetting.findOneAndUpdate(
      {}, // Recherche du premier document (il ne devrait y en avoir qu'un)
      updateData,
      {
        upsert: true, // Créer si n'existe pas
        new: true,   // Retourner le document mis à jour
        runValidators: true // Appliquer les validations du schéma
      }
    );

    res.status(200).json({
      success: true,
      message: 'Paramètres mis à jour avec succès',
      data: setting
    });
  } catch (err) {
    console.error('Erreur lors de la mise à jour des paramètres:', err);

    // Gestion spécifique des erreurs de validation MongoDB
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Erreur de validation',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la mise à jour des paramètres'
    });
  }
};

/**
 * Réinitialiser les paramètres aux valeurs par défaut
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const resetAppSettings = async (req, res) => {
  try {
    const { updatedBy } = req.body;

    const defaultSettings = {
      appFee: 1.0,
      currency: 'TND',
      updatedAt: new Date()
    };

    // N'ajouter updatedBy que s'il est fourni
    if (updatedBy !== undefined && updatedBy !== null && updatedBy !== '') {
      defaultSettings.updatedBy = updatedBy;
    }

    const setting = await AppSetting.findOneAndUpdate(
      {},
      defaultSettings,
      {
        upsert: true,
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      message: 'Paramètres réinitialisés aux valeurs par défaut',
      data: setting
    });
  } catch (err) {
    console.error('Erreur lors de la réinitialisation des paramètres:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la réinitialisation des paramètres'
    });
  }
};

/**
 * Récupérer uniquement les frais d'application
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const getAppFee = async (req, res) => {
  try {
    const setting = await AppSetting.findOne().select('appFee currency');

    if (!setting) {
      return res.status(200).json({
        success: true,
        appFee: 1.0,
        currency: 'TND'
      });
    }

    res.status(200).json({
      success: true,
      appFee: setting.appFee,
      currency: setting.currency
    });
  } catch (err) {
    console.error('Erreur lors de la récupération des frais:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des frais'
    });
  }
};

module.exports = {
  getAppSettings,
  updateAppSettings,
  resetAppSettings,
  getAppFee
};