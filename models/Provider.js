const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['restaurant', 'pharmacy', 'course', 'store'],
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    lowercase: true,
  },
  password: {
    type: String,
  },
  description: {
    type: String,
  },
  location: {
    latitude: { type: Number, required: true }, // Rendre obligatoire pour le calcul
    longitude: { type: Number, required: true }, // Rendre obligatoire pour le calcul
    address: String
  },
  image: {
    type: String,
  },
  profileImage: {
    type: String, 
  },
  timeEstimate: {
    type: String,
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  paymentMethod: {
    type: String,
    enum: ['facture', 'espece'],
    default: 'espece'
  },
  workingHours: [
    {
      day: {
        type: String,
        enum: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'],
        required: true
      },
      isOpen: {
        type: Boolean,
        default: true
      },
      openTime: {
        type: String,
        default: "09:00"
      },
      closeTime: {
        type: String,
        default: "22:00"
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  csRPercent: {
    type: Number,
    // enum: [0, 5, 10],
    default: 0
  },
  csCPercent: {
    type: Number,
    // enum: [0, 5, 10],
    default: 0
  },
  // FINANCIAL TRACKING: Daily balance for providers
  dailyBalance: [
    {
      date: {
        type: Date,
        required: true
      },
      // Orders delivered on this date for this provider
      orders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
      }],
      // Total payout from restaurantPayout of orders delivered
      totalPayout: {
        type: Number,
        default: 0
      },
      // Payment confirmation details
      paymentMode: {
        type: String,
        enum: ['especes', 'facture'],
        default: 'especes'
      },
      // Whether this day's earnings have been paid
      paid: {
        type: Boolean,
        default: false
      },
      paidAt: {
        type: Date,
        default: null
      }
    }
  ]
}, {
  timestamps: true
});

// Index for better performance
providerSchema.index({ name: 1 });
providerSchema.index({ type: 1 });
providerSchema.index({ status: 1 });
providerSchema.index({ location: '2dsphere' }); 


const Provider = mongoose.model('Provider', providerSchema);
module.exports = Provider;