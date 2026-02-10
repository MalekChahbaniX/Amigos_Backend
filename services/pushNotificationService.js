const axios = require('axios');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

// Firebase Cloud Messaging configuration
const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY;
const FCM_API_URL = 'https://fcm.googleapis.com/fcm/send';

// Expo Push Notifications configuration
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send push notification via Firebase Cloud Messaging
 */
async function sendFCMPushNotification(token, title, body, data = {}) {
  if (!FCM_SERVER_KEY) {
    console.warn('⚠️ FCM_SERVER_KEY not configured');
    return { success: false, error: 'FCM not configured' };
  }

  const payload = {
    to: token,
    notification: {
      title,
      body,
      sound: 'default',
      priority: 'high'
    },
    data: {
      ...data,
      click_action: 'FLUTTER_NOTIFICATION_CLICK'
    }
  };

  try {
    const response = await axios.post(FCM_API_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${FCM_SERVER_KEY}`
      }
    });

    console.log('✅ FCM notification sent:', response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('❌ FCM notification failed:', error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
}

/**
 * Send push notification via Expo Push Notifications
 */
async function sendExpoPushNotification(token, title, body, data = {}) {
  const message = {
    to: token,
    sound: 'default',
    title,
    body,
    data
  };

  try {
    const response = await axios.post(EXPO_PUSH_URL, message, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Expo notification sent:', response.data);
    
    // Vérifier si le token est invalide et le nettoyer
    if (response.data.data && response.data.data.status === 'error') {
      const error = response.data.data.details?.error;
      if (error === 'DeviceNotRegistered') {
        console.warn(`🗑️ Token Expo invalide, nettoyage: ${token}`);
        await cleanupInvalidToken(token);
      }
    }
    
    return { success: true, data: response.data };
  } catch (error) {
    console.error('❌ Expo notification failed:', error.response?.data || error.message);
    
    // Nettoyer les tokens invalides en cas d'erreur
    if (error.response?.data?.data?.details?.error === 'DeviceNotRegistered') {
      await cleanupInvalidToken(token);
    }
    
    return { success: false, error: error.response?.data || error.message };
  }
}

/**
 * Nettoyer un token invalide de la base de données
 */
async function cleanupInvalidToken(invalidToken) {
  try {
    const result = await User.updateOne(
      { pushToken: invalidToken },
      { $unset: { pushToken: '' } }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`🧹 Token invalide nettoyé: ${invalidToken}`);
    }
  } catch (cleanupError) {
    console.error('❌ Erreur lors du nettoyage du token:', cleanupError);
  }
}

/**
 * Send push notification (tries FCM first, falls back to Expo)
 */
async function sendPushNotification(token, title, body, data = {}) {
  // Try FCM first
  if (FCM_SERVER_KEY) {
    const fcmResult = await sendFCMPushNotification(token, title, body, data);
    if (fcmResult.success) {
      return fcmResult;
    }
  }

  // Fall back to Expo
  return await sendExpoPushNotification(token, title, body, data);
}

/**
 * Send new order notification to deliverer
 */
async function sendNewOrderNotification(tokens, order) {
  const title = 'Nouvelle Commande Disponible';
  const body = `Commande ${order.orderNumber} - ${order.total} TND`;
  
  const data = {
    type: 'new_order',
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    total: order.total.toString(),
    clientName: order.client?.name || '',
    providerName: order.provider?.name || ''
  };

  // Handle single token or array of tokens
  const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
  
  const results = [];
  for (const token of tokenArray) {
    const result = await sendPushNotification(token, title, body, data);
    results.push({
      token,
      ...result
    });
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`📢 New order push notifications: ${successCount}/${results.length} sent successfully`);
  
  return {
    success: successCount > 0,
    results,
    summary: {
      total: results.length,
      success: successCount,
      failed: results.length - successCount
    }
  };
}

/**
 * Send order assignment notification
 */
async function sendOrderAssignmentNotification(delivererToken, order) {
  const title = 'Commande Assignée';
  const body = `Vous avez été assigné à la commande ${order.orderNumber}`;
  
  const data = {
    type: 'order_assigned',
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    status: 'accepted'
  };

  return await sendPushNotification(delivererToken, title, body, data);
}

/**
 * Send order status update notification
 */
async function sendOrderStatusNotification(delivererToken, order, status) {
  const statusMessages = {
    'in_delivery': 'Commande en cours de livraison',
    'delivered': 'Commande livrée avec succès',
    'cancelled': 'Commande annulée'
  };

  const title = 'Mise à jour de Commande';
  const body = statusMessages[status] || `Statut: ${status}`;
  
  const data = {
    type: 'order_status',
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    status
  };

  return await sendPushNotification(delivererToken, title, body, data);
}

/**
 * Send order rejection notification (order available again)
 */
async function sendOrderRejectionNotification(delivererToken, order) {
  const title = 'Commande Disponible';
  const body = `La commande ${order.orderNumber} est à nouveau disponible`;
  
  const data = {
    type: 'order_available',
    orderId: order.orderId,
    orderNumber: order.orderNumber
  };

  return await sendPushNotification(delivererToken, title, body, data);
}

/**
 * Batch send notifications to multiple deliverers
 */
async function sendBatchNotifications(tokens, title, body, data = {}) {
  const results = [];
  
  for (const token of tokens) {
    const result = await sendPushNotification(token, title, body, data);
    results.push({
      token,
      ...result
    });
  }

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;

  console.log(`📊 Batch notification summary: ${successCount} sent, ${failureCount} failed`);
  
  return {
    success: true,
    results,
    summary: {
      total: results.length,
      success: successCount,
      failed: failureCount
    }
  };
}

module.exports = {
  sendFCMPushNotification,
  sendExpoPushNotification,
  sendPushNotification,
  sendNewOrderNotification,
  sendOrderAssignmentNotification,
  sendOrderStatusNotification,
  sendOrderRejectionNotification,
  sendBatchNotifications
};