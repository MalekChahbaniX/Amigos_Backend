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
    enum: ['client', 'superAdmin','deliverer'],
    default: 'client',
  },
  email: {
    type: String,
    required: function() {
      return this.role === 'superAdmin';
    },
    unique: true,
    sparse: true, // Allow multiple null values but unique non-null values
    lowercase: true,
    validate: {
      validator: function(v) {
        if (this.role === 'superAdmin' && v) {
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
      return this.role === 'superAdmin';
    },
    minlength: [6, 'Le mot de passe doit contenir au moins 6 caractères']
  },
  location: {
    latitude: Number,
    longitude: Number,
    address: String
  },
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

const User = mongoose.model('User', userSchema);
module.exports = User;