const express = require('express');
const router = express.Router();
const {
  testConnection,
  registerUser,
  loginUser,
  verifyOTP,
  logoutUser,
  registerSuperAdmin,
  loginSuperAdmin,
  registerDeliverer,
  loginDeliverer,
  verifyDelivererOTP,
  registerAdmin,
  loginAdmin,
  registerProvider,
  loginProvider
} = require('../controllers/authController');
const OTPService = require('../services/otpService');


router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/verify', verifyOTP);
router.post('/logout', logoutUser);
router.post('/login-super-admin', loginSuperAdmin);
router.post('/register-super-admin', registerSuperAdmin);

// Routes pour les livreurs
router.post('/register-deliverer', registerDeliverer);
router.post('/login-deliverer', loginDeliverer);
router.post('/verify-deliverer', verifyDelivererOTP);

// Routes pour les admins
router.post('/register-admin', registerAdmin);
router.post('/login-admin', loginAdmin);

// Routes pour les prestataires
router.post('/register-provider', registerProvider);
router.post('/login-provider', loginProvider);

module.exports = router;

module.exports = router;