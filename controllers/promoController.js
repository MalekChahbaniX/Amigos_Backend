const Promo = require('../models/Promo');

/**
 * Créer une nouvelle promotion
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const createPromo = async (req, res) => {
  try {
    const promo = new Promo(req.body);
    await promo.save();
    res.status(201).json({
      success: true,
      message: 'Promotion créée avec succès',
      data: promo
    });
  } catch (err) {
    console.error('Erreur lors de la création de la promo:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Erreur lors de la création de la promotion'
    });
  }
};

/**
 * Activer/Désactiver une promotion
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const updatePromoStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Statut invalide. Utilisez "active" ou "closed"'
      });
    }

    const promo = await Promo.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!promo) {
      return res.status(404).json({
        success: false,
        message: 'Promotion non trouvée'
      });
    }

    res.status(200).json({
      success: true,
      message: `Promotion ${status === 'active' ? 'activée' : 'désactivée'} avec succès`,
      data: promo
    });
  } catch (err) {
    console.error('Erreur lors de la mise à jour du statut de la promo:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Erreur lors de la mise à jour du statut'
    });
  }
};

/**
 * Modifier une promotion
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const updatePromo = async (req, res) => {
  try {
    const { id } = req.params;

    const promo = await Promo.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!promo) {
      return res.status(404).json({
        success: false,
        message: 'Promotion non trouvée'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Promotion mise à jour avec succès',
      data: promo
    });
  } catch (err) {
    console.error('Erreur lors de la mise à jour de la promo:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Erreur lors de la mise à jour de la promotion'
    });
  }
};

/**
 * Récupérer toutes les promotions
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const getAllPromos = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const promos = await Promo.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Promo.countDocuments(query);

    res.status(200).json({
      success: true,
      data: promos,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        hasNext: parseInt(page) * parseInt(limit) < total,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (err) {
    console.error('Erreur lors de la récupération des promos:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des promotions'
    });
  }
};

/**
 * Récupérer une promotion par son ID
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const getPromoById = async (req, res) => {
  try {
    const { id } = req.params;

    const promo = await Promo.findById(id);

    if (!promo) {
      return res.status(404).json({
        success: false,
        message: 'Promotion non trouvée'
      });
    }

    res.status(200).json({
      success: true,
      data: promo
    });
  } catch (err) {
    console.error('Erreur lors de la récupération de la promo:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération de la promotion'
    });
  }
};

/**
 * Supprimer une promotion
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const deletePromo = async (req, res) => {
  try {
    const { id } = req.params;

    const promo = await Promo.findByIdAndDelete(id);

    if (!promo) {
      return res.status(404).json({
        success: false,
        message: 'Promotion non trouvée'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Promotion supprimée avec succès'
    });
  } catch (err) {
    console.error('Erreur lors de la suppression de la promo:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la suppression de la promotion'
    });
  }
};

module.exports = {
  createPromo,
  updatePromoStatus,
  updatePromo,
  getAllPromos,
  getPromoById,
  deletePromo
};