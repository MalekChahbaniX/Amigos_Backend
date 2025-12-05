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
  verifyDelivererOTP
} = require('../controllers/authController');

// Route de test de connexion (doit être en premier)
router.get('/test', testConnection);

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

module.exports = router;