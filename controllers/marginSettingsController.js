const MarginSettings = require('../models/MarginSettings');

// @desc    Get current margin settings
// @route   GET /api/margin-settings
// @access  Private (admin)
exports.getMarginSettings = async (req, res) => {
  try {
    const settings = await MarginSettings.findOne({ isActive: true });
    
    if (!settings) {
      // Créer les paramètres par défaut s'ils n'existent pas
      const defaultSettings = new MarginSettings({
        C1: { marge: 0.00, minimum: 0.00, maximum: 0.00, description: '1 point livraison' },
        C2: { marge: 0.00, minimum: 0.00, maximum: 0.00, description: '2 points livraison' },
        C3: { marge: 0.00, minimum: 0.00, maximum: 0.00, description: '3 points livraison' },
        isActive: true
      });
      
      await defaultSettings.save();
      
      return res.status(200).json({
        success: true,
        data: {
          id: defaultSettings._id,
          C1: defaultSettings.C1,
          C2: defaultSettings.C2,
          C3: defaultSettings.C3,
          isActive: defaultSettings.isActive,
          lastUpdated: defaultSettings.lastUpdated
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: settings._id,
        C1: settings.C1,
        C2: settings.C2,
        C3: settings.C3,
        isActive: settings.isActive,
        lastUpdated: settings.lastUpdated
      }
    });
  } catch (error) {
    console.error('Error getting margin settings:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des paramètres de marge',
      error: error.message
    });
  }
};

// @desc    Update margin settings
// @route   PUT /api/margin-settings
// @access  Private (admin)
exports.updateMarginSettings = async (req, res) => {
  try {
    const { C1, C2, C3, isActive } = req.body;

    // Validation
    if (C1 && (C1.minimum > C1.maximum)) {
      return res.status(400).json({
        success: false,
        message: 'Pour C1, le minimum ne peut pas être supérieur au maximum'
      });
    }

    if (C2 && (C2.minimum > C2.maximum)) {
      return res.status(400).json({
        success: false,
        message: 'Pour C2, le minimum ne peut pas être supérieur au maximum'
      });
    }

    if (C3 && (C3.minimum > C3.maximum)) {
      return res.status(400).json({
        success: false,
        message: 'Pour C3, le minimum ne peut pas être supérieur au maximum'
      });
    }

    let settings = await MarginSettings.findOne({ isActive: true });

    if (!settings) {
      // Créer si n'existe pas
      settings = new MarginSettings({
        C1: C1 || { marge: 0.00, minimum: 0.00, maximum: 0.00, description: '1 point livraison' },
        C2: C2 || { marge: 0.00, minimum: 0.00, maximum: 0.00, description: '2 points livraison' },
        C3: C3 || { marge: 0.00, minimum: 0.00, maximum: 0.00, description: '3 points livraison' },
        isActive: isActive !== undefined ? isActive : true,
        updatedBy: req.user?._id
      });
    } else {
      // Mettre à jour
      if (C1) {
        settings.C1 = { ...settings.C1, ...C1 };
      }
      if (C2) {
        settings.C2 = { ...settings.C2, ...C2 };
      }
      if (C3) {
        settings.C3 = { ...settings.C3, ...C3 };
      }
      if (isActive !== undefined) {
        settings.isActive = isActive;
      }
      settings.updatedBy = req.user?._id;
    }

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Paramètres de marge mis à jour avec succès',
      data: {
        id: settings._id,
        C1: settings.C1,
        C2: settings.C2,
        C3: settings.C3,
        isActive: settings.isActive,
        lastUpdated: settings.lastUpdated
      }
    });
  } catch (error) {
    console.error('Error updating margin settings:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des paramètres de marge',
      error: error.message
    });
  }
};

// @desc    Calculate margin for a specific order type and amount
// @route   POST /api/margin-settings/calculate
// @access  Private (admin)
exports.calculateMargin = async (req, res) => {
  try {
    const { orderType, baseAmount } = req.body;

    if (!orderType || !['C1', 'C2', 'C3'].includes(orderType)) {
      return res.status(400).json({
        success: false,
        message: 'orderType doit être C1, C2, ou C3'
      });
    }

    const marginConfig = await MarginSettings.getMarginByType(orderType);
    const calculatedMargin = await MarginSettings.calculateMargin(orderType, baseAmount);

    res.status(200).json({
      success: true,
      data: {
        orderType,
        baseAmount,
        marginConfig,
        calculatedMargin,
        appliedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error calculating margin:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du calcul de la marge',
      error: error.message
    });
  }
};

// @desc    Get margin history/log
// @route   GET /api/margin-settings/history
// @access  Private (admin)
exports.getMarginHistory = async (req, res) => {
  try {
    // Récupérer tous les paramètres (y compris inactifs) pour l'historique
    const allSettings = await MarginSettings.find({})
      .sort({ lastUpdated: -1 })
      .limit(10);

    const history = allSettings.map(setting => ({
      id: setting._id,
      C1: setting.C1,
      C2: setting.C2,
      C3: setting.C3,
      isActive: setting.isActive,
      lastUpdated: setting.lastUpdated,
      updatedBy: setting.updatedBy,
      createdAt: setting.createdAt
    }));

    res.status(200).json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error getting margin history:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique des marges',
      error: error.message
    });
  }
};
