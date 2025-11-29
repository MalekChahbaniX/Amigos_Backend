const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['restaurant', 'pharmacy', 'course'],
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    lowercase: true,
  },
  description: {
    type: String,
  },
  location: {
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
    address: String
  },
  image: {
    type: String,
  },
  timeEstimate: {
    type: String,
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  csRPercent: {
    type: Number,
    enum: [0, 5, 10],
    default: 5
  },
  csCPercent: {
    type: Number,
    enum: [0, 5, 10],
    default: 0
  }
}, {
  timestamps: true
});

// Index for better performance
providerSchema.index({ name: 1 });
providerSchema.index({ type: 1 });
providerSchema.index({ status: 1 });

const Provider = mongoose.model('Provider', providerSchema);
module.exports = Provider;