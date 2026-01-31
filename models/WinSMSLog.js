const mongoose = require('mongoose');

const winSMSLogSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    otp: {
      type: String,
      required: true
    },
    channel: {
      type: String,
      enum: ['sms'],
      default: 'sms'
    },
    status: {
      type: String,
      enum: ['success', 'failed'],
      required: true,
      index: true
    },
    attempts: {
      type: Number,
      default: 1
    },
    responseTime: {
      type: Number,
      default: 0
    },
    winSmsResponse: {
      statusCode: Number,
      data: mongoose.Schema.Types.Mixed,
      messageId: String
    },
    errorDetails: {
      type: {
        type: String,
        enum: ['authentication', 'network', 'invalid_number', 'rate_limit', 'insufficient_funds', 'unknown']
      },
      message: String,
      code: String
    },
    credentialsValid: {
      type: Boolean,
      default: false
    },
    metadata: {
      environment: String,
      apiUrl: String
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
      expires: 7776000
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for common queries
winSMSLogSchema.index({ status: 1, createdAt: -1 });
winSMSLogSchema.index({ phoneNumber: 1, createdAt: -1 });

module.exports = mongoose.model('WinSMSLog', winSMSLogSchema);
