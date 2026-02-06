const express = require('express');
const router = express.Router();
const {
  testConnection,
  registerUser,
  loginUser,
  verifyOTP,
  verifySecurityCode,
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
  testOTPService,
  checkWinSMSServiceHealth,
  getWinSMSMetrics,
  getWinSMSServiceStatus,
  testWinSMSService,
  testWinSMSConnection,
  getSMSDashboard
} = require('../controllers/authController');
const OTPService = require('../services/otpService');
const { isSuperAdmin } = require('../middleware/auth');


router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/verify', verifyOTP);
router.post('/verify-security-code', verifySecurityCode);
router.post('/logout', logoutUser);
router.post('/login-super-admin', loginSuperAdmin);
router.post('/register-super-admin', registerSuperAdmin);

// Routes pour les livreurs
router.post('/register-deliverer', registerDeliverer);
/**
 * @route   POST /api/auth/login-deliverer
 * @desc    Deliverer login with security code validation
 * @access  Public
 * @body    {string} phoneNumber - Deliverer phone number
 * @body    {string} securityCode - 6-digit security code (required)
 * @returns {object} Deliverer info, session data, and JWT token
 */
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

// ============= WINSMS MONITORING ROUTES =============

// Test WinSMS Connection (no SMS sent, just connection check)
router.get('/test-winsms', isSuperAdmin, testWinSMSConnection);

// WinSMS Service Health Check
router.get('/winsms/health', isSuperAdmin, checkWinSMSServiceHealth);

// WinSMS Service Metrics
router.get('/winsms/metrics', isSuperAdmin, getWinSMSMetrics);

// WinSMS Service Status Dashboard
router.get('/winsms/status', isSuperAdmin, getWinSMSServiceStatus);

// Test WinSMS Service (sends test SMS)
router.post('/winsms/test', isSuperAdmin, testWinSMSService);

// ============= UNIFIED SMS DASHBOARD =============

// Combined SMS Services Dashboard (WinSMS + Twilio)
router.get('/sms/dashboard', isSuperAdmin, getSMSDashboard);

module.exports = router;

