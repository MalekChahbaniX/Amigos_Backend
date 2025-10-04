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
  image: {
    type: String,
  },
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    required: true,
  },
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;