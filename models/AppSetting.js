const mongoose = require('mongoose');

const appSettingSchema = new mongoose.Schema({
  appFee: {
    type: Number,
    required: true,
    default: 1.5, // frais par défaut
  },
  currency: {
    type: String,
    default: 'TND',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const AppSetting = mongoose.model('AppSetting', appSettingSchema);
module.exports = AppSetting;
