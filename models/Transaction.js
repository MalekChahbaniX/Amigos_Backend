const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['transfert', 'paiement'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['completed', 'pending', 'failed'],
    default: 'pending',
  },
  details: {
    type: Object,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;