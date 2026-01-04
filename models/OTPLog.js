const mongoose = require('mongoose');

const OTPLogSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
      index: true
    },
    otp: {
      type: String,
      required: true
    },
    channel: {
      type: String,
      enum: ['sms', 'whatsapp', 'both'],
      required: true
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'partial'],
      required: true,
      index: true
    },
    attempts: {
      type: Number,
      default: 1
    },
    responseTime: {
      type: Number, // milliseconds
      default: 0
    },
    twilioResponses: [
      {
        channel: String,
        sid: String,
        status: String,
        errorCode: String,
        errorMessage: String
      }
    ],
    errorDetails: {
      type: {
        type: String, // authentication, network, invalid_number, rate_limit, insufficient_funds, unknown
        default: null
      },
      message: String,
      code: String
    },
    credentialsValid: {
      type: Boolean,
      default: false
    },
    clientReinitialized: {
      type: Boolean,
      default: false
    },
    metadata: {
      userAgent: String,
      ipAddress: String,
      environment: String,
      isTest: {
        type: Boolean,
        default: false
      }
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: false }
);

// Compound indexes for efficient queries
OTPLogSchema.index({ status: 1, createdAt: -1 });
OTPLogSchema.index({ phoneNumber: 1, createdAt: -1 });

// TTL index for automatic cleanup after 90 days
OTPLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 7776000 } // 90 days
);

module.exports = mongoose.model('OTPLog', OTPLogSchema);
