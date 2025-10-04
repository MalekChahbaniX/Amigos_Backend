const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
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
    enum: ['client', 'superAdmin'],
    default: 'client',
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