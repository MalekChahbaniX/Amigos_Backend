/**
 * Provider Order Timer Service
 * Gère le timer de 5 minutes pour l'acceptation des commandes par les prestataires
 */

const Order = require('../models/Order');

// Map pour stocker les timers actifs
const activeTimers = new Map();

/**
 * Démarrer le timer de 5 minutes pour une commande
 * @param {string} orderId - ID de la commande
 * @param {Date} orderCreatedAt - Date de création de la commande
 */
function startProviderTimer(orderId, orderCreatedAt = new Date()) {
  // Annuler le timer existant s'il y en a un
  if (activeTimers.has(orderId)) {
    clearTimeout(activeTimers.get(orderId));
  }

  // Calculer le délai (5 minutes = 300000ms)
  const timeoutDuration = 5 * 60 * 1000; // 5 minutes
  const timeoutAt = new Date(orderCreatedAt.getTime() + timeoutDuration);

  console.log(`⏰ [ProviderTimer] Démarrage timer 5min pour commande ${orderId} - Timeout à: ${timeoutAt.toLocaleTimeString('fr-FR')}`);

  // Programmer le timeout
  const timerId = setTimeout(async () => {
    try {
      await handleProviderTimeout(orderId);
    } catch (error) {
      console.error(`❌ [ProviderTimer] Erreur lors du timeout pour commande ${orderId}:`, error);
    } finally {
      // Nettoyer le timer
      activeTimers.delete(orderId);
    }
  }, timeoutDuration);

  // Stocker le timer
  activeTimers.set(orderId, timerId);

  // Mettre à jour la commande avec la date de timeout
  return Order.findByIdAndUpdate(orderId, {
    providerTimeoutAt: timeoutAt
  }).catch(error => {
    console.error(`❌ [ProviderTimer] Erreur mise à jour timeout pour commande ${orderId}:`, error);
  });
}

/**
 * Gérer le timeout du prestataire (5 minutes écoulées)
 * @param {string} orderId - ID de la commande
 */
async function handleProviderTimeout(orderId) {
  try {
    console.log(`⏰ [ProviderTimer] Timeout atteint pour commande ${orderId} - Notification des livreurs`);

    const order = await Order.findById(orderId);
    if (!order) {
      console.log(`⚠️ [ProviderTimer] Commande ${orderId} non trouvée`);
      return;
    }

    // Vérifier que la commande est toujours en attente
    if (order.status !== 'pending') {
      console.log(`ℹ️ [ProviderTimer] Commande ${orderId} déjà traitée (status: ${order.status})`);
      return;
    }

    // Notifier les livreurs que la commande est disponible
    if (global.notifyNewOrder) {
      await global.notifyNewOrder(order);
      console.log(`📢 [ProviderTimer] Notification envoyée aux livreurs pour commande ${orderId}`);
    } else {
      console.warn(`⚠️ [ProviderTimer] notifyNewOrder non disponible`);
    }

  } catch (error) {
    console.error(`❌ [ProviderTimer] Erreur gestion timeout pour commande ${orderId}:`, error);
  }
}

/**
 * Annuler le timer pour une commande (si le prestataire accepte/annule)
 * @param {string} orderId - ID de la commande
 */
function cancelProviderTimer(orderId) {
  if (activeTimers.has(orderId)) {
    clearTimeout(activeTimers.get(orderId));
    activeTimers.delete(orderId);
    console.log(`⏹️ [ProviderTimer] Timer annulé pour commande ${orderId}`);
    return true;
  }
  return false;
}

/**
 * Accepter une commande par le prestataire
 * @param {string} orderId - ID de la commande
 * @param {string} providerId - ID du prestataire
 */
async function acceptOrder(orderId, providerId) {
  try {
    // Annuler le timer
    cancelProviderTimer(orderId);

    const order = await Order.findOneAndUpdate(
      { 
        _id: orderId, 
        status: 'pending',
        $or: [
          { provider: providerId },
          { providers: providerId }
        ]
      },
      { 
        status: 'accepted',
        providerAcceptedAt: new Date()
      },
      { new: true }
    ).populate('client', 'firstName lastName phoneNumber location')
     .populate('providers', 'name type phone address');

    if (!order) {
      throw new Error('Commande non trouvée ou non autorisée');
    }

    console.log(`✅ [ProviderTimer] Commande ${orderId} acceptée par prestataire ${providerId}`);

    // Notifier les livreurs immédiatement car le prestataire a accepté
    if (global.notifyNewOrder) {
      await global.notifyNewOrder(order);
      console.log(`📢 [ProviderTimer] Notification envoyée aux livreurs pour commande acceptée ${orderId}`);
    }

    return order;
  } catch (error) {
    console.error(`❌ [ProviderTimer] Erreur acceptation commande ${orderId}:`, error);
    throw error;
  }
}

/**
 * Obtenir le statut actuel des timers
 */
function getTimerStatus() {
  return {
    activeTimers: activeTimers.size,
    activeOrderIds: Array.from(activeTimers.keys())
  };
}

/**
 * Nettoyer tous les timers (appel au shutdown du serveur)
 */
function clearAllTimers() {
  console.log(`🧹 [ProviderTimer] Nettoyage de ${activeTimers.size} timers actifs`);
  activeTimers.forEach((timerId, orderId) => {
    clearTimeout(timerId);
  });
  activeTimers.clear();
}

module.exports = {
  startProviderTimer,
  cancelProviderTimer,
  acceptOrder,
  handleProviderTimeout,
  getTimerStatus,
  clearAllTimers
};
