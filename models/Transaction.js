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
    // Documentation of fields for Flouci payment gateway:
    // - flouciPaymentId: {String} ID of payment from Flouci API
    // - paymentUrl: {String} URL for customer to complete payment
    // - orderId: {String|ObjectId} Reference to the order
    // - orderDetails: {Object} Complete order details (items, delivery fee, etc.)
    // - amountInMillimes: {Number} Amount in millimes (smallest unit)
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;