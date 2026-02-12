// services/roomTimerService.js
const Order = require('../models/Order');
const notificationService = require('./notificationService');

/**
 * Service pour gérer les timers ROOM 15 minutes
 * Gère l'auto-annulation des commandes ROOM après 15 minutes
 */

class RoomTimerService {
  constructor() {
    this.activeTimers = new Map(); // orderId -> timerId
    this.isRunning = false;
  }

  /**
   * Démarrer le service de monitoring ROOM
   */
  start() {
    if (this.isRunning) {
      console.log('🔥 ROOM Timer Service already running');
      return;
    }

    this.isRunning = true;
    console.log('🔥 Starting ROOM Timer Service...');
    
    // Vérifier toutes les 30 secondes
    this.checkInterval = setInterval(() => {
      this.checkRoomOrders();
    }, 30000);

    // Vérification immédiate au démarrage
    this.checkRoomOrders();
  }

  /**
   * Arrêter le service
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    // Nettoyer tous les timers actifs
    for (const [orderId, timerId] of this.activeTimers) {
      clearTimeout(timerId);
    }
    this.activeTimers.clear();
    
    console.log('🔥 ROOM Timer Service stopped');
  }

  /**
   * Vérifier les commandes ROOM expirées
   */
  async checkRoomOrders() {
    try {
      const now = new Date();
      
      // Trouver les commandes ROOM expirées qui ne sont pas encore annulées
      const expiredRoomOrders = await Order.find({
        isRoomOrder: true,
        roomEnd: { $lte: now },
        status: { $in: ['pending', 'accepted'] }, // Seulement les commandes actives
        cancellationType: null // Pas déjà annulées
      }).populate('client providers');

      console.log(`🔥 Checking ROOM orders: ${expiredRoomOrders.length} expired orders found`);

      for (const order of expiredRoomOrders) {
        await this.handleExpiredRoomOrder(order);
      }
    } catch (error) {
      console.error('❌ Error checking ROOM orders:', error);
    }
  }

  /**
   * Gérer une commande ROOM expirée
   */
  async handleExpiredRoomOrder(order) {
    try {
      console.log(`🔥 ROOM order expired: ${order._id} - Auto-cancelling as ANNULER_2`);

      // Mettre à jour la commande
      order.status = 'cancelled';
      order.cancellationType = 'ANNULER_2';
      order.cancellationReason = 'ROOM 15 minutes timeout - prestataire n\'a pas confirmé la préparation';
      order.cancelledAt = new Date();
      order.autoCancelledAt = new Date();
      order.autoCancel = true;

      await order.save();

      // Envoyer les notifications
      await this.sendRoomExpiredNotifications(order);

      console.log(`✅ ROOM order ${order._id} auto-cancelled successfully`);
    } catch (error) {
      console.error(`❌ Error handling expired ROOM order ${order._id}:`, error);
    }
  }

  /**
   * Envoyer les notifications pour commande ROOM expirée
   */
  async sendRoomExpiredNotifications(order) {
    try {
      // Notification au client
      if (global.sendPushNotification) {
        await global.sendPushNotification(
          order.client?._id,
          'Commande annulée',
          `Votre commande #${order._id.toString().slice(-6)} a été annulée car le prestataire n'a pas pu la préparer dans les 15 minutes requises.`,
          { type: 'ROOM_EXPIRED', orderId: order._id }
        );
      }

      // Notification aux prestataires
      for (const provider of order.providers || []) {
        if (global.sendProviderNotification) {
          await global.sendProviderNotification(
            provider._id,
            'Commande ROOM expirée',
            `La commande #${order._id.toString().slice(-6)} a été automatiquement annulée (délai 15min dépassé).`,
            { type: 'ROOM_EXPIRED', orderId: order._id }
          );
        }
      }

      // Notification admin
      if (global.notifyAdminsImmediate) {
        await global.notifyAdminsImmediate({
          ...order.toObject(),
          notificationType: 'ROOM_EXPIRED',
          message: `Commande ROOM #${order._id.toString().slice(-6)} auto-annulée après 15 minutes`
        });
      }

      console.log(`📢 ROOM expired notifications sent for order ${order._id}`);
    } catch (error) {
      console.error(`❌ Error sending ROOM expired notifications for order ${order._id}:`, error);
    }
  }

  /**
   * Programmer un timer spécifique pour une commande ROOM
   */
  scheduleRoomTimer(orderId, roomEndTime) {
    // Nettoyer le timer existant si présent
    if (this.activeTimers.has(orderId)) {
      clearTimeout(this.activeTimers.get(orderId));
    }

    const now = new Date();
    const delay = roomEndTime.getTime() - now.getTime();

    if (delay <= 0) {
      // La commande est déjà expirée
      this.handleExpiredRoomOrder({ _id: orderId });
      return;
    }

    // Programmer le timer
    const timerId = setTimeout(async () => {
      try {
        const order = await Order.findById(orderId).populate('client providers');
        if (order && order.isRoomOrder && order.status !== 'cancelled') {
          await this.handleExpiredRoomOrder(order);
        }
        this.activeTimers.delete(orderId);
      } catch (error) {
        console.error(`❌ Error in ROOM timer for order ${orderId}:`, error);
        this.activeTimers.delete(orderId);
      }
    }, delay);

    this.activeTimers.set(orderId, timerId);
    console.log(`⏰ ROOM timer scheduled for order ${orderId} - expires in ${Math.round(delay / 1000 / 60)} minutes`);
  }

  /**
   * Annuler un timer ROOM
   */
  cancelRoomTimer(orderId) {
    if (this.activeTimers.has(orderId)) {
      clearTimeout(this.activeTimers.get(orderId));
      this.activeTimers.delete(orderId);
      console.log(`⏰ ROOM timer cancelled for order ${orderId}`);
    }
  }

  /**
   * Obtenir le statut du service
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeTimers: this.activeTimers.size,
      timerIds: Array.from(this.activeTimers.keys())
    };
  }
}

// Créer une instance singleton
const roomTimerService = new RoomTimerService();

module.exports = roomTimerService;
