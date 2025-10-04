const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['restaurant', 'pharmacy', 'grocery'],
    required: true,
  },
  location: {
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
  },
  image: {
    type: String,
  },
  timeEstimate: {
    type: String,
  },
  // Le menu sera lié via le champ 'provider' dans le modèle Product
});

const Provider = mongoose.model('Provider', providerSchema);
module.exports = Provider;