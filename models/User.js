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
  avatar: {
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
  // Security code attempt tracking for rate limiting (deliverers only)
  failedSecurityCodeAttempts: {
    type: Number,
    default: 0
  },
  securityCodeLockedUntil: {
    type: Date,
    default: null
  },
  location: {
    latitude: Number,
    longitude: Number,
    address: String,
    city: String,
    postalCode: String,
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
  // Security code for deliverers (6-digit) and clients (4-digit)
  securityCode: {
    type: String,
    required: function() {
      return this.role === 'deliverer';
    },
    validate: [
      {
        validator: function(v) {
          if (!v) return true; // Optional for clients
          
          // Check if value matches either 4-digit (client) or 6-digit (deliverer) format
          const is4Digits = /^\d{4}$/.test(v);
          const is6Digits = /^\d{6}$/.test(v);
          
          return is4Digits || is6Digits;
        },
        message: 'Le code de sécurité doit être 4 chiffres (client) ou 6 chiffres (livreur)'
      }
    ],
    unique: true,
    sparse: true
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
    enum: ['active', 'inactive', 'pending', 'occupé'],
    default: 'pending',
  },
  activeOrdersCount: {
    type: Number,
    default: 0,
  },
  // Account blocking (for clients)
  isBlocked: {
    type: Boolean,
    default: false,
  },
  blockedReason: {
    type: String,
    default: null,
  },
  blockedAt: {
    type: Date,
    default: null,
  },
  // Terms acceptance tracking (for clients only)
  termsAccepted: {
    type: Boolean,
    default: false,
    required: function() {
      return this.role === 'client';
    }
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

// Middleware pour auto-générer securityCode pour les livreurs existants sans code de sécurité
userSchema.pre('save', async function(next) {
  try {
    // Only auto-generate for deliverers
    if (this.role === 'deliverer' && !this.securityCode) {
      // Generate a simple 6-digit code
      const { generateSecurityCode } = require('../utils/securityCodeGenerator');
      
      let securityCode = generateSecurityCode();
      let attempts = 0;
      const maxAttempts = 5;
      
      // Check for uniqueness
      while (attempts < maxAttempts) {
        const existingCode = await User.findOne({
          securityCode: securityCode,
          role: 'deliverer',
          _id: { $ne: this._id } // Exclude current document
        });
        
        if (!existingCode) {
          this.securityCode = securityCode;
          console.log(`🔐 [User.pre-save] Auto-generated security code for deliverer ${this._id}: ${securityCode}`);
          break;
        }
        
        securityCode = generateSecurityCode();
        attempts++;
      }
      
      if (attempts === maxAttempts && !this.securityCode) {
        throw new Error('Impossible de générer un code de sécurité unique pour le livreur');
      }
    }
    
    if (this.isModified('location')) {
      console.log('💾 [User.pre-save] Sauvegarde de location pour user:', this._id);
      console.log('💾 [User.pre-save] Nouvelles coordonnées:', {
        latitude: this.location?.latitude,
        longitude: this.location?.longitude,
        address: this.location?.address,
        city: this.location?.city,
        postalCode: this.location?.postalCode
      });
    }
    next();
  } catch (error) {
    console.error('Erreur dans User.pre-save:', error.message);
    next(error);
  }
});

// Middleware pour logger les modifications avant findOneAndUpdate
userSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (update.$set && (update.$set['location.latitude'] || update.$set['location.longitude'])) {
    console.log('💾 [User.pre-findOneAndUpdate] Mise à jour de location');
    console.log('💾 [User.pre-findOneAndUpdate] Nouvelles coordonnées:', {
      latitude: update.$set['location.latitude'],
      longitude: update.$set['location.longitude'],
      address: update.$set['location.address'],
      city: update.$set['location.city'],
      postalCode: update.$set['location.postalCode']
    });
  }
  next();
});

// Index pour améliorer les performances
userSchema.index({ phoneNumber: 1 });
userSchema.index({ isVerified: 1 });
userSchema.index({ 'location.zone': 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;
