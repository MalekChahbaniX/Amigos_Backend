const mongoose = require('mongoose');

const optionGroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider', 
    required: false,
  },
  options: [
    {
      option: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductOption', 
      },
      name: {
        type: String,
      },
      price: {
        type: Number,
        default: 0,
      },
      image: {
        type: String,
      },
    },
  ],
  image: {
    type: String,
  },
}, {
  timestamps: true,
});

optionGroupSchema.index({ name: 1 });
optionGroupSchema.index({ storeId: 1 });

const OptionGroup = mongoose.model('OptionGroup', optionGroupSchema);
module.exports = OptionGroup;
