const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['order_update', 'promotion', 'system', 'new_shop', 'order_delivered', 'promo', 'general'],
      default: 'general'
    },
    read: {
      type: Boolean,
      default: false,
      index: true
    },
    readAt: {
      type: Date,
      default: null
    },
    data: {
      // Additional data related to notification
      orderId: mongoose.Schema.Types.ObjectId,
      orderNumber: String,
      promoId: mongoose.Schema.Types.ObjectId,
      shopId: mongoose.Schema.Types.ObjectId,
      deepLink: String // For navigation in app
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: true }
);

// Index for quick queries
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
