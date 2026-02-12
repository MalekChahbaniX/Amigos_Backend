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
  },
  providers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
  }],
  _providersValidate: {
    type: Boolean,
    default: function() {
      // Validation happens via validate function below
      return true;
    }
  },
  promo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Promo',
  },
  items: [
    {
      providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider',
        required: true,
      },
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
  // PROVIDER FEES: Fees calculated per provider
  providerFees: [{
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
    deliveryFee: {
      type: Number,
      required: true,
    },
    appFee: {
      type: Number,
      required: true,
    },
    p1Total: {
      type: Number,
      required: true,
    },
    p2Total: {
      type: Number,
      required: true,
    },
    distance: {
      type: Number,
    },
  }],
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
    enum: ['pending', 'accepted', 'preparing', 'collected', 'in_delivery', 'delivered', 'cancelled'],
    default: 'pending',
  },
  // Provider response tracking
  providerAcceptedAt: {
    type: Date,
    default: null,
  },
  providerTimeoutAt: {
    type: Date,
    default: null,
  },
  // CANCELLATION FIELDS
  cancellationType: {
    type: String,
    enum: ['ANNULER_1', 'ANNULER_2', 'ANNULER_3'],
    default: null,
    sparse: true,
  },
  cancellationSolde: {
    type: Number,
    default: null,
  },
  cancellationReason: {
    type: String,
    default: null,
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  cancelledAt: {
    type: Date,
    default: null,
  },
  autoCancelledAt: {
    type: Date,
    default: null,
  },
  autoCancel: {
    type: Boolean,
    default: false,
  },
  // PROVIDER PAYMENT: Payment method(s) for grouped orders
  // Can be string for single order or array for grouped orders
  providerPaymentMode: {
    type: mongoose.Schema.Types.Mixed, // Can be 'especes' | 'facture' (string) or array of {provider, mode}
    default: 'especes'
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
    enum: ['cash', 'online', 'card'],
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
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
  // Order type categorization (A1..A4)
  // Assigned dynamically when transitioning to 'in_delivery' based on grouping and urgency
  orderType: {
    type: String,
    enum: ['A1', 'A2', 'A3', 'A4'],
    default: null
  },
  // Mark urgent orders (A4) so they can be prioritized and never grouped
  isUrgent: {
    type: Boolean,
    default: false
  },
  // Solde breakdowns for different calculations/reporting
  soldeSimple: {
    type: Number,
    default: 0
  },
  soldeDual: {
    type: Number,
    default: 0
  },
  soldeTriple: {
    type: Number,
    default: 0
  },
  soldeAmigos: {
    type: Number,
    default: 0
  },
  // Grouping support: list of grouped order IDs and a flag
  groupedOrders: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    }
  ],
  isGrouped: {
    type: Boolean,
    default: false
  },
  // Processing and scheduling to allow small delay batching (e.g., 5-10 minutes)
  processingDelay: {
    type: Number, // delay in minutes
    default: 0
  },
  scheduledFor: {
    type: Date,
    default: null
  },
  // PROMO
  appliedPromo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Promo',
  },
  assignedAt: {
    type: Date,
    default: null,
  },
  // PROTECTION WINDOW: Orders are protected from being picked up for 3 minutes after creation
  // protectionEnd = createdAt + 3 minutes (180000ms)
  protectionEnd: {
    type: Date,
    default: null,
  },
  // ROOM 15 Minutes: For hot/fresh products requiring quick preparation
  // roomEnd = createdAt + 15 minutes (900000ms)
  isRoomOrder: {
    type: Boolean,
    default: false,
  },
  roomEnd: {
    type: Date,
    default: null,
  },
  // PRESCRIPTION RELATED FIELDS
  prescription: {
    type: {
      type: String,
      enum: ['photo', 'text', 'none'],
      default: 'none',
    },
    imageUrl: String, // URL of uploaded prescription image
    textContent: String, // Manually entered prescription text
    fileName: String, // Original filename
    fileSize: Number, // Size in bytes
    uploadedAt: Date, // Timestamp of prescription upload
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Validation: providers must have 1-2 elements
orderSchema.pre('validate', function(next) {
  // Allow providers array with 1-2 elements
  if (this.providers && Array.isArray(this.providers)) {
    if (this.providers.length < 1 || this.providers.length > 2) {
      return next(new Error('Une commande doit contenir entre 1 et 2 prestataires'));
    }
    return next();
  }
  // For backward compatibility, if no providers but has provider, create providers array
  if (this.provider && (!this.providers || this.providers.length === 0)) {
    this.providers = [this.provider];
    return next();
  }
  // If neither providers nor provider exists, this will fail on save
  next(new Error('Une commande doit contenir au moins 1 prestataire'));
});

const Order = mongoose.model('Order', orderSchema);

// Virtual for orderGenre
orderSchema.virtual('orderGenre').get(function() {
  const providersList = this.providers && this.providers.length > 0 ? this.providers : (this.provider ? [this.provider] : []);
  return providersList.length === 1 ? 'C1' : 'C2';
});

// Enable virtuals in JSON and Object output
orderSchema.set('toJSON', { virtuals: true });
orderSchema.set('toObject', { virtuals: true });

orderSchema.index({ status: 1, orderType: 1, isGrouped: 1, scheduledFor: 1 });
// Keep provider+zone+scheduledFor index for provider/zone based grouping/batching
orderSchema.index({ provider: 1, zone: 1, scheduledFor: 1 });
orderSchema.index({ providers: 1 });
orderSchema.index({ status: 1, protectionEnd: 1 });
orderSchema.index({ isUrgent: 1, protectionEnd: 1 });
orderSchema.index({ 'prescription.type': 1 });
orderSchema.index({ isRoomOrder: 1, roomEnd: 1 });


module.exports = Order;