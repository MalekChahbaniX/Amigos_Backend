const {
  areProvidersClose,
  isClientInRange,
  MAX_PROVIDER_DISTANCE,
  MAX_CLIENT_DISTANCE
} = require('./orderGroupingService');
const { calculateDistance } = require('../utils/distanceCalculator');

/**
 * Helper: Check if two delivery addresses are within range
 * COMMENT 2: For A2/A3, we check delivery-to-delivery distance, not client-to-delivery
 */
function areDeliveryAddressesClose(deliveryAddress1, deliveryAddress2) {
  if (!deliveryAddress1 || !deliveryAddress2) return false;
  const dist = calculateDistance(
    deliveryAddress1.latitude,
    deliveryAddress1.longitude,
    deliveryAddress2.latitude,
    deliveryAddress2.longitude
  );
  // Use same threshold as MAX_CLIENT_DISTANCE for delivery-to-delivery
  return dist <= MAX_CLIENT_DISTANCE;
}

/**
 * Validate if a deliverer can accept a new order
 * Checks: activeOrdersCount < 3, deliverer has not accepted the order already
 * 
 * @param {Object} deliverer - The deliverer user document
 * @param {Object} newOrder - The new order document
 * @returns {Object} { canAccept: boolean, reason: string }
 */
function canAcceptOrder(deliverer, newOrder) {
  try {
    if (!deliverer || !newOrder) {
      return {
        canAccept: false,
        reason: 'Livreur ou commande invalide'
      };
    }

    // Check if deliverer has reached maximum active orders
    const activeOrdersCount = deliverer.activeOrdersCount || 0;
    if (activeOrdersCount >= 3) {
      return {
        canAccept: false,
        reason: 'Vous avez atteint le nombre maximum de commandes actives (3)'
      };
    }

    // Check if order is still pending
    if (newOrder.status !== 'pending') {
      return {
        canAccept: false,
        reason: 'Cette commande n\'est plus disponible'
      };
    }

    // Check if order is already assigned
    if (newOrder.deliveryDriver && newOrder.deliveryDriver.toString() !== deliverer._id.toString()) {
      return {
        canAccept: false,
        reason: 'Cette commande a déjà été assignée à un autre livreur'
      };
    }

    return {
      canAccept: true,
      reason: 'Commande acceptée'
    };
  } catch (error) {
    console.error('Error in canAcceptOrder:', error.message);
    return {
      canAccept: false,
      reason: 'Erreur lors de la validation'
    };
  }
}

/**
 * Validate A2 criteria for two orders
 * Checks distance requirements between providers and clients
 * 
 * @param {Object} order1 - First order document (must have client, provider, deliveryAddress populated)
 * @param {Object} order2 - Second order document (must have client, provider, deliveryAddress populated)
 * @returns {Object} { valid: boolean, reason: string }
 */
function validateA2Criteria(order1, order2) {
  try {
    if (!order1 || !order2) {
      return {
        valid: false,
        reason: 'Commandes invalides'
      };
    }

    // Validate provider locations exist
    if (!order1.provider?.location || !order2.provider?.location) {
      return {
        valid: false,
        reason: 'Données de localisation du fournisseur manquantes'
      };
    }

    // Validate client locations exist
    if (!order1.client?.location || !order2.client?.location) {
      return {
        valid: false,
        reason: 'Données de localisation du client manquantes'
      };
    }

    // Validate delivery addresses exist
    if (!order1.deliveryAddress || !order2.deliveryAddress) {
      return {
        valid: false,
        reason: 'Adresses de livraison manquantes'
      };
    }

    // Check provider distance using shared helper
    if (!areProvidersClose(order1.provider.location, order2.provider.location)) {
      return {
        valid: false,
        reason: `Les fournisseurs sont trop éloignés (> ${MAX_PROVIDER_DISTANCE}km)`
      };
    }

    // COMMENT 2: Check delivery address to delivery address distance (not client to delivery)
    // This ensures the two delivery points are close enough to be efficient in one trip
    if (!areDeliveryAddressesClose(order1.deliveryAddress, order2.deliveryAddress)) {
      return {
        valid: false,
        reason: `Les adresses de livraison sont trop éloignées (> ${MAX_CLIENT_DISTANCE}km)`
      };
    }

    return {
      valid: true,
      reason: 'Critères A2 validés'
    };
  } catch (error) {
    console.error('Error in validateA2Criteria:', error.message);
    return {
      valid: false,
      reason: 'Erreur lors de la validation des critères A2'
    };
  }
}

