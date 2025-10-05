const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  changePassword,
  getAppSettings,
  updateAppSettings,
  getNotificationSettings,
  updateNotificationSettings,
  getSecuritySettings,
  updateSecuritySettings,
} = require('../controllers/settingsController');

// All settings routes require authentication
// You can add middleware here to verify JWT token and super admin role

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/password', changePassword);

router.get('/app', getAppSettings);
router.put('/app', updateAppSettings);

router.get('/notifications', getNotificationSettings);
router.put('/notifications', updateNotificationSettings);

router.get('/security', getSecuritySettings);
router.put('/security', updateSecuritySettings);

module.exports = router;