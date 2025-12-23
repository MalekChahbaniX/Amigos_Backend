const mongoose = require('mongoose');

const cancellationSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
  },
  deliverer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    default: null,
  },
  type: {
    type: String,
    enum: ['ANNULER_1', 'ANNULER_2', 'ANNULER_3'],
    required: true,
  },
  solde: {
    type: Number,
    required: true,
  },
  mode: {
    type: String,
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index pour améliorer les performances
cancellationSchema.index({ order: 1 });
cancellationSchema.index({ deliverer: 1 });
cancellationSchema.index({ createdAt: 1 });

const Cancellation = mongoose.model('Cancellation', cancellationSchema);

module.exports = Cancellation;
