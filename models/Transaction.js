const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Optional for system transactions like wallet_credit
  },
  type: {
    type: String,
    enum: ['transfert', 'paiement', 'clictopay', 'wallet_credit'],
    required: true,
  },
  paymentGateway: {
    type: String,
    enum: ['flouci', 'clictopay'],
    default: 'flouci',
    required: false, // Optional for backward compatibility and non-payment transactions
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
    enum: ['completed', 'success', 'pending', 'failed'],
    default: 'pending',
  },
  details: {
    type: Object,
    // Common fields for all payment gateways:
    // - orderId: {String|ObjectId} Reference to the order
    // - orderDetails: {Object} Complete order details (items, delivery fee, etc.)
    // - amountInMillimes: {Number} Amount in millimes (smallest unit)
    // - paymentMethodType: {String} Type of payment method ('card' or 'wallet')
    // - cardDetails: {Object} Masked card details (last4, brand, cardholderName, expiryDate) - NEVER full number or CVV
    // - paymentUrl: {String} URL for customer to complete payment
    //
    // Flouci-specific fields (when paymentGateway = 'flouci'):
    // - flouciPaymentId: {String} ID of payment from Flouci API
    //
    // ClickToPay-specific fields (when paymentGateway = 'clictopay'):
    // - clickToPayOrderId: {String} ID of payment returned by ClickToPay API register.do
    // - clickToPayFormUrl: {String} URL of the payment form (formUrl from ClickToPay API register.do)
    // - verificationData: {Object} Complete response from getOrderStatusExtended.do including orderStatus
    // - orderStatus: {Number} ClickToPay order status code (2 = authorized with success, persisted from verification)
    //
    // Wallet credit transaction fields (when type = 'wallet_credit'):
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

// Index for efficient queries by payment gateway
transactionSchema.index({ paymentGateway: 1, status: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;