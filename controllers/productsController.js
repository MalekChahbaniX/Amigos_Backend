const Product = require('../models/Product');
const Provider = require('../models/Provider');
const mongoose = require('mongoose');

// @desc    Get all products with optional search and filtering
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res) => {
  try {
    const { search = '', category = '', page = 1, limit = 12 } = req.query;

    // Build search query
    let query = {};

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Category filter
    if (category && category !== 'all') {
      query.category = category;
    }

    // Get total count for pagination
    const totalProducts = await Product.countDocuments(query);

    // Get products with pagination and populate provider info
    const products = await Product.find(query)
      .populate('provider', 'name type')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Format products data for frontend
    const formattedProducts = products.map(product => ({
      id: product._id.toString(),
      name: product.name,
      category: product.category,
      provider: product.provider ? product.provider.name : 'Prestataire inconnu',
      price: product.price,
      stock: product.stock || 0,
      status: product.status,
      image: product.image
    }));

    // Add cache-busting headers
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    res.status(200).json({
      products: formattedProducts,
      total: totalProducts,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalProducts / limit)
    });

  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des produits',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get product by ID
// @route   GET /api/products/:id
// @access  Public
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('provider', 'name type phone address');

    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    const formattedProduct = {
      id: product._id.toString(),
      name: product.name,
      description: product.description,
      category: product.category,
      provider: product.provider ? product.provider.name : 'Prestataire inconnu',
      price: product.price,
      stock: product.stock || 0,
      status: product.status,
      image: product.image
    };

    res.status(200).json(formattedProduct);

  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération du produit',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private (Super Admin only)
exports.createProduct = async (req, res) => {
  try {
    const { name, description, price, category, stock, status, providerId, image } = req.body;

    // Validation
    if (!name || !price || !category) {
      return res.status(400).json({
        message: 'Nom, prix et catégorie sont requis'
      });
    }

    // Validate providerId format
    if (!providerId || !mongoose.Types.ObjectId.isValid(providerId)) {
      console.error('Invalid providerId format:', providerId);
      return res.status(400).json({
        message: 'ID du prestataire invalide'
      });
    }

    // Validate provider exists and log the ID for debugging
    console.log('Looking for provider with ID:', providerId);
    const provider = await Provider.findById(providerId);
    if (!provider) {
      console.error('Provider not found with ID:', providerId);
      console.error('Available providers:', await Provider.find({}, '_id name'));
      return res.status(404).json({
        message: 'Prestataire non trouvé. Veuillez d\'abord créer un prestataire.'
      });
    }

    console.log('Creating product for provider:', provider.name, 'with ID:', provider._id);

    // Create new product
    const product = await Product.create({
      name,
      description,
      price: parseFloat(price),
      category,
      stock: parseInt(stock) || 0,
      status: status || 'available',
      provider: provider._id, // Use the actual provider object ID
      ...(image && { image }) // Add image if provided
    });

    console.log('Product created successfully:', product._id, 'with image:', image);

    // Populate provider info for response
    await product.populate('provider', 'name type');

    const formattedProduct = {
      id: product._id.toString(),
      name: product.name,
      description: product.description,
      category: product.category,
      provider: product.provider ? product.provider.name : 'Prestataire inconnu',
      price: product.price,
      stock: product.stock,
      status: product.status,
      image: product.image
    };

    res.status(201).json({
      message: 'Produit créé avec succès',
      product: formattedProduct
    });

  } catch (error) {
    console.error('Error creating product:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      message: 'Erreur lors de la création du produit',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Super Admin only)
exports.updateProduct = async (req, res) => {
  try {
    const { name, description, price, category, stock, status, image } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price) updateData.price = parseFloat(price);
    if (category) updateData.category = category;
    if (stock !== undefined) updateData.stock = parseInt(stock);
    if (status) updateData.status = status;
    if (image !== undefined) updateData.image = image;

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('provider', 'name type');

    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    const formattedProduct = {
      id: product._id.toString(),
      name: product.name,
      description: product.description,
      category: product.category,
      provider: product.provider ? product.provider.name : 'Prestataire inconnu',
      price: product.price,
      stock: product.stock,
      status: product.status,
      image: product.image
    };

    res.status(200).json({
      message: 'Produit mis à jour avec succès',
      product: formattedProduct
    });

  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      message: 'Erreur lors de la mise à jour du produit',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (Super Admin only)
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    res.status(200).json({
      message: 'Produit supprimé avec succès'
    });

  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      message: 'Erreur lors de la suppression du produit',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get products by provider
// @route   GET /api/products/provider/:providerId
// @access  Public
exports.getProductsByProvider = async (req, res) => {
  try {
    const products = await Product.find({ provider: req.params.providerId })
      .sort({ createdAt: -1 });

    const formattedProducts = products.map(product => ({
      id: product._id.toString(),
      name: product.name,
      description: product.description,
      category: product.category,
      price: product.price,
      stock: product.stock,
      status: product.status,
      image: product.image
    }));

    res.status(200).json(formattedProducts);

  } catch (error) {
    console.error('Error fetching products by provider:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des produits',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};