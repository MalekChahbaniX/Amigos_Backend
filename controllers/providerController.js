const Provider = require('../models/Provider');
const Product = require('../models/Product');
const bcrypt = require('bcryptjs');

// Labels pour l'affichage frontend
const typeLabels = {
  restaurant: 'Restaurant',
  course: 'Supermarché',
  pharmacy: 'Pharmacie',
  store: 'Magasin'
};


exports.updateProviderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        message: 'Statut invalide. Utilisez "active" ou "inactive"'
      });
    }

    const provider = await Provider.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!provider) {
      return res.status(404).json({ message: 'Prestataire non trouvé' });
    }

    res.status(200).json({
      message: 'Statut du prestataire mis à jour avec succès',
      provider: {
        id: provider._id.toString(),
        status: provider.status
      }
    });
  } catch (error) {
    console.error('Error updating provider status:', error);
    res.status(500).json({
      message: 'Erreur lors de la mise à jour du statut',
      error:   error.message
    });
  }
};

exports.deleteProvider = async (req, res) => {
  try {
    const provider = await Provider.findByIdAndDelete(req.params.id);
    if (!provider) {
      return res.status(404).json({ message: 'Prestataire non trouvé' });
    }
    res.status(200).json({
      message: 'Prestataire supprimé avec succès'
    });
  } catch (error) {
    console.error('Error deleting provider:', error);
    res.status(500).json({
      message: 'Erreur lors de la suppression du prestataire',
      error:   error.message
    });
  }
};

exports.search = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    const providers = await Provider.find({ name: { $regex: q, $options: 'i' } });
    const products = await Product.find({ name: { $regex: q, $options: 'i' } });
    res.json({ providers, products });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getProvidersByType = async (req, res) => {
  try {
    const providers = await Provider.find({ type: req.params.type });
    res.json(providers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getProductsByProviderId = async (req, res) => {
  try {
    const products = await Product.find({ provider: req.params.providerId });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Get all providers
exports.getProviders = async (req, res) => {
  try {
    const { type, search } = req.query;
    let query = {};

    if (type && type !== 'all') {
      query.type = type;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const providers = await Provider.find(query).select('-__v').sort({ createdAt: -1 });

    const formattedProviders = providers.map(provider => ({
      id: provider._id.toString(),
      name: provider.name,
      type: provider.type,
      category: typeLabels[provider.type] || provider.type,
      phone: provider.phone,
      address: provider.address,
      status: provider.status,
      image: provider.image, // Photo de couverture
      profileImage: provider.profileImage, // NOUVEAU : Photo de profil
      location: provider.location,
      totalOrders: 0,
      rating: 0,
    }));

    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    res.json({ providers: formattedProviders });
  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des prestataires',
      error:   error.message
    });
  }
};

// @desc Get a single provider and its menu
exports.getProviderById = async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.id);
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found' });
    }
    const menu = await Product.find({ provider: req.params.id });
    res.json({ provider, menu });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Create new provider
exports.createProvider = async (req, res) => {
  try {
    // Ajouter profileImage et password à la destructuration
    const { name, type, phone, address, email, password, description, image, profileImage, location } = req.body;

    if (!name || !phone || !address || !email || !password) {
      return res.status(400).json({
        message: 'Nom, téléphone, adresse, email et mot de passe sont requis'
      });
    }

    const orConditions = [{ phone }];
    if (email) {
      orConditions.push({ email: email.toLowerCase() });
    }
    
    const existingProvider = await Provider.findOne({ $or: orConditions });
    
    if (existingProvider) {
      return res.status(400).json({
        message: 'Un prestataire avec ce téléphone ou email existe déjà'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const provider = await Provider.create({
      name,
      type,
      phone,
      address,
      location,
      email: email.toLowerCase(),
      password: hashedPassword,
      ...(description && { description }),
      ...(image && { image }), // Couverture
      ...(profileImage && { profileImage }), // Profil
      status: 'active'
    });

    res.status(201).json({
      message: 'Prestataire créé avec succès',
      provider
    });
  } catch (error) {
    console.error('Error creating provider:', error);
    res.status(500).json({
      message: 'Erreur lors de la création du prestataire',
      error:   error.message
    });
  }
};

// @desc Update provider
exports.updateProvider = async (req, res) => {
  try {
    if (!req.params.id || req.params.id === 'undefined') {
      return res.status(400).json({ message: 'ID du prestataire invalide' });
    }

    // Ajouter profileImage et password à la destructuration
    const { name, type, phone, address, email, password, description, image, profileImage, location } = req.body;

    if (!name || !phone || !address) {
      return res.status(400).json({
        message: 'Nom, téléphone et adresse sont requis'
      });
    }

    const orConditions = [{ phone }];
    if (email) {
      orConditions.push({ email: email.toLowerCase() });
    }

    const existingProvider = await Provider.findOne({
      $or: orConditions,
      _id: { $ne: req.params.id }
    });

    if (existingProvider) {
      return res.status(400).json({
        message: 'Un autre prestataire utilise déjà ce téléphone ou email'
      });
    }

    // Hash password if provided
    let updateData = {
      name,
      type,
      phone,
      address,
      location,
      ...(email && { email: email.toLowerCase() }),
      ...(description !== undefined && { description }),
      ...(image && { image }), // Mise à jour couverture
      ...(profileImage && { profileImage }), // Mise à jour profil
    };

    // Hash new password if provided
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const provider = await Provider.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!provider) {
      return res.status(404).json({ message: 'Prestataire non trouvé' });
    }

    res.status(200).json({
      message: 'Prestataire mis à jour avec succès',
      provider
    });
  } catch (error) {
    console.error('Error updating provider:', error);
    res.status(500).json({
      message: 'Erreur lors de la mise à jour du prestataire',
      error:   error.message
    });
  }
};

// @desc    Get provider earnings summary
// @route   GET /api/provider/me/earnings
// @access  Private (provider)
exports.getProviderEarnings = async (req, res) => {
  try {
    const providerId = req.user._id || req.user.providerId;
    if (!providerId) {
      return res.status(400).json({ message: 'Fournisseur non associé' });
    }

    const Provider = require('../models/Provider');
    const Order = require('../models/Order');

    const provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({ message: 'Prestataire non trouvé' });
    }

    // Aggregate earnings from delivered orders
    const deliveredOrders = await Order.find({
      provider: providerId,
      status: 'delivered'
    });

    const totalEarnings = deliveredOrders.reduce((sum, order) => sum + (order.restaurantPayout || 0), 0);
    const averageEarnings = deliveredOrders.length > 0 ? totalEarnings / deliveredOrders.length : 0;

    // Calculate daily balance info
    let totalUnpaid = 0;
    if (provider.dailyBalance && Array.isArray(provider.dailyBalance)) {
      totalUnpaid = provider.dailyBalance
        .filter(db => !db.paid)
        .reduce((sum, db) => sum + (db.totalPayout || 0), 0);
    }

    res.json({
      success: true,
      earnings: {
        totalEarnings: Number(totalEarnings.toFixed(3)),
        averageEarnings: Number(averageEarnings.toFixed(3)),
        deliveredOrders: deliveredOrders.length,
        totalUnpaid: Number(totalUnpaid.toFixed(3)),
        currency: 'DT'
      }
    });
  } catch (error) {
    console.error('Error in getProviderEarnings:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// @desc    Get provider daily balance history
// @route   GET /api/provider/me/daily-balance
// @access  Private (provider)
exports.getProviderDailyBalance = async (req, res) => {
  try {
    const providerId = req.user._id || req.user.providerId;
    if (!providerId) {
      return res.status(400).json({ message: 'Fournisseur non associé' });
    }

    const Provider = require('../models/Provider');
    const provider = await Provider.findById(providerId)
      .populate({
        path: 'dailyBalance.orders',
        select: 'orderNumber restaurantPayout clientProductsPrice finalAmount createdAt deliveryDriver'
      });

    if (!provider) {
      return res.status(404).json({ message: 'Prestataire non trouvé' });
    }

    // Format daily balance data
    const dailyBalanceFormatted = (provider.dailyBalance || [])
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(db => ({
        id: db._id,
        date: db.date,
        orders: (db.orders || []).map(o => ({
          id: o._id,
          orderNumber: o.orderNumber,
          payout: o.restaurantPayout || 0
        })),
        totalPayout: db.totalPayout || 0,
        paymentMode: db.paymentMode || 'especes',
        paid: db.paid,
        paidAt: db.paidAt,
        orderCount: (db.orders || []).length
      }));

    res.json({
      success: true,
      provider: {
        id: provider._id,
        name: provider.name,
        type: provider.type
      },
      dailyBalance: dailyBalanceFormatted,
      currency: 'DT'
    });
  } catch (error) {
    console.error('Error in getProviderDailyBalance:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// @desc    Confirm provider payout (cash-out)
// @route   PUT /api/provider/me/pay-balance
// @access  Private (provider)
exports.payProviderBalance = async (req, res) => {
  try {
    const providerId = req.user._id || req.user.providerId;
    const { balanceId, paymentMode } = req.body;

    if (!providerId || !balanceId) {
      return res.status(400).json({ message: 'Paramètres requis: providerId, balanceId' });
    }

    if (!['especes', 'facture', 'virement'].includes(paymentMode)) {
      return res.status(400).json({ message: 'Mode de paiement invalide' });
    }

    const Provider = require('../models/Provider');
    const provider = await Provider.findById(providerId);

    if (!provider) {
      return res.status(404).json({ message: 'Prestataire non trouvé' });
    }

    // Find and update the balance entry
    const balanceEntry = provider.dailyBalance?.find(db => db._id.toString() === balanceId);
    if (!balanceEntry) {
      return res.status(404).json({ message: 'Solde journalier non trouvé' });
    }

    balanceEntry.paid = true;
    balanceEntry.paidAt = new Date();
    balanceEntry.paymentMode = paymentMode;

    await provider.save();

    console.log(`💰 Provider ${providerId}: Balance paid - amount=${balanceEntry.totalPayout}, mode=${paymentMode}`);

    res.json({
      success: true,
      message: 'Solde payé avec succès',
      balance: {
        id: balanceEntry._id,
        amount: balanceEntry.totalPayout,
        paymentMode: balanceEntry.paymentMode,
        paidAt: balanceEntry.paidAt
      }
    });
  } catch (error) {
    console.error('Error in payProviderBalance:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// @desc    Get provider profile
// @route   GET /api/provider/me/profile
// @access  Private (provider)
exports.getProviderProfile = async (req, res) => {
  try {
    const providerId = req.user._id || req.user.providerId;
    if (!providerId) {
      return res.status(400).json({ message: 'Fournisseur non associé' });
    }

    const Provider = require('../models/Provider');
    const provider = await Provider.findById(providerId);

    if (!provider) {
      return res.status(404).json({ message: 'Prestataire non trouvé' });
    }

    res.json({
      success: true,
      provider: {
        id: provider._id,
        name: provider.name,
        type: provider.type,
        phone: provider.phone,
        address: provider.address,
        email: provider.email,
        description: provider.description,
        location: provider.location,
        image: provider.image,
        profileImage: provider.profileImage,
        status: provider.status,
        createdAt: provider.createdAt
      }
    });
  } catch (error) {
    console.error('Error in getProviderProfile:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// @desc    Logout provider
// @route   POST /api/provider/logout
// @access  Private (provider)
exports.logoutProvider = async (req, res) => {
  try {
    // La déconnexion est généralement gérée côté client en supprimant le token
    // Mais on peut faire une validation ici si nécessaire
    
    console.log(`🚪 Provider ${req.user._id} logged out`);
    
    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });
  } catch (error) {
    console.error('Error in logoutProvider:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};
