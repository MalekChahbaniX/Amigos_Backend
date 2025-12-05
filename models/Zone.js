const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema({
  number: {
    type: Number,
    required: [true, 'Le numéro de zone est obligatoire'],
    unique: true,
    min: [1, 'Le numéro de zone doit être positif']
  },
  minDistance: {
    type: Number,
    required: [true, 'La distance minimale est obligatoire'],
    min: [0, 'La distance minimale ne peut pas être négative'],
    validate: {
      validator: function(value) {
        return Number.isFinite(value) && value >= 0;
      },
      message: 'La distance minimale doit être un nombre valide'
    }
  },
  maxDistance: {
    type: Number,
    required: [true, 'La distance maximale est obligatoire'],
    validate: {
      validator: function(value) {
        return Number.isFinite(value);
      },
      message: 'La distance maximale doit être un nombre valide'
    }
  },
  price: {
    type: Number,
    required: [true, 'Le prix est obligatoire'],
    min: [0, 'Le prix ne peut pas être négatif']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware pour mettre à jour updatedAt avant la sauvegarde
zoneSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Zone = mongoose.model('Zone', zoneSchema);

module.exports = Zone;
