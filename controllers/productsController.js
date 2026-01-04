// controllers/productsController.js - IMPROVED with Unit System

const Product = require('../models/Product');
const Provider = require('../models/Provider');
const mongoose = require('mongoose');

// ============================================
// EXAMPLES OF PRODUCT CREATION
// ============================================

/**
 * EXEMPLE 1: Pizza (pièce simple)
 * POST /api/products
 * {
 *   "name": "Pizza Margherita",
 *   "unitType": "piece",
 *   "unit": "piece",
 *   "price": 25,
 *   "stock": 50,
 *   "category": "Pizza"
 * }
 */

/**
 * EXEMPLE 2: Viande (kg avec prix au kilo)
 * POST /api/products
 * {
 *   "name": "Viande hachée",
 *   "unitType": "weight",
 *   "unit": "kg",
 *   "price": 45,
 *   "baseQuantity": 1,
 *   "stock": 25,
 *   "trackContinuousStock": true,
 *   "category": "Viande"
 * }
 */

/**
 * EXEMPLE 3: Huile (volume avec prix au litre)
 * POST /api/products
 * {
 *   "name": "Huile d'olive",
 *   "unitType": "volume",
 *   "unit": "L",
 *   "price": 18,
 *   "baseQuantity": 1,
 *   "stock": 100,
 *   "category": "Épicerie"
 * }
 */

/**
 * EXEMPLE 4: Pizza avec tailles (variable)
 * POST /api/products
 * {
 *   "name": "Pizza 4 fromages",
 *   "unitType": "variable",
 *   "unit": "piece",
 *   "category": "Pizza",
 *   "variants": [
 *     {
 *       "name": "Petite",
 *       "quantity": 1,
 *       "unit": "piece",
 *       "price": 20,
 *       "stock": 30
 *     },
 *     {
 *       "name": "Moyenne",
 *       "quantity": 1,
 *       "unit": "piece",
 *       "price": 28,
 *       "stock": 25
 *     },
 *     {
 *       "name": "Grande",
 *       "quantity": 1,
 *       "unit": "piece",
 *       "price": 35,
 *       "stock": 20
 *     }
 *   ]
 * }
 */

/**
 * EXEMPLE 5: Viande avec portions (variable)
 * POST /api/products
 * {
 *   "name": "Escalope de poulet",
 *   "unitType": "variable",
 *   "unit": "kg",
 *   "category": "Viande",
 *   "variants": [
 *     {
 *       "name": "250g",
 *       "quantity": 0.25,
 *       "unit": "kg",
 *       "price": 8,
 *       "stock": 50
 *     },
 *     {
 *       "name": "500g",
 *       "quantity": 0.5,
 *       "unit": "kg",
 *       "price": 15,
 *       "stock": 40
 *     },
 *     {
 *       "name": "1kg",
 *       "quantity": 1,
 *       "unit": "kg",
 *       "price": 28,
 *       "stock": 25
 *     }
 *   ]
 * }
 */

// ============================================
// CONTROLLERS
// ============================================

// Create product with unit system
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
      optionGroups,
      availability,
      csR,
      csC,
      deliveryCategory,
      // NEW: Unit system fields
      unitType,
      unit,
      baseQuantity,
      variants,
      trackContinuousStock,
      minStockAlert,
      tags,
      sku,
    } = req.body;

    // Validation
    if (!name || !category) {
      return res.status(400).json({ message: 'Nom et catégorie sont requis' });
    }

    // Validate unitType
    if (!unitType || !['piece', 'weight', 'volume', 'variable'].includes(unitType)) {
      return res.status(400).json({ 
        message: 'unitType invalide. Doit être: piece, weight, volume, ou variable' 
      });
    }

    // For non-variable products, price is required
    if (unitType !== 'variable' && !price) {
      return res.status(400).json({ 
        message: 'Prix requis pour les produits non-variables' 
      });
    }

    // For variable products, variants are required
    if (unitType === 'variable' && (!variants || variants.length === 0)) {
      return res.status(400).json({ 
        message: 'Variantes requises pour unitType "variable"' 
      });
    }

    // Provider validation
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

    // Promo validation
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

    // Calculate commissions
    const csRNum = csR || 5;
    const csCNum = csC || 0;

    // Process variants if provided
    let processedVariants = [];
    if (variants && variants.length > 0) {
      processedVariants = variants.map((variant, index) => ({
        name: variant.name,
        quantity: parseFloat(variant.quantity) || 1,
        unit: variant.unit || unit || 'piece',
        price: parseFloat(variant.price),
        stock: parseInt(variant.stock) || 0,
        csR: variant.csR !== undefined ? variant.csR : csRNum,
        csC: variant.csC !== undefined ? variant.csC : csCNum,
        sku: variant.sku || `${sku || 'PROD'}-VAR${index + 1}`,
      }));
    }

    // Create product
    const productData = {
      name,
      description,
      category,
      status: status || 'available',
      provider: provider ? provider._id : null,
      promo: promo ? promo._id : null,
      optionGroups: optionGroups || [],
      availability: availability !== false,
      csR: csRNum,
      csC: csCNum,
      deliveryCategory: deliveryCategory || 'restaurant',
      // Unit system fields
      unitType: unitType || 'piece',
      unit: unit || 'piece',
      baseQuantity: baseQuantity || 1,
      variants: processedVariants,
      trackContinuousStock: trackContinuousStock || false,
      minStockAlert: minStockAlert || 5,
      tags: tags || [],
      sku: sku || `PROD-${Date.now()}`,
      ...(image && { image }),
    };

    // Add price and stock for non-variable products
    if (unitType !== 'variable') {
      productData.price = parseFloat(price);
      productData.stock = parseInt(stock) || 0;
    } else {
      // For variable products, set a default price (lowest variant price)
      productData.price = processedVariants.length > 0 
        ? Math.min(...processedVariants.map(v => v.price))
        : 0;
      productData.stock = 0; // Stock tracked per variant
    }

    const product = await Product.create(productData);

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
    const response = formatProductResponse(product);

    res.status(201).json({
      message: 'Produit créé avec succès',
      product: response,
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      message: 'Erreur lors de la création du produit',
      error: error.message,
    });
  }
};

