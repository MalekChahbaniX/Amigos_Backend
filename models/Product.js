// models/Product.js - IMPROVED with Unit System
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    
    // ============================================
    // UNIT SYSTEM - Core pricing structure
    // ============================================
    unitType: {
      type: String,
      enum: ['piece', 'weight', 'volume', 'variable'],
      default: 'piece',
      required: true,
      // 'piece': Pizza, burger (unités fixes)
      // 'weight': Viande, fromage (kg, g)
      // 'volume': Huile, jus (L, ml)
      // 'variable': Produits avec plusieurs variantes (sizes)
    },
    
    unit: {
      type: String,
      enum: ['piece', 'kg', 'g', 'L', 'ml', 'unit'],
      default: 'piece',
      // L'unité de base du produit
    },
    
    // Prix de base (pour unitType = 'piece', 'weight', 'volume')
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    
    // Quantité de base (pour weight/volume)
    // Ex: 1 kg, 500g, 1L, 250ml
    baseQuantity: {
      type: Number,
      default: 1,
    },
    
    // ============================================
    // VARIANTS SYSTEM - Pour produits variables
    // ============================================
    variants: [{
      name: { 
        type: String, 
        required: true, 
        trim: true 
      }, // Ex: "Petite", "500g", "1L"
      
      quantity: { 
        type: Number, 
        required: true 
      }, // La quantité (1, 0.5, 2)
      
      unit: { 
        type: String, 
        required: true 
      }, // L'unité (piece, kg, L)
      
      price: { 
        type: Number, 
        required: true, 
        min: 0 
      },
      
      stock: { 
        type: Number, 
        default: 0 
      },
      
      // Commission par variante (optionnel, sinon utilise celle du produit)
      csR: { 
        type: Number, 
        enum: [0, 5, 10] 
      },
      csC: { 
        type: Number, 
        enum: [0, 5, 10] 
      },
      
      p1: { type: Number, default: 0 },
      p2: { type: Number, default: 0 },
      
      sku: { 
        type: String 
      }, // Code unique pour cette variante
    }],
    
    // ============================================
    // STOCK SYSTEM
    // ============================================
    stock: {
      type: Number,
      default: 0,
    },
    
    // Pour weight/volume: indique si on suit le stock en unités continues
    trackContinuousStock: {
      type: Boolean,
      default: false,
      // true: on suit 15.5 kg, 3.2 L
      // false: on suit en unités entières
    },
    
    // Stock minimum avant alerte
    minStockAlert: {
      type: Number,
      default: 5,
    },
    
    category: {
      type: String,
      required: true,
      trim: true,
    },
    
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: false,
    },
    
    promo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Promo',
      required: false,
    },
    
    image: {
      type: String,
    },
    
    status: {
      type: String,
      enum: ['available', 'out_of_stock', 'discontinued'],
      default: 'available',
    },
    
    optionGroups: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OptionGroup',
      required: false,
    }],
    
    // ============================================
    // COMMISSION SYSTEM
    // ============================================
    csR: {
      type: Number,
      enum: [0, 5, 10],
      default: 5,
    },
    csC: {
      type: Number,
      enum: [0, 5, 10],
      default: 0,
    },
    p1: {
      type: Number,
      default: 0,
    },
    p2: {
      type: Number,
      default: 0,
    },
    
    deliveryCategory: {
      type: String,
      enum: ['restaurant', 'course', 'pharmacy'],
      default: 'restaurant',
    },
    
    requiresPrescription: {
      type: Boolean,
      default: false,
    },
    
    availability: {
      type: Boolean,
      default: true,
    },
    
    // ============================================
    // METADATA
    // ============================================
    tags: [String], // Ex: ['bio', 'local', 'halal']
    sku: String, // Code produit unique
  },
  {
    timestamps: true,
  }
);

// ============================================
// PRE-SAVE HOOK: Calculate P1 and P2
// ============================================
productSchema.pre('save', function(next) {
  // Calculate for base product
  if (this.price) {
    const csR = this.csR || 0;
    const csC = this.csC || 0;
    this.p1 = this.price * (1 - csR / 100);
    this.p2 = this.price * (1 + csC / 100);
  }
  
  // Calculate for each variant
  if (this.variants && this.variants.length > 0) {
    this.variants.forEach(variant => {
      const variantCsR = variant.csR !== undefined ? variant.csR : (this.csR || 0);
      const variantCsC = variant.csC !== undefined ? variant.csC : (this.csC || 0);
      variant.p1 = variant.price * (1 - variantCsR / 100);
      variant.p2 = variant.price * (1 + variantCsC / 100);
    });
  }
  
  next();
});

// ============================================
// METHODS
// ============================================

// Get display price based on unitType
productSchema.methods.getDisplayPrice = function() {
  if (this.unitType === 'variable' && this.variants.length > 0) {
    const prices = this.variants.map(v => v.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    if (minPrice === maxPrice) {
      return `${minPrice.toFixed(2)} DT`;
    }
    return `${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)} DT`;
  }
  
  return `${this.price.toFixed(2)} DT/${this.unit}`;
};

// Check if product has sufficient stock
productSchema.methods.hasStock = function(quantity, variantId = null) {
  if (this.unitType === 'variable' && variantId) {
    const variant = this.variants.id(variantId);
    return variant && variant.stock >= quantity;
  }
  
  return this.stock >= quantity;
};

// Reduce stock after order
productSchema.methods.reduceStock = function(quantity, variantId = null) {
  if (this.unitType === 'variable' && variantId) {
    const variant = this.variants.id(variantId);
    if (variant) {
      variant.stock -= quantity;
    }
  } else {
    this.stock -= quantity;
  }
  
  // Update status if out of stock
  if (this.stock <= 0 || (variantId && this.variants.id(variantId)?.stock <= 0)) {
    this.status = 'out_of_stock';
  }
};

// Indexes
productSchema.index({ name: 1 });
productSchema.index({ category: 1 });
productSchema.index({ status: 1 });
productSchema.index({ provider: 1 });
productSchema.index({ unitType: 1 });
productSchema.index({ sku: 1 });
productSchema.index({ requiresPrescription: 1 });
productSchema.index({ 'variants.sku': 1 });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;