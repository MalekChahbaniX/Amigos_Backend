// models/OTP.js
const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true
    },
    code: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 300 // Le document s'auto-supprime après 5 minutes
    }
});

module.exports = mongoose.model('OTP', otpSchema);