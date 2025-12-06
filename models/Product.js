// models/Product.js - Complete delivery system model
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
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    stock: {
      type: Number,
      default: 0,
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
    optionGroups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OptionGroup',
        required: false,
      },
    ],
    // SIZE SYSTEM FIELDS - Optional feature for restaurant products
sizes: [{
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0 },
    p1: { type: Number, default: 0 },
    p2: { type: Number, default: 0 },
}],
    // COMMISSION SYSTEM FIELDS
    csR: {
      type: Number,
      enum: [0, 5, 10],
      default: 5, // Commission restaurant (0%, 5%, 10%)
    },
    csC: {
      type: Number,
      enum: [0, 5, 10],
      default: 0, // Commission client (0%, 5%, 10%)
    },
    p1: {
      type: Number,
      default: 0, // Prix payout restaurant (P * (1 - csR/100))
    },
    p2: {
      type: Number,
      default: 0, // Prix client (P * (1 + csC/100))
    },
    // DELIVERY CATEGORY
    deliveryCategory: {
      type: String,
      enum: ['restaurant', 'course', 'pharmacy'],
      default: 'restaurant',
    },
    availability: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// PRE-SAVE HOOK: Calculate P1 and P2 automatically
productSchema.pre('save', function(next) {
  const P = this.price || 0;
  const csR = this.csR || 0;
  const csC = this.csC || 0;
  
  // Calculate P1 (payout restaurant)
  this.p1 = P * (1 - csR / 100);
  
  // Calculate P2 (prix client)
  this.p2 = P * (1 + csC / 100);
  
  // Calculate P1 and P2 for each size if sizes exist
  if (this.sizes && this.sizes.length > 0) {
    this.sizes.forEach(size => {
      size.p1 = size.price * (1 - csR / 100);
      size.p2 = size.price * (1 + csC / 100);
    });
  }
  
  next();
});

// Indexes
productSchema.index({ name: 1 });
productSchema.index({ category: 1 });
productSchema.index({ status: 1 });
productSchema.index({ provider: 1 });
productSchema.index({ promo: 1 });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
