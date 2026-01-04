const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  getNotificationsByType
} = require('../controllers/notificationController');

// All notification routes require authentication
router.use(protect);

// Get all notifications for current user (with pagination)
router.get('/', getNotifications);

// Get unread notifications count
router.get('/unread/count', getUnreadCount);

// Get notifications by type
router.get('/type/:type', getNotificationsByType);

// Mark specific notification as read
router.put('/:id/read', markAsRead);

// Mark all notifications as read
router.put('/mark-all-read', markAllAsRead);

// Delete notification
router.delete('/:id', deleteNotification);

// Create notification (for admin/system)
router.post('/', createNotification);

module.exports = router;
