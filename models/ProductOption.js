// models/ProductOption.js (IMPROVED VERSION)
const mongoose = require('mongoose');

const productOptionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    default: 0,
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    required: false,
  },
  image: {
    type: String,
  },
  availability: {
    type: Boolean,
    default: true,
  },
  dineIn: {
    type: Boolean,
    default: true,
  },
  delivery: {
    type: Boolean,
    default: true,
  },
  takeaway: {
    type: Boolean,
    default: true,
  },
  optionGroups: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OptionGroup',
  }],
}, {
  timestamps: true,
});

productOptionSchema.index({ name: 1 });
productOptionSchema.index({ storeId: 1 });

const ProductOption = mongoose.model('ProductOption', productOptionSchema);

module.exports = ProductOption;
