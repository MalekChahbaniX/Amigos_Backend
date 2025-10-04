const express = require('express');
const router = express.Router();
const { registerUser, loginUser, verifyOTP, logoutUser } = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/verify', verifyOTP);
router.post('/logout', logoutUser);

module.exports = router;