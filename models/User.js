const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: function() {
      return this.role === 'client';
    },
    unique: true,
    sparse: true,
    validate: {
      validator: function(v) {
        return /^\+216\d{8}$/.test(v);
      },
      message: 'Numéro de téléphone invalide. Format requis: +216XXXXXXXX'
    }
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  firstName: {
    type: String,
    default: '',
  },
  lastName: {
    type: String,
    default: '',
  },
  role: {
    type: String,
    enum: ['client', 'superAdmin', 'deliverer', 'admin', 'provider'],
    default: 'client',
  },
  // For providers: reference to the associated Provider document
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    required: function() {
      return this.role === 'provider';
    },
    unique: true,
    sparse: true
  },
  email: {
    type: String,
    required: function() {
      return this.role === 'superAdmin' || this.role === 'admin';
    },
    unique: true,
    sparse: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        if ((this.role === 'superAdmin' || this.role === 'admin') && v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        }
        return true;
      },
      message: 'Format d\'email invalide'
    }
  },
  password: {
    type: String,
    required: function() {
      return this.role === 'superAdmin' || this.role === 'admin';
    },
    minlength: [6, 'Le mot de passe doit contenir au moins 6 caractères']
  },
  // For admins: associate the admin with a single city they manage
  city: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'City',
    required: function() {
      return this.role === 'admin';
    }
  },
  location: {
    latitude: Number,
    longitude: Number,
    address: String,
    zone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Zone'
    },
    zoneName: String,
    deliveryPrice: Number,
    distance: Number
  },
  // Push notification token for deliverers
  pushToken: {
    type: String,
    default: ''
  },
  // Current active session for deliverers (reference to Session document)
  currentSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    default: null
  },
  // Session info for deliverers: date for which the session applies and whether it's active
  sessionDate: {
    type: Date,
    default: null,
    // Only meaningful for deliverers; validation left to application logic
  },
  sessionActive: {
    type: Boolean,
    default: false
  },
  // Daily balance records for deliverers
  // Each entry: { date, orders: [orderId], soldeAmigos, soldeAnnulation, paid }
  dailyBalance: [
    {
      date: { type: Date, required: true },
      orders: [ { type: mongoose.Schema.Types.ObjectId, ref: 'Order' } ],
      soldeAmigos: { type: Number, default: 0 },
      // Cancellation solde: amount deducted from cancellations
      soldeAnnulation: { type: Number, default: 0 },
      paid: { type: Boolean, default: false },
      paidAt: { type: Date, default: null }
    }
  ],
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: 'pending',
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

// Index pour améliorer les performances
userSchema.index({ phoneNumber: 1 });
userSchema.index({ isVerified: 1 });
userSchema.index({ 'location.zone': 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;