// Get all products
exports.getProducts = async (req, res) => {
  try {
    const { 
      search = '', 
      category = '', 
      unitType = '',
      page = 1, 
      limit = 12 
    } = req.query;

    let query = {};

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    // Category filter
    if (category && category !== 'all') {
      query.category = category;
    }

    // Unit type filter
    if (unitType && unitType !== 'all') {
      query.unitType = unitType;
    }

    const totalProducts = await Product.countDocuments(query);

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

    console.log(`📦 Found ${products.length} products for page ${page}`);

    const formattedProducts = products.map(product => {
      const formatted = formatProductResponse(product);
      // if (formatted.variants) {
      //   console.log(`✅ Product "${formatted.name}" has ${formatted.variants.length} variants:`, formatted.variants);
      // }
      return formatted;
    });

    console.log('📤 Sending response with products:', formattedProducts.map(p => ({ name: p.name, variantCount: p.variants?.length || 0 })));

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
      error: error.message
    });
  }
};

// Get product by ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('provider', 'name type phone address')
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

    const formattedProduct = formatProductResponse(product);
    res.status(200).json(formattedProduct);

  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération du produit',
      error: error.message
    });
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  try {
    const updateData = { ...req.body };

    // Calculate P1 and P2 if price or commissions changed
    if (updateData.price || updateData.csR !== undefined || updateData.csC !== undefined) {
      const currentProduct = await Product.findById(req.params.id);
      const price = updateData.price !== undefined ? parseFloat(updateData.price) : currentProduct.price;
      const csR = updateData.csR !== undefined ? updateData.csR : currentProduct.csR;
      const csC = updateData.csC !== undefined ? updateData.csC : currentProduct.csC;
      
      updateData.p1 = price * (1 - csR / 100);
      updateData.p2 = price * (1 + csC / 100);
    }

    // Process variants if provided
    if (updateData.variants && updateData.variants.length > 0) {
      updateData.variants = updateData.variants.map((variant, index) => ({
        name: variant.name,
        quantity: variant.quantity || 1,
        unit: variant.unit || 'piece',
        price: parseFloat(variant.price),
        stock: parseInt(variant.stock) || 0,
        csR: variant.csR !== undefined ? variant.csR : (updateData.csR || 5),
        csC: variant.csC !== undefined ? variant.csC : (updateData.csC || 0),
        p1: 0, // Will be calculated by pre-save hook
        p2: 0, // Will be calculated by pre-save hook
        sku: variant.sku || `PROD-${Date.now()}-${index}`,
      }));
    }

    // Clear the old sizes field if it exists
    updateData.sizes = [];

    const product = await Product.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { new: true }
    )
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

    const formattedProduct = formatProductResponse(product);

    res.status(200).json({
      message: 'Produit mis à jour avec succès',
      product: formattedProduct,
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la mise à jour du produit',
      error: error.message 
    });
  }
};

// Delete product
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
      error: error.message
    });
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatProductResponse(product) {
  const options = product.optionGroups ? product.optionGroups.map(group => ({
    name: group.name,
    required: false,
    maxSelections: group.max || 1,
    subOptions: group.options ? group.options.map(opt => ({
      name: opt.name || opt.option?.name,
      price: opt.price || opt.option?.price || 0
    })) : []
  })) : [];

  const response = {
    id: product._id.toString(),
    name: product.name,
    description: product.description,
    category: product.category,
    provider: product.provider ? product.provider.name : 'Prestataire inconnu',
    status: product.status,
    image: product.image,
    options: options,
    availability: product.availability,
    
    // Unit system fields
    unitType: product.unitType,
    unit: product.unit,
    baseQuantity: product.baseQuantity,
    trackContinuousStock: product.trackContinuousStock,
    
    // Pricing
    price: product.price,
    p1: product.p1,
    p2: product.p2,
    csR: product.csR,
    csC: product.csC,
    
    deliveryCategory: product.deliveryCategory,
    
    // Display price
    displayPrice: product.getDisplayPrice(),
    
    tags: product.tags || [],
    sku: product.sku,
  };

  // Add stock for non-variable products
  if (product.unitType !== 'variable') {
    response.stock = product.stock;
  }

  // Add variants if they exist (regardless of unitType)
  if (product.variants && product.variants.length > 0) {
    response.variants = product.variants.map(variant => ({
      id: variant._id.toString(),
      name: variant.name,
      quantity: variant.quantity,
      unit: variant.unit,
      price: variant.price,
      stock: variant.stock,
      csR: variant.csR,
      csC: variant.csC,
      p1: variant.p1,
      p2: variant.p2,
      sku: variant.sku,
    }));
  }

  return response;
}

exports.getProductsByProvider = async (req, res) => {
  try {
    const { providerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(400).json({ message: 'ID du prestataire invalide' });
    }

    const products = await Product.find({ 
      provider: new mongoose.Types.ObjectId(providerId) 
    }).sort({ createdAt: -1 });

    const formattedProducts = products.map(product => formatProductResponse(product));

    res.status(200).json(formattedProducts);

  } catch (error) {
    console.error('Error fetching products by provider:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des produits',
      error: error.message
    });
  }
};