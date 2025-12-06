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

    // Get products with pagination and populate provider info and optionGroups
    const products = await Product.find(query)
      .populate('provider', 'name type')
      .populate({
        path: 'optionGroups',
        populate: {
          path: 'options.option',
          model: 'ProductOption'
        }
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Format products data for frontend
    const formattedProducts = products.map(product => {
      // Convert optionGroups to the expected options format
      const options = product.optionGroups ? product.optionGroups.map(group => ({
        name: group.name,
        required: false, // Default to optional, can be made configurable later
        maxSelections: 1, // Default to 1, can be made configurable later
        subOptions: group.options ? group.options.map(opt => ({
          name: opt.name || opt.option?.name,
          price: opt.price || opt.option?.price || 0
        })) : []
      })) : [];

      return {
        id: product._id.toString(),
        name: product.name,
        category: product.category,
        provider: product.provider ? product.provider.name : 'Prestataire inconnu',
        price: product.price,
        p1: product.p1,
        p2: product.p2,
        csR: product.csR,
        csC: product.csC,
        deliveryCategory: product.deliveryCategory,
        stock: product.stock || 0,
        status: product.status,
        image: product.image,
        options: options,
        availability: product.availability,
        sizes: product.sizes || []
      };
    });

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

    // Convert optionGroups to the expected options format
    const options = product.optionGroups ? product.optionGroups.map(group => ({
      name: group.name,
      required: false, // Default to optional, can be made configurable later
      maxSelections: 1, // Default to 1, can be made configurable later
      subOptions: group.options ? group.options.map(opt => ({
        name: opt.name || opt.option?.name,
        price: opt.price || opt.option?.price || 0
      })) : []
    })) : [];

    const formattedProduct = {
      id: product._id.toString(),
      name: product.name,
      description: product.description,
      category: product.category,
      provider: product.provider ? product.provider.name : 'Prestataire inconnu',
      price: product.price,
      p1: product.p1,
      p2: product.p2,
      csR: product.csR,
      csC: product.csC,
      deliveryCategory: product.deliveryCategory,
      stock: product.stock || 0,
      status: product.status,
      image: product.image,
      options: options,
      availability: product.availability,
      sizes: product.sizes || []
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
    const { providerId } = req.params;

    // Validate and convert providerId to ObjectId
    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(400).json({ message: 'ID du prestataire invalide' });
    }

    const products = await Product.find({ provider: new mongoose.Types.ObjectId(providerId) })
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


// Add this to your existing productsController.js

// @desc Create new product (UPDATED VERSION)
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      stock,
      status,
      providerId,
      promoId,
      image,
      optionGroups,  // NEW: Array of optionGroup IDs
      availability,   // NEW
      csR,            // NEW: Restaurant commission
      csC,            // NEW: Client commission
      deliveryCategory, // NEW: Delivery category
      sizes           // NEW: Array of sizes
    } = req.body;

    // Validation
    if (!name || !price || !category) {
      return res.status(400).json({ message: 'Nom, prix et catégorie sont requis' });
    }

    let provider = null;
    if (providerId) {
      if (!mongoose.Types.ObjectId.isValid(providerId)) {
        return res.status(400).json({ message: 'ID du prestataire invalide' });
      }
      provider = await Provider.findById(providerId);
      if (!provider) {
        return res.status(404).json({ message: 'Prestataire non trouvé.' });
      }
    }

    let promo = null;
    if (promoId) {
      const Promo = require('../models/Promo');
      if (!mongoose.Types.ObjectId.isValid(promoId)) {
        return res.status(400).json({ message: 'ID de promo invalide' });
      }
      promo = await Promo.findById(promoId);
      if (!promo) {
        return res.status(404).json({ message: 'Promo non trouvée.' });
      }
    }

    const priceNum = parseFloat(price);
    const csRNum = csR || 5;
    const csCNum = csC || 0;
    
    // Calculate P1 and P2
    const p1 = priceNum * (1 - csRNum / 100);
    const p2 = priceNum * (1 + csCNum / 100);

    // Create product with optionGroups and new pricing fields
    const product = await Product.create({
      name,
      description,
      price: priceNum,
      category,
      stock: parseInt(stock) || 0,
      status: status || 'available',
      provider: provider ? provider._id : null,
      promo: promo ? promo._id : null,
      optionGroups: optionGroups || [],  // Array of ObjectIds
      availability: availability !== false,
      csR: csRNum,
      csC: csCNum,
      p1: p1,
      p2: p2,
      deliveryCategory: deliveryCategory || 'restaurant', // Default to restaurant
      sizes: sizes || [], // Array of sizes
      ...(image && { image }),
    });

    await product.populate('provider', 'name type');
    await product.populate('promo', 'name status');
    await product.populate({
      path: 'optionGroups',
      populate: {
        path: 'options.option',
        model: 'ProductOption'
      }
    });

    // Format response
    const formattedOptions = product.optionGroups ? product.optionGroups.map(group => ({
      name: group.name,
      required: false,
      maxSelections: group.max || 1,
      subOptions: group.options ? group.options.map(opt => ({
        name: opt.name || opt.option?.name,
        price: opt.price || opt.option?.price || 0
      })) : []
    })) : [];

    res.status(201).json({
      message: 'Produit créé avec succès',
      product: {
        id: product._id.toString(),
        name: product.name,
        category: product.category,
        provider: product.provider ? product.provider.name : null,
        promo: product.promo ? product.promo.name : null,
        price: product.price,
        p1: product.p1,
        p2: product.p2,
        csR: product.csR,
        csC: product.csC,
        deliveryCategory: product.deliveryCategory,
        stock: product.stock,
        status: product.status,
        image: product.image,
        optionGroups: product.optionGroups.map(g => g._id.toString()),
        options: formattedOptions,
        availability: product.availability,
        sizes: product.sizes || []
      },
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      message: 'Erreur lors de la création du produit',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc Update product (UPDATED VERSION)
exports.updateProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      stock,
      status,
      image,
      providerId,
      promoId,
      optionGroups,  // NEW
      availability,   // NEW
      csR,            // NEW: Restaurant commission
      csC,            // NEW: Client commission
      deliveryCategory, // NEW: Delivery category
      sizes           // NEW: Array of sizes
    } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price) updateData.price = parseFloat(price);
    if (category) updateData.category = category;
    if (stock !== undefined) updateData.stock = parseInt(stock);
    if (status) updateData.status = status;
    if (image !== undefined) updateData.image = image;
    
    // NEW: Update commission settings
    if (csR !== undefined) updateData.csR = csR;
    if (csC !== undefined) updateData.csC = csC;
    if (deliveryCategory) updateData.deliveryCategory = deliveryCategory;
    
    // NEW: Update optionGroups
    if (optionGroups !== undefined) updateData.optionGroups = optionGroups;
    
    // NEW: Update availability settings
    if (availability !== undefined) updateData.availability = availability;
    
    // NEW: Update sizes
    if (sizes !== undefined) updateData.sizes = sizes;

    // Provider update
    if (providerId) {
      if (!mongoose.Types.ObjectId.isValid(providerId)) {
        return res.status(400).json({ message: 'ID du prestataire invalide' });
      }
      updateData.provider = providerId;
    } else if (providerId === null) {
      updateData.provider = null;
    }

    // Promo update
    if (promoId) {
      if (!mongoose.Types.ObjectId.isValid(promoId)) {
        return res.status(400).json({ message: 'ID de promo invalide' });
      }
      updateData.promo = promoId;
    } else if (promoId === null) {
      updateData.promo = null;
    }

    // Calculate P1 and P2 if csR or csC changed
    if (updateData.csR !== undefined || updateData.csC !== undefined || updateData.price !== undefined) {
      const currentProduct = await Product.findById(req.params.id);
      const price = updateData.price !== undefined ? updateData.price : currentProduct.price;
      const csR = updateData.csR !== undefined ? updateData.csR : currentProduct.csR;
      const csC = updateData.csC !== undefined ? updateData.csC : currentProduct.csC;
      
      updateData.p1 = price * (1 - csR / 100);
      updateData.p2 = price * (1 + csC / 100);
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .populate('provider', 'name type')
      .populate('promo', 'name status')
      .populate({
        path: 'optionGroups',
        populate: {
          path: 'options.option',
          model: 'ProductOption'
        }
      });

    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    // Format response
    const formattedOptions = product.optionGroups ? product.optionGroups.map(group => ({
      name: group.name,
      required: false,
      maxSelections: group.max || 1,
      subOptions: group.options ? group.options.map(opt => ({
        name: opt.name || opt.option?.name,
        price: opt.price || opt.option?.price || 0
      })) : []
    })) : [];

    res.status(200).json({
      message: 'Produit mis à jour avec succès',
      product: {
        id: product._id.toString(),
        name: product.name,
        category: product.category,
        provider: product.provider ? product.provider.name : null,
        promo: product.promo ? product.promo.name : null,
        price: product.price,
        p1: product.p1,
        p2: product.p2,
        csR: product.csR,
        csC: product.csC,
        deliveryCategory: product.deliveryCategory,
        stock: product.stock,
        status: product.status,
        image: product.image,
        optionGroups: product.optionGroups.map(g => g._id.toString()),
        options: formattedOptions,
        availability: product.availability,
        sizes: product.sizes || []
      },
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du produit' });
  }
};
