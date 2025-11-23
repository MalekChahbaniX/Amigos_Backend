// models/Product.js (Updated - add these fields)
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
    // ADD THESE NEW FIELDS
    availability: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
productSchema.index({ name: 1 });
productSchema.index({ category: 1 });
productSchema.index({ status: 1 });
productSchema.index({ provider: 1 });
productSchema.index({ promo: 1 });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
