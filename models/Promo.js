const mongoose = require('mongoose');

const promoSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'closed'],
    default: 'active',
  },
  targetServices: [
    {
      type: String,
      enum: ['restaurant', 'pharmacy', 'course'],
      required: true,
    },
  ],
  maxOrders: {
    type: Number,
    default: 50,
  },
  ordersUsed: {
    type: Number,
    default: 0,
  },
  maxAmount: {
    type: Number,
    default: 10,
  },
  deliveryOnly: {
    type: Boolean,
    default: true,
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

promoSchema.virtual('isActive').get(function () {
  const now = new Date();
  return (
    this.status === 'active' &&
    (!this.endDate || this.endDate > now) &&
    this.ordersUsed < this.maxOrders
  );
});

const Promo = mongoose.model('Promo', promoSchema);
module.exports = Promo;
