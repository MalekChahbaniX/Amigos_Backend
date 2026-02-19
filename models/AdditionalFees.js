const mongoose = require('mongoose');

const additionalFeesSchema = new mongoose.Schema({
  // Frais additionnels selon votre Excel
  FRAIS_1: {
    amount: {
      type: Number,
      default: 0.15,
      min: [0, 'Le montant ne peut pas être négatif']
    },
    description: {
      type: String,
      default: 'Frais de traitement C1'
    },
    appliesTo: {
      type: [String],
      default: ['C1'],
      enum: ['C1', 'C2', 'C3', 'A1', 'A2', 'A3', 'A4', 'ALL']
    }
  },
  FRAIS_2: {
    amount: {
      type: Number,
      default: 0.35,
      min: [0, 'Le montant ne peut pas être négatif']
    },
    description: {
      type: String,
      default: 'Frais de service'
    },
    appliesTo: {
      type: [String],
      default: ['ALL'],
      enum: ['C1', 'C2', 'C3', 'A1', 'A2', 'A3', 'A4', 'ALL']
    }
  },
  FRAIS_3: {
    amount: {
      type: Number,
      default: 0.35,
      min: [0, 'Le montant ne peut pas être négatif']
    },
    description: {
      type: String,
      default: 'Frais de plateforme'
    },
    appliesTo: {
      type: [String],
      default: ['ALL'],
      enum: ['C1', 'C2', 'C3', 'A1', 'A2', 'A3', 'A4', 'ALL']
    }
  },
  FRAIS_4: {
    amount: {
      type: Number,
      default: 0,
      min: [0, 'Le montant ne peut pas être négatif']
    },
    description: {
      type: String,
      default: 'Frais additionnels'
    },
    appliesTo: {
      type: [String],
      default: [],
      enum: ['C1', 'C2', 'C3', 'A1', 'A2', 'A3', 'A4', 'ALL']
    }
  },
  // NOUVEAU: FRAIS_5 selon votre Excel
  FRAIS_5: {
    amount: {
      type: Number,
      default: 0,
      min: [0, 'Le montant ne peut pas être négatif']
    },
    description: {
      type: String,
      default: 'Frais supplémentaires'
    },
    appliesTo: {
      type: [String],
      default: [],
      enum: ['C1', 'C2', 'C3', 'A1', 'A2', 'A3', 'A4', 'ALL']
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
additionalFeesSchema.index({ isActive: 1 });

// Méthode statique pour obtenir tous les frais actifs
additionalFeesSchema.statics.getActiveFees = async function() {
  const fees = await this.findOne({ isActive: true });
  if (!fees) {
    // Valeurs par défaut si aucun paramètre trouvé
    return {
      FRAIS_1: { amount: 0.00, appliesTo: ['C1'] },
      FRAIS_2: { amount: 0.00, appliesTo: ['ALL'] },
      FRAIS_3: { amount: 0.00, appliesTo: ['ALL'] },
      FRAIS_4: { amount: 0.00, appliesTo: [] },
      FRAIS_5: { amount: 0.00, appliesTo: [] }
    };
  }
  return fees;
};

// Méthode statique pour calculer les frais applicables à un type de commande
additionalFeesSchema.statics.calculateApplicableFees = async function(orderType) {
  const fees = await this.getActiveFees();
  let totalFees = 0;
  const applicableFees = [];

  // Parcourir tous les frais et vérifier s'ils s'appliquent
  ['FRAIS_1', 'FRAIS_2', 'FRAIS_3', 'FRAIS_4', 'FRAIS_5'].forEach(feeName => {
    const fee = fees[feeName];
    if (fee && fee.amount > 0) {
      const applies = fee.appliesTo.includes('ALL') || fee.appliesTo.includes(orderType);
      if (applies) {
        totalFees += fee.amount;
        applicableFees.push({
          name: feeName,
          amount: fee.amount,
          description: fee.description
        });
      }
    }
  });

  return {
    totalFees: Number(totalFees.toFixed(3)),
    applicableFees,
    orderType
  };
};

// Méthode statique pour obtenir le détail des frais
additionalFeesSchema.statics.getFeesBreakdown = async function(orderType) {
  const fees = await this.getActiveFees();
  const breakdown = {};

  ['FRAIS_1', 'FRAIS_2', 'FRAIS_3', 'FRAIS_4', 'FRAIS_5'].forEach(feeName => {
    const fee = fees[feeName];
    if (fee) {
      const applies = fee.appliesTo.includes('ALL') || fee.appliesTo.includes(orderType);
      breakdown[feeName] = {
        amount: fee.amount,
        applies: applies,
        description: fee.description
      };
    }
  });

  return breakdown;
};

// Middleware pour mettre à jour lastUpdated
additionalFeesSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

const AdditionalFees = mongoose.model('AdditionalFees', additionalFeesSchema);

module.exports = AdditionalFees;
