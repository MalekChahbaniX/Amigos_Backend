const mongoose = require('mongoose');

const citySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Le nom de la ville est obligatoire'],
    unique: true,
    trim: true,
    maxlength: [100, 'Le nom de la ville ne peut pas dépasser 100 caractères']
  },
  activeZones: [{
    type: Number,
    min: [1, 'Le numéro de zone doit être positif'],
    validate: {
      validator: function(zone) {
        // Vérifier que la zone existe dans la collection Zone
        return mongoose.model('Zone').exists({ number: zone });
      },
      message: 'Cette zone n\'existe pas'
    }
  }],
  isActive: {
    type: Boolean,
    default: true
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
citySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Index pour améliorer les performances de recherche
citySchema.index({ name: 1 });
citySchema.index({ isActive: 1 });

const City = mongoose.model('City', citySchema);

module.exports = City;
