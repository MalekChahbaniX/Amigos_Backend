const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Optional for system transactions like wallet_credit
  },
  type: {
    type: String,
    enum: ['transfert', 'paiement', 'wallet_credit'],
    required: true,
  },
  paymentMethodType: {
    type: String,
    enum: ['card', 'wallet'],
    default: 'wallet',
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
    // - paymentMethodType: {String} Type of payment method ('card' or 'wallet')
    // - cardDetails: {Object} Masked card details (last4, brand, cardholderName, expiryDate) - NEVER full number or CVV
    // Documentation of fields for wallet_credit transactions:
    // - sourceTransactionId: {ObjectId} ID of the original card payment transaction
    // - sourcePaymentId: {String} ID of the Flouci payment
    // - creditReason: {String} Reason for credit (e.g., 'card_payment_success')
    // - creditedAt: {Date} Timestamp when credit was created
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;