/**
 * Validate A3 criteria for three orders
 * Checks distance requirements between all provider pairs and all clients
 * 
 * @param {Object} order1 - First order document (must have client, provider, deliveryAddress populated)
 * @param {Object} order2 - Second order document (must have client, provider, deliveryAddress populated)
 * @param {Object} order3 - Third order document (must have client, provider, deliveryAddress populated)
 * @returns {Object} { valid: boolean, reason: string }
 */
function validateA3Criteria(order1, order2, order3) {
  try {
    if (!order1 || !order2 || !order3) {
      return {
        valid: false,
        reason: 'Commandes invalides'
      };
    }

    // Validate all provider locations exist
    if (!order1.provider?.location || !order2.provider?.location || !order3.provider?.location) {
      return {
        valid: false,
        reason: 'Données de localisation du fournisseur manquantes'
      };
    }

    // Validate all client locations exist
    if (!order1.client?.location || !order2.client?.location || !order3.client?.location) {
      return {
        valid: false,
        reason: 'Données de localisation du client manquantes'
      };
    }

    // Validate all delivery addresses exist
    if (!order1.deliveryAddress || !order2.deliveryAddress || !order3.deliveryAddress) {
      return {
        valid: false,
        reason: 'Adresses de livraison manquantes'
      };
    }

    // Check all provider pair distances using shared helper
    if (!areProvidersClose(order1.provider.location, order2.provider.location)) {
      return {
        valid: false,
        reason: `Fournisseur 1-2 trop éloignés (> ${MAX_PROVIDER_DISTANCE}km)`
      };
    }

    if (!areProvidersClose(order1.provider.location, order3.provider.location)) {
      return {
        valid: false,
        reason: `Fournisseur 1-3 trop éloignés (> ${MAX_PROVIDER_DISTANCE}km)`
      };
    }

    if (!areProvidersClose(order2.provider.location, order3.provider.location)) {
      return {
        valid: false,
        reason: `Fournisseur 2-3 trop éloignés (> ${MAX_PROVIDER_DISTANCE}km)`
      };
    }

    // COMMENT 2: Check delivery address to delivery address distances (not client to delivery)
    // Ensure all delivery points are mutually close
    if (!areDeliveryAddressesClose(order1.deliveryAddress, order2.deliveryAddress)) {
      return {
        valid: false,
        reason: `Adresses de livraison 1-2 trop éloignées (> ${MAX_CLIENT_DISTANCE}km)`
      };
    }

    if (!areDeliveryAddressesClose(order1.deliveryAddress, order3.deliveryAddress)) {
      return {
        valid: false,
        reason: `Adresses de livraison 1-3 trop éloignées (> ${MAX_CLIENT_DISTANCE}km)`
      };
    }

    if (!areDeliveryAddressesClose(order2.deliveryAddress, order3.deliveryAddress)) {
      return {
        valid: false,
        reason: `Adresses de livraison 2-3 trop éloignées (> ${MAX_CLIENT_DISTANCE}km)`
      };
    }

    return {
      valid: true,
      reason: 'Critères A3 validés'
    };
  } catch (error) {
    console.error('Error in validateA3Criteria:', error.message);
    return {
      valid: false,
      reason: 'Erreur lors de la validation des critères A3'
    };
  }
}

/**
 * Determine order type based on active orders count
 * @param {number} activeOrdersCount - Number of currently active orders
 * @returns {String} The order type (A1, A2, A3, or null)
 */
function determineOrderTypeByCount(activeOrdersCount) {
  switch (activeOrdersCount) {
    case 0:
      return 'A1'; // Single order
    case 1:
      return 'A2'; // Dual order
    case 2:
      return 'A3'; // Triple order
    default:
      return null; // Should not happen if activeOrdersCount < 3
  }
}

module.exports = {
  canAcceptOrder,
  validateA2Criteria,
  validateA3Criteria,
  determineOrderTypeByCount
};
