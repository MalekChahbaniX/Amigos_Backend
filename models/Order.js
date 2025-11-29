const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    required: true,
  },
  promo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Promo',
  },
  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: false, // Make optional to handle cases where product might not exist
      },
      name: {
        type: String,
        required: true,
      },
      price: {
        type: Number,
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
      p1: {
        type: Number,
        required: true, // Prix payout restaurant pour ce produit
      },
      p2: {
        type: Number,
        required: true, // Prix client pour ce produit
      },
      deliveryCategory: {
        type: String,
        enum: ['restaurant', 'course', 'pharmacy'],
        default: 'restaurant',
      },
    },
  ],
  // TOTALS
  totalAmount: {
    type: Number,
    required: true, // Total P2 + appFee + deliveryFee
  },
  clientProductsPrice: {
    type: Number,
    required: true, // Total P2 (sans frais)
  },
  restaurantPayout: {
    type: Number,
    required: true, // Total P1
  },
  deliveryFee: {
    type: Number,
    required: true, // Frais de livraison selon zone
  },
  appFee: {
    type: Number,
    required: true, // Frais application selon catégorie
  },
  platformSolde: {
    type: Number,
    required: true, // Solde plateforme = (P2_total - P1_total) + deliveryFee + appFee
  },
  // AUTRES CHAMPS
  status: {
    type: String,
    enum: ['pending', 'accepted', 'in_delivery', 'delivered', 'cancelled'],
    default: 'pending',
  },
  deliveryAddress: {
    street: String,
    city: String,
    zipCode: String,
    latitude: Number,
    longitude: Number,
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'online'],
    required: true,
  },
  deliveryDriver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  // ZONE ET CALCULS
  zone: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Zone',
  },
  distance: {
    type: Number, // Distance en km
  },
  // PRIX DÉTAILLÉS
  p1Total: {
    type: Number,
    required: true, // Total P1 de tous les produits
  },
  p2Total: {
    type: Number,
    required: true, // Total P2 de tous les produits
  },
  // PRIX FINAL CLIENT
  finalAmount: {
    type: Number,
    required: true, // P2_total + deliveryFee + appFee
  },
  // PROMO
  appliedPromo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Promo',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;