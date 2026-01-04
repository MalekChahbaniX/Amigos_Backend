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
  getAdmins,
  updateAdmin,
  registerProvider,
  loginProvider,
  checkOTPServiceHealth,
  getOTPMetrics,
  getOTPServiceStatus,
  testOTPService
} = require('../controllers/authController');
const OTPService = require('../services/otpService');
const { isSuperAdmin } = require('../middleware/auth');


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
router.get('/admins', isSuperAdmin, getAdmins);
router.put('/admins/:id', isSuperAdmin, updateAdmin);

// Routes pour les prestataires
router.post('/register-provider', registerProvider);
router.post('/login-provider', loginProvider);

// ============= OTP MONITORING ROUTES =============

// OTP Service Health Check
router.get('/otp/health', isSuperAdmin, checkOTPServiceHealth);

// OTP Service Metrics
router.get('/otp/metrics', isSuperAdmin, getOTPMetrics);

// OTP Service Status Dashboard
router.get('/otp/status', isSuperAdmin, getOTPServiceStatus);

// Test OTP Service
router.post('/otp/test', isSuperAdmin, testOTPService);

module.exports = router;

