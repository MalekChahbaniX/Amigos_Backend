const Provider = require('../models/Provider');
const Product = require('../models/Product');

// @desc    Get all providers
// @route   GET /api/providers
// @access  Public
exports.getProviders = async (req, res) => {
  try {
    const { type, search } = req.query;

    let query = {};

    // Filter by type if specified
    if (type && type !== 'all') {
      query.type = type;
    }

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const providers = await Provider.find(query).sort({ createdAt: -1 });

    // Format response to match frontend expectations
    const formattedProviders = providers.map(provider => ({
      id: provider._id.toString(),
      name: provider.name,
      type: provider.type,
      category: typeLabels[provider.type] || provider.type,
      phone: provider.phone,
      address: provider.address,
      totalOrders: 0, // TODO: Calculate from orders when implemented
      rating: 0, // TODO: Calculate from reviews when implemented
      status: provider.status,
      image: provider.image
    }));

    // Add cache-busting headers
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

// @desc    Get a single provider and its menu
// @route   GET /api/providers/:id
// @access  Public
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

// @desc    Get providers by type
// @route   GET /api/providers/type/:type
// @access  Public
exports.getProvidersByType = async (req, res) => {
  try {
    const providers = await Provider.find({ type: req.params.type });
    res.json(providers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get products for a specific provider
// @route   GET /api/products/:providerId
// @access  Public
exports.getProductsByProviderId = async (req, res) => {
  try {
    const products = await Product.find({ provider: req.params.providerId });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create new provider
// @route   POST /api/providers
// @access  Private (Super Admin only)
exports.createProvider = async (req, res) => {
  try {
    const { name, type, phone, address, email, description, image } = req.body;

    // Validation
    if (!name || !phone || !address) {
      return res.status(400).json({
        message: 'Nom, téléphone et adresse sont requis'
      });
    }

    // Check if provider already exists
    const existingProvider = await Provider.findOne({
      $or: [
        { phone },
        ...(email && [{ email: email.toLowerCase() }])
      ]
    });

    if (existingProvider) {
      return res.status(400).json({
        message: 'Un prestataire avec ce téléphone ou email existe déjà'
      });
    }

    // Create new provider
    const provider = await Provider.create({
      name,
      type,
      phone,
      address,
      ...(email && { email: email.toLowerCase() }),
      ...(description && { description }),
      ...(image && { image }),
      status: 'active'
    });

    res.status(201).json({
      message: 'Prestataire créé avec succès',
      provider: {
        id: provider._id.toString(),
        name: provider.name,
        type: provider.type,
        category: typeLabels[provider.type] || provider.type,
        phone: provider.phone,
        address: provider.address,
        totalOrders: 0,
        rating: 0,
        status: provider.status,
        image: provider.image
      }
    });

  } catch (error) {
    console.error('Error creating provider:', error);
    res.status(500).json({
      message: 'Erreur lors de la création du prestataire',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update provider
// @route   PUT /api/providers/:id
// @access  Private (Super Admin only)
exports.updateProvider = async (req, res) => {
  try {
    const { name, type, phone, address, email, description, image } = req.body;

    // Validation
    if (!name || !phone || !address) {
      return res.status(400).json({
        message: 'Nom, téléphone et adresse sont requis'
      });
    }

    // Check if another provider with same phone or email exists
    const existingProvider = await Provider.findOne({
      $or: [
        { phone },
        ...(email && [{ email: email.toLowerCase() }])
      ],
      _id: { $ne: req.params.id }
    });

    if (existingProvider) {
      return res.status(400).json({
        message: 'Un prestataire avec ce téléphone ou email existe déjà'
      });
    }

    const provider = await Provider.findByIdAndUpdate(
      req.params.id,
      {
        name,
        type,
        phone,
        address,
        ...(email && { email: email.toLowerCase() }),
        ...(description !== undefined && { description }),
        ...(image && { image }),
      },
      { new: true }
    );

    if (!provider) {
      return res.status(404).json({ message: 'Prestataire non trouvé' });
    }

    res.status(200).json({
      message: 'Prestataire mis à jour avec succès',
      provider: {
        id: provider._id.toString(),
        name: provider.name,
        type: provider.type,
        category: typeLabels[provider.type] || provider.type,
        phone: provider.phone,
        address: provider.address,
        email: provider.email,
        description: provider.description,
        totalOrders: 0,
        rating: 0,
        status: provider.status,
        image: provider.image
      }
    });

  } catch (error) {
    console.error('Error updating provider:', error);
    res.status(500).json({
      message: 'Erreur lors de la mise à jour du prestataire',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update provider status
// @route   PATCH /api/providers/:id/status
// @access  Private (Super Admin only)
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

// @desc    Delete provider
// @route   DELETE /api/providers/:id
// @access  Private (Super Admin only)
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

// @desc    Search for providers or products
// @route   GET /api/search?q=...
// @access  Public
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

// Type labels for frontend display
const typeLabels = {
  restaurant: 'Restaurant',
  course: 'Supermarché',
  pharmacy: 'Pharmacie'
};