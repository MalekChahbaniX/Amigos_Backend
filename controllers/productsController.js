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
        stock: product.stock || 0,
        status: product.status,
        image: product.image,
        options: options
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
      stock: product.stock || 0,
      status: product.status,
      image: product.image,
      options: options
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
    const { name, description, price, category, stock, status, providerId, promoId, image, options } = req.body;

    // ✅ Vérification minimale
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

    // ✅ Création du produit
    const product = await Product.create({
      name,
      description,
      price: parseFloat(price),
      category,
      stock: parseInt(stock) || 0,
      status: status || 'available',
      provider: provider ? provider._id : null,
      promo: promo ? promo._id : null,
      ...(image && { image }),
    });

    // ✅ Créer les groupes d'options si fournis
    if (options && Array.isArray(options) && options.length > 0) {
      const OptionGroup = require('../models/OptionGroup');
      const ProductOption = require('../models/ProductOption');

      for (const optionGroup of options) {
        // Créer le groupe d'options
        const group = await OptionGroup.create({
          name: optionGroup.name,
          description: optionGroup.name, // Utiliser le nom comme description
          storeId: provider ? provider._id : null,
        });

        // Créer les options du groupe
        if (optionGroup.subOptions && Array.isArray(optionGroup.subOptions)) {
          for (const subOption of optionGroup.subOptions) {
            const option = await ProductOption.create({
              name: subOption.name,
              price: subOption.price || 0,
              storeId: provider ? provider._id : null,
            });

            // Ajouter l'option au groupe
            group.options.push({
              option: option._id,
              name: subOption.name,
              price: subOption.price || 0,
            });
          }
          await group.save();
        }

        // Lier le groupe au produit
        product.optionGroups.push(group._id);
      }
      await product.save();
    }

    await product.populate('provider', 'name type');
    await product.populate('promo', 'name status');
    await product.populate({
      path: 'optionGroups',
      populate: {
        path: 'options.option',
        model: 'ProductOption'
      }
    });

    // Convert optionGroups to the expected options format for response
    const formattedOptions = product.optionGroups ? product.optionGroups.map(group => ({
      name: group.name,
      required: false, // Default to optional
      maxSelections: 1, // Default to 1
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
        stock: product.stock,
        status: product.status,
        image: product.image,
        options: formattedOptions,
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


// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Super Admin only)
exports.updateProduct = async (req, res) => {
  try {
    const { name, description, price, category, stock, status, image, providerId, promoId } = req.body;

    const updateData = {};

    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price) updateData.price = parseFloat(price);
    if (category) updateData.category = category;
    if (stock !== undefined) updateData.stock = parseInt(stock);
    if (status) updateData.status = status;
    if (image !== undefined) updateData.image = image;

    // 🧩 Optionnel : changement de prestataire
    if (providerId) {
      if (!mongoose.Types.ObjectId.isValid(providerId)) {
        return res.status(400).json({ message: 'ID du prestataire invalide' });
      }
      updateData.provider = providerId;
    } else if (providerId === null) {
      updateData.provider = null; // retirer le prestataire
    }

    // 🧩 Optionnel : ajout ou suppression de promo
    if (promoId) {
      if (!mongoose.Types.ObjectId.isValid(promoId)) {
        return res.status(400).json({ message: 'ID de promo invalide' });
      }
      updateData.promo = promoId;
    } else if (promoId === null) {
      updateData.promo = null; // retirer la promo
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .populate('provider', 'name type')
      .populate('promo', 'name status');

    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    res.status(200).json({
      message: 'Produit mis à jour avec succès',
      product: {
        id: product._id.toString(),
        name: product.name,
        category: product.category,
        provider: product.provider ? product.provider.name : null,
        promo: product.promo ? product.promo.name : null,
        price: product.price,
        stock: product.stock,
        status: product.status,
        image: product.image,
      },
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du produit' });
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