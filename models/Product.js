const mongoose = require('mongoose');
const Provider = require('./Provider');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  price: {
    type: Number,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  stock: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['available', 'out_of_stock', 'discontinued'],
    default: 'available',
  },
  image: {
    type: String,
  },
    // 🧩 Le provider est maintenant optionnel
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    required: false,
  },

  // 🧩 Nouveau : possibilité d’associer une promo
  promo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Promo',
    required: false,
  },

  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for better performance
productSchema.index({ name: 1 });
productSchema.index({ category: 1 });
productSchema.index({ status: 1 });
productSchema.index({ provider: 1 });
productSchema.index({ promo: 1 });

const Product = mongoose.model('Product', productSchema);
module.exports = Product;