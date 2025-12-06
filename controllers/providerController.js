const Provider = require('../models/Provider');
const Product = require('../models/Product');

// Labels pour l'affichage frontend
const typeLabels = {
  restaurant: 'Restaurant',
  course: 'Supermarché',
  pharmacy: 'Pharmacie'
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
    // Ajouter profileImage à la destructuration
    const { name, type, phone, address, email, description, image, profileImage, location } = req.body;

    if (!name || !phone || !address) {
      return res.status(400).json({
        message: 'Nom, téléphone et adresse sont requis'
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

    const provider = await Provider.create({
      name,
      type,
      phone,
      address,
      location,
      ...(email && { email: email.toLowerCase() }),
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc Update provider
exports.updateProvider = async (req, res) => {
  try {
    if (!req.params.id || req.params.id === 'undefined') {
      return res.status(400).json({ message: 'ID du prestataire invalide' });
    }

    // Ajouter profileImage à la destructuration
    const { name, type, phone, address, email, description, image, profileImage, location } = req.body;

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

    const provider = await Provider.findByIdAndUpdate(
      req.params.id,
      {
        name,
        type,
        phone,
        address,
        location,
        ...(email && { email: email.toLowerCase() }),
        ...(description !== undefined && { description }),
        ...(image && { image }), // Mise à jour couverture
        ...(profileImage && { profileImage }), // Mise à jour profil
      },
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
