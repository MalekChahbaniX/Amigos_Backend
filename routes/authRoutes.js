const express = require('express');
const router = express.Router();
const { registerUser, loginUser, verifyOTP, logoutUser, registerSuperAdmin, loginSuperAdmin } = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/verify', verifyOTP);
router.post('/logout', logoutUser);
router.post('/login-super-admin', loginSuperAdmin);
router.post('/register-super-admin', registerSuperAdmin);

module.exports = router;