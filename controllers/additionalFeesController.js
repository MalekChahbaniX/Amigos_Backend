const AdditionalFees = require('../models/AdditionalFees');

// @desc    Get current additional fees
// @route   GET /api/additional-fees
// @access  Private (admin)
exports.getAdditionalFees = async (req, res) => {
  try {
    const fees = await AdditionalFees.findOne({ isActive: true });
    
    if (!fees) {
      // Créer les frais par défaut s'ils n'existent pas
      const defaultFees = new AdditionalFees({
        FRAIS_1: { amount: 0.00, description: 'Frais de traitement C1', appliesTo: ['C1'] },
        FRAIS_2: { amount: 0.00, description: 'Frais de service', appliesTo: ['ALL'] },
        FRAIS_3: { amount: 0.00, description: 'Frais de plateforme', appliesTo: ['ALL'] },
        FRAIS_4: { amount: 0, description: 'Frais additionnels', appliesTo: [] },
        isActive: true
      });
      
      await defaultFees.save();
      
      return res.status(200).json({
        success: true,
        data: {
          id: defaultFees._id,
          FRAIS_1: defaultFees.FRAIS_1,
          FRAIS_2: defaultFees.FRAIS_2,
          FRAIS_3: defaultFees.FRAIS_3,
          FRAIS_4: defaultFees.FRAIS_4,
          isActive: defaultFees.isActive,
          lastUpdated: defaultFees.lastUpdated
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: fees._id,
        FRAIS_1: fees.FRAIS_1,
        FRAIS_2: fees.FRAIS_2,
        FRAIS_3: fees.FRAIS_3,
        FRAIS_4: fees.FRAIS_4,
        isActive: fees.isActive,
        lastUpdated: fees.lastUpdated
      }
    });
  } catch (error) {
    console.error('Error getting additional fees:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des frais additionnels',
      error: error.message
    });
  }
};

// @desc    Update additional fees
// @route   PUT /api/additional-fees
// @access  Private (admin)
exports.updateAdditionalFees = async (req, res) => {
  try {
    const { FRAIS_1, FRAIS_2, FRAIS_3, FRAIS_4, isActive } = req.body;

    let fees = await AdditionalFees.findOne({ isActive: true });

    if (!fees) {
      // Créer si n'existe pas
      fees = new AdditionalFees({
        FRAIS_1: FRAIS_1 || { amount: 0.00, description: 'Frais de traitement C1', appliesTo: ['C1'] },
        FRAIS_2: FRAIS_2 || { amount: 0.00, description: 'Frais de service', appliesTo: ['ALL'] },
        FRAIS_3: FRAIS_3 || { amount: 0.00, description: 'Frais de plateforme', appliesTo: ['ALL'] },
        FRAIS_4: FRAIS_4 || { amount: 0, description: 'Frais additionnels', appliesTo: [] },
        isActive: isActive !== undefined ? isActive : true,
        updatedBy: req.user?._id
      });
    } else {
      // Mettre à jour
      if (FRAIS_1) {
        fees.FRAIS_1 = { ...fees.FRAIS_1, ...FRAIS_1 };
      }
      if (FRAIS_2) {
        fees.FRAIS_2 = { ...fees.FRAIS_2, ...FRAIS_2 };
      }
      if (FRAIS_3) {
        fees.FRAIS_3 = { ...fees.FRAIS_3, ...FRAIS_3 };
      }
      if (FRAIS_4) {
        fees.FRAIS_4 = { ...fees.FRAIS_4, ...FRAIS_4 };
      }
      if (isActive !== undefined) {
        fees.isActive = isActive;
      }
      fees.updatedBy = req.user?._id;
    }

    await fees.save();

    res.status(200).json({
      success: true,
      message: 'Frais additionnels mis à jour avec succès',
      data: {
        id: fees._id,
        FRAIS_1: fees.FRAIS_1,
        FRAIS_2: fees.FRAIS_2,
        FRAIS_3: fees.FRAIS_3,
        FRAIS_4: fees.FRAIS_4,
        isActive: fees.isActive,
        lastUpdated: fees.lastUpdated
      }
    });
  } catch (error) {
    console.error('Error updating additional fees:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des frais additionnels',
      error: error.message
    });
  }
};

// @desc    Calculate applicable fees for an order type
// @route   POST /api/additional-fees/calculate
// @access  Private (admin)
exports.calculateApplicableFees = async (req, res) => {
  try {
    const { orderType } = req.body;

    if (!orderType || !['C1', 'C2', 'C3', 'A1', 'A2', 'A3', 'A4'].includes(orderType)) {
      return res.status(400).json({
        success: false,
        message: 'orderType doit être C1, C2, C3, A1, A2, A3, ou A4'
      });
    }

    const feesResult = await AdditionalFees.calculateApplicableFees(orderType);
    const feesBreakdown = await AdditionalFees.getFeesBreakdown(orderType);

    res.status(200).json({
      success: true,
      data: {
        orderType,
        totalFees: feesResult.totalFees,
        applicableFees: feesResult.applicableFees,
        feesBreakdown,
        calculatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error calculating applicable fees:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du calcul des frais applicables',
      error: error.message
    });
  }
};

// @desc    Get fees history/log
// @route   GET /api/additional-fees/history
// @access  Private (admin)
exports.getFeesHistory = async (req, res) => {
  try {
    // Récupérer tous les frais (y compris inactifs) pour l'historique
    const allFees = await AdditionalFees.find({})
      .sort({ lastUpdated: -1 })
      .limit(10);

    const history = allFees.map(fees => ({
      id: fees._id,
      FRAIS_1: fees.FRAIS_1,
      FRAIS_2: fees.FRAIS_2,
      FRAIS_3: fees.FRAIS_3,
      FRAIS_4: fees.FRAIS_4,
      isActive: fees.isActive,
      lastUpdated: fees.lastUpdated,
      updatedBy: fees.updatedBy,
      createdAt: fees.createdAt
    }));

    res.status(200).json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error getting fees history:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique des frais',
      error: error.message
    });
  }
};

// @desc    Test fees calculation for all order types
// @route   GET /api/additional-fees/test-all
// @access  Private (admin)
exports.testAllOrderTypes = async (req, res) => {
  try {
    const orderTypes = ['C1', 'C2', 'C3', 'A1', 'A2', 'A3', 'A4'];
    const results = {};

    for (const orderType of orderTypes) {
      const feesResult = await AdditionalFees.calculateApplicableFees(orderType);
      const feesBreakdown = await AdditionalFees.getFeesBreakdown(orderType);
      
      results[orderType] = {
        totalFees: feesResult.totalFees,
        applicableFees: feesResult.applicableFees,
        breakdown: feesBreakdown
      };
    }

    res.status(200).json({
      success: true,
      message: 'Test de calcul des frais pour tous les types de commandes',
      data: results,
      testedAt: new Date()
    });
  } catch (error) {
    console.error('Error testing all order types:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du test des types de commandes',
      error: error.message
    });
  }
};
