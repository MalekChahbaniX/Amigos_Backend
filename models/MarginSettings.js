const mongoose = require('mongoose');

const marginSettingsSchema = new mongoose.Schema({
  // Marges par type de commande (selon votre Excel)
  C1: {
    marge: {
      type: Number,
      min: [0, 'La marge ne peut pas être négative']
    },
    minimum: {
      type: Number,
      min: [0, 'Le minimum ne peut pas être négatif']
    },
    maximum: {
      type: Number,
      min: [0, 'Le maximum ne peut pas être négatif']
    },
    description: {
      type: String,
      default: '1 point livraison'
    }
  },
  C2: {
    marge: {
      type: Number,
      min: [0, 'La marge ne peut pas être négative']
    },
    minimum: {
      type: Number,
      min: [0, 'Le minimum ne peut pas être négatif']
    },
    maximum: {
      type: Number,
      min: [0, 'Le maximum ne peut pas être négatif']
    },
    description: {
      type: String,
      default: '2 points livraison'
    }
  },
  C3: {
    marge: {
      type: Number,
      min: [0, 'La marge ne peut pas être négative']
    },
    minimum: {
      type: Number,
      min: [0, 'Le minimum ne peut pas être négatif']
    },
    maximum: {
      type: Number,
      min: [0, 'Le maximum ne peut pas être négatif']
    },
    description: {
      type: String,
      default: '3 points livraison'
    }
  },
  // Paramètres globaux
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index pour optimiser les requêtes
marginSettingsSchema.index({ isActive: 1 });

// Validation personnalisée
marginSettingsSchema.pre('save', function(next) {
  // Vérifier que minimum <= maximum pour chaque type
  ['C1', 'C2', 'C3'].forEach(type => {
    if (this[type] && this[type].minimum > this[type].maximum) {
      return next(new Error(`Pour ${type}, le minimum ne peut pas être supérieur au maximum`));
    }
  });
  
  this.lastUpdated = new Date();
  next();
});

// Méthode statique pour obtenir les marges par type de commande
marginSettingsSchema.statics.getMarginByType = async function(orderType) {
  const settings = await this.findOne({ isActive: true });
  if (!settings) {
    // Valeurs par défaut si aucun paramètre trouvé
    const defaults = {
      C1: { marge: 0.00, minimum: 0.00, maximum: 0.00 },
      C2: { marge: 0.00, minimum: 0.00, maximum: 0.00 },
      C3: { marge: 0.00, minimum: 0.00, maximum: 0.00 }
    };
    return defaults[orderType] || { marge: 0, minimum: 0, maximum: 0 };
  }
  
  return settings[orderType] || { marge: 0, minimum: 0, maximum: 0 };
};

// Méthode statique pour calculer la marge applicable
marginSettingsSchema.statics.calculateMargin = async function(orderType, baseAmount) {
  const marginConfig = await this.getMarginByType(orderType);
  
  // Calculer la marge en fonction des limites
  let calculatedMargin = marginConfig.marge;
  
  // Si baseAmount est fourni, appliquer les limites min/max
  if (typeof baseAmount === 'number') {
    const marginWithLimits = Math.min(
      Math.max(calculatedMargin, marginConfig.minimum),
      marginConfig.maximum
    );
    
    // Si le maximum est 0 (comme pour C3), retourner juste la marge de base
    if (marginConfig.maximum === 0) {
      return calculatedMargin;
    }
    
    return marginWithLimits;
  }
  
  return calculatedMargin;
};

const MarginSettings = mongoose.model('MarginSettings', marginSettingsSchema);

module.exports = MarginSettings;
