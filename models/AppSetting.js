const mongoose = require('mongoose');

const appSettingSchema = new mongoose.Schema({
  appFee: {
    type: Number,
    required: true,
  },
  // Bonus AMIGOS Montant Course (selon votre Excel: 8.10€)
  amigosBonusCourseAmount: {
    type: Number,
    default: 0.00,
    min: [0, 'Le bonus ne peut pas être négatif']
  },
  amigosBonusEnabled: {
    type: Boolean,
    default: true
  },
  currency: {
    type: String,
    default: 'TND',
  },
  updatedBy: {
    type: mongoose.Schema.Types.Mixed, // Accept both ObjectId and String
    ref: 'User',
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const AppSetting = mongoose.model('AppSetting', appSettingSchema);
module.exports = AppSetting;
