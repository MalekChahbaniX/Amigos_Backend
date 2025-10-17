const Product = require('../models/Product');
const Promo = require('../models/Promo');
const Provider = require('../models/Provider');
const mongoose = require('mongoose');

/**
 * Fonction utilitaire de pagination
 */
const paginate = (page, limit) => {
  const p = Math.max(parseInt(page) || 1, 1);
  const l = Math.max(parseInt(limit) || 12, 1);
  const skip = (p - 1) * l;
  return { skip, limit: l };
};

/**
 * Récupérer les produits liés à une promotion spécifique
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const getProductsByPromo = async (req, res) => {
  try {
    const { promoId } = req.params;
    const { search = '', page = 1, limit = 12 } = req.query;

    // Validation de l'ID de promo
    if (!mongoose.Types.ObjectId.isValid(promoId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de promotion invalide'
      });
    }

    // Vérification que la promo existe
    const promo = await Promo.findById(promoId);
    if (!promo) {
      return res.status(404).json({
        success: false,
        message: 'Promotion non trouvée'
      });
    }

    // Construction de la requête
    const query = {
      promo: promoId,
      ...(search && {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } },
        ],
      }),
    };

    const total = await Product.countDocuments(query);
    const { skip, limit: l } = paginate(page, limit);

    const products = await Product.find(query)
      .populate('provider', 'name type')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(l);

    res.status(200).json({
      success: true,
      promo: promo.name,
      count: total,
      totalPages: Math.ceil(total / l),
      page: parseInt(page),
      products: products.map(p => ({
        id: p._id.toString(),
        name: p.name,
        category: p.category,
        provider: p.provider ? p.provider.name : null,
        price: p.price,
        status: p.status,
        image: p.image,
      })),
    });
  } catch (err) {
    console.error('Erreur lors de la récupération des produits par promo:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des produits'
    });
  }
};

/**
 * Récupérer les produits sans promotion
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const getProductsWithoutPromo = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 12 } = req.query;

    const query = {
      $or: [{ promo: { $exists: false } }, { promo: null }],
      ...(search && {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } },
        ],
      }),
    };

    const total = await Product.countDocuments(query);
    const { skip, limit: l } = paginate(page, limit);

    const products = await Product.find(query)
      .populate('provider', 'name type')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(l);

    res.status(200).json({
      success: true,
      count: total,
      totalPages: Math.ceil(total / l),
      page: parseInt(page),
      products: products.map(p => ({
        id: p._id.toString(),
        name: p.name,
        category: p.category,
        provider: p.provider ? p.provider.name : null,
        price: p.price,
        status: p.status,
        image: p.image,
      })),
    });
  } catch (err) {
    console.error('Erreur lors de la récupération des produits sans promo:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des produits'
    });
  }
};

/**
 * Assigner une promotion à un produit
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const assignPromoToProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { promoId } = req.body;

    // Validation des IDs
    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(promoId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de produit ou de promotion invalide'
      });
    }

    // Vérification que la promo existe
    const promo = await Promo.findById(promoId);
    if (!promo) {
      return res.status(404).json({
        success: false,
        message: 'Promotion non trouvée'
      });
    }

    // Vérification que le produit existe et mise à jour
    const product = await Product.findByIdAndUpdate(
      productId,
      { promo: promo._id },
      { new: true }
    ).populate('provider', 'name type')
     .populate('promo', 'name status');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      message: `Produit "${product.name}" associé à la promotion "${promo.name}" avec succès`,
      data: product,
    });
  } catch (err) {
    console.error('Erreur lors de l\'assignation de la promo au produit:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'assignation de la promotion'
    });
  }
};

/**
 * Retirer la promotion d'un produit
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const removePromoFromProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    // Validation de l'ID du produit
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de produit invalide'
      });
    }

    // Vérification que le produit existe et suppression de la promo
    const product = await Product.findByIdAndUpdate(
      productId,
      { $unset: { promo: '' } },
      { new: true }
    ).populate('provider', 'name type');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      message: `Promotion retirée du produit "${product.name}" avec succès`,
      data: product,
    });
  } catch (err) {
    console.error('Erreur lors du retrait de la promo du produit:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du retrait de la promotion'
    });
  }
};

/**
 * Récupérer les produits d'un prestataire avec ou sans promotion
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const getProviderProducts = async (req, res) => {
  try {
    const { providerId } = req.params;
    const { search = '', page = 1, limit = 12 } = req.query;

    // Validation de l'ID du prestataire
    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de prestataire invalide'
      });
    }

    // Vérification que le prestataire existe
    const provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Prestataire non trouvé'
      });
    }

    // Construction de la requête
    const query = {
      provider: providerId,
      ...(search && {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } },
        ],
      }),
    };

    const total = await Product.countDocuments(query);
    const { skip, limit: l } = paginate(page, limit);

    const products = await Product.find(query)
      .populate('promo', 'name status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(l);

    res.status(200).json({
      success: true,
      provider: provider.name,
      total,
      totalPages: Math.ceil(total / l),
      page: parseInt(page),
      products: products.map(p => ({
        id: p._id.toString(),
        name: p.name,
        category: p.category,
        promo: p.promo ? p.promo.name : null,
        price: p.price,
        status: p.status,
        image: p.image,
      })),
    });
  } catch (err) {
    console.error('Erreur lors de la récupération des produits du prestataire:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des produits du prestataire'
    });
  }
};

module.exports = {
  getProductsByPromo,
  getProductsWithoutPromo,
  assignPromoToProduct,
  removePromoFromProduct,
  getProviderProducts
};