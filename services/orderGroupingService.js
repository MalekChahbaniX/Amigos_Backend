const Order = require('../models/Order');
const User = require('../models/User');
const { calculateDistance } = require('../utils/distanceCalculator');
const { sendPushNotification } = require('./pushNotificationService');
const balanceCalc = require('./balanceCalculator');

// Distance thresholds (in km)
const MAX_PROVIDER_DISTANCE = 6; // Distance between providers
const MAX_CLIENT_DISTANCE = 3;   // Distance from client to delivery point

/**
 * Check if two providers are within grouping distance
 */
function areProvidersClose(provider1Location, provider2Location) {
  if (!provider1Location || !provider2Location) return false;
  const dist = calculateDistance(
    provider1Location.latitude,
    provider1Location.longitude,
    provider2Location.latitude,
    provider2Location.longitude
  );
  return dist <= MAX_PROVIDER_DISTANCE;
}

/**
 * Check if client is within range of delivery point
 */
function isClientInRange(clientLocation, deliveryAddress) {
  if (!clientLocation || !deliveryAddress) return false;
  const dist = calculateDistance(
    clientLocation.latitude,
    clientLocation.longitude,
    deliveryAddress.latitude,
    deliveryAddress.longitude
  );
  return dist <= MAX_CLIENT_DISTANCE;
}

/**
 * COMMENT 2: Check if two delivery addresses are close to each other
 * For A2/A3 grouping, we need delivery addresses to be close, not client locations
 */
function areDeliveryAddressesClose(deliveryAddress1, deliveryAddress2) {
  if (!deliveryAddress1 || !deliveryAddress2) return false;
  const dist = calculateDistance(
    deliveryAddress1.latitude,
    deliveryAddress1.longitude,
    deliveryAddress2.latitude,
    deliveryAddress2.longitude
  );
  return dist <= MAX_CLIENT_DISTANCE;
}

/**
 * Find candidate orders for grouping:
 * - status: pending
 * - not yet grouped (isGrouped: false)
 * - within scheduling window (5-10 min old)
 * - within distance thresholds
 */
async function findGroupingCandidates(minutesBack = 20) {
  const now = new Date();
  const earliest = new Date(Date.now() - minutesBack * 60 * 1000); // e.g., last 20 minutes

  // Only include orders that are pending, not grouped, recently created (within window),
  // and whose scheduledFor is null or already passed (i.e., delay expired)
  const candidates = await Order.find({
    status: 'pending',
    isGrouped: false,
    // Explicitly exclude urgent/A4 and any orders explicitly marked non-groupable
    orderType: { $in: ['A1', 'A2', 'A3'] },
    isUrgent: { $ne: true },
    canBeGrouped: { $ne: false },
    createdAt: { $gte: earliest },
    $or: [ { scheduledFor: null }, { scheduledFor: { $lte: now } } ]
  })
    .populate('client', 'firstName lastName location')
    .populate('provider', 'name location')
    .sort({ createdAt: 1 })
    .limit(500); // safety cap to avoid very large scans

  return candidates;
}

/**
 * Group two compatible orders into A2
 */
async function groupOrdersIntoA2(order1, order2) {
  try {
    // Vérifier que les deux commandes ont des providers valides
    if (!order1.provider || !order2.provider) {
      console.warn('⚠️ Missing provider data for A2 grouping');
      return null;
    }
    
    if (!order1.provider.location || !order2.provider.location) {
      console.warn('⚠️ Missing provider location for A2 grouping');
      return null;
    }
    
    if (!order1.deliveryAddress || !order2.deliveryAddress) {
      console.warn('⚠️ Missing delivery address for A2 grouping');
      return null;
    }
    
    // Verify distance constraints
    const providersClose = areProvidersClose(order1.provider.location, order2.provider.location);
    // COMMENT 2: Check delivery-to-delivery distance, not client-to-delivery
    const deliveriesClose = areDeliveryAddressesClose(order1.deliveryAddress, order2.deliveryAddress);

    if (!providersClose || !deliveriesClose) {
      return null; // Not eligible for grouping
    }

    // Create group
    const groupedOrders = [order1._id, order2._id];
    const soldeDual = balanceCalc.calculateSoldeDual([order1, order2]);

    // Update both orders with atomic conditions to prevent concurrent changes
    const updateResult = await Order.updateMany(
      { 
        _id: { $in: groupedOrders },
        status: 'pending',
        deliveryDriver: null,
        isGrouped: false
      },
      {
        isGrouped: true,
        groupedOrders: groupedOrders,
        orderType: 'A2',
        soldeDual: soldeDual
      }
    );

    // Verify that both orders were successfully updated
    if (updateResult.modifiedCount !== groupedOrders.length) {
      console.warn(`⚠️ A2 grouping mismatch: expected ${groupedOrders.length} updates, got ${updateResult.modifiedCount}`);
      console.warn('⚠️ Skipping notifications and treating grouping as failed for retry');
      return null;
    }

    console.log(`✅ Grouped orders ${order1._id} + ${order2._id} into A2`);
    return { groupedOrders, solde: soldeDual, groupType: 'A2' };
  } catch (error) {
    console.error('Error grouping orders into A2:', error);
    return null;
  }
}

/**
 * Group three compatible orders into A3
 */
async function groupOrdersIntoA3(order1, order2, order3) {
  try {
    // Vérifier que les trois commandes ont des providers valides
    if (!order1.provider || !order2.provider || !order3.provider) {
      console.warn('⚠️ Missing provider data for A3 grouping');
      return null;
    }
    
    if (!order1.provider.location || !order2.provider.location || !order3.provider.location) {
      console.warn('⚠️ Missing provider location for A3 grouping');
      return null;
    }
    
    if (!order1.deliveryAddress || !order2.deliveryAddress || !order3.deliveryAddress) {
      console.warn('⚠️ Missing delivery address for A3 grouping');
      return null;
    }
    
    // Verify distance constraints for all pairs
    const providersClose12 = areProvidersClose(order1.provider.location, order2.provider.location);
    const providersClose13 = areProvidersClose(order1.provider.location, order3.provider.location);
    const providersClose23 = areProvidersClose(order2.provider.location, order3.provider.location);

    // COMMENT 2: Check delivery-to-delivery distances, not client-to-delivery
    const deliveriesClose12 = areDeliveryAddressesClose(order1.deliveryAddress, order2.deliveryAddress);
    const deliveriesClose13 = areDeliveryAddressesClose(order1.deliveryAddress, order3.deliveryAddress);
    const deliveriesClose23 = areDeliveryAddressesClose(order2.deliveryAddress, order3.deliveryAddress);

    if (
      !providersClose12 || !providersClose13 || !providersClose23 ||
      !deliveriesClose12 || !deliveriesClose13 || !deliveriesClose23
    ) {
      return null; // Not eligible
    }

    // Create group
    const groupedOrders = [order1._id, order2._id, order3._id];
    const soldeTriple = balanceCalc.calculateSoldeTriple([order1, order2, order3]);

    // Update all three orders with atomic conditions to prevent concurrent changes
    const updateResult = await Order.updateMany(
      { 
        _id: { $in: groupedOrders },
        status: 'pending',
        deliveryDriver: null,
        isGrouped: false
      },
      {
        isGrouped: true,
        groupedOrders: groupedOrders,
        orderType: 'A3',
        soldeTriple: soldeTriple
      }
    );

    // Verify that all three orders were successfully updated
    if (updateResult.modifiedCount !== groupedOrders.length) {
      console.warn(`⚠️ A3 grouping mismatch: expected ${groupedOrders.length} updates, got ${updateResult.modifiedCount}`);
      console.warn('⚠️ Skipping notifications and treating grouping as failed for retry');
      return null;
    }

    console.log(`✅ Grouped orders ${order1._id} + ${order2._id} + ${order3._id} into A3`);
    return { groupedOrders, solde: soldeTriple, groupType: 'A3' };
  } catch (error) {
    console.error('Error grouping orders into A3:', error);
    return null;
  }
}

/**
 * Main grouping orchestration: find candidates and attempt grouping
 */
async function detectAndGroupOrders() {
  try {
    const candidates = await findGroupingCandidates(20); // consider last 20 minutes by default

    if (candidates.length < 2) {
      console.log('📭 Not enough candidates for grouping');
      return { grouped: 0, attempted: 0 };
    }

    let grouped = 0;
    const processed = new Set();
    const groups = [];

    // Try to form A3 groups first (better efficiency)
    for (let i = 0; i < candidates.length - 2; i++) {
      if (processed.has(candidates[i]._id.toString())) continue;

      for (let j = i + 1; j < candidates.length - 1; j++) {
        if (processed.has(candidates[j]._id.toString())) continue;

        for (let k = j + 1; k < candidates.length; k++) {
          if (processed.has(candidates[k]._id.toString())) continue;

          const result = await groupOrdersIntoA3(candidates[i], candidates[j], candidates[k]);
          if (result) {
            processed.add(candidates[i]._id.toString());
            processed.add(candidates[j]._id.toString());
            processed.add(candidates[k]._id.toString());
            grouped++;
            groups.push(result);
            break;
          }
        }
        if (processed.has(candidates[i]._id.toString())) break;
      }
    }

    // Try to form A2 groups from remaining unprocessed
    for (let i = 0; i < candidates.length - 1; i++) {
      if (processed.has(candidates[i]._id.toString())) continue;

      for (let j = i + 1; j < candidates.length; j++) {
        if (processed.has(candidates[j]._id.toString())) continue;

        const result = await groupOrdersIntoA2(candidates[i], candidates[j]);
        if (result) {
          processed.add(candidates[i]._id.toString());
          processed.add(candidates[j]._id.toString());
          grouped++;
          groups.push(result);
          break;
        }
      }
    }

    console.log(`📦 Grouping cycle complete: ${grouped} groups formed from ${candidates.length} candidates`);
    return { grouped, attempted: candidates.length, groups };
  } catch (error) {
    console.error('Error in detectAndGroupOrders:', error);
    return { grouped: 0, attempted: 0, groups: [], error: error.message };
  }
}

/**
 * Notify deliverers when a group is formed
 */
async function notifyGroupFormed(groupedOrderIds, groupType, solde) {
  try {
    // Find deliverers available for this group
    const deliverers = await User.find({
      role: 'deliverer',
      status: 'active',
      pushToken: { $exists: true, $ne: '' }
    });
    const title = '🚚 Nouveau Groupe de Commandes';
    const soldeText = solde ? solde.toFixed(2) : '0.00';
    const body = `Groupe ${groupType} disponible - Solde: ${soldeText} TND`;
    const data = {
      groupedOrderIds: groupedOrderIds.join(','),
      groupType,
      solde: solde?.toString() || '0'
    };

    for (const deliverer of deliverers) {
      try {
        if (deliverer.pushToken) {
          await sendPushNotification(deliverer.pushToken, title, body, data);
        }
      } catch (err) {
        console.error(`Error sending notification to deliverer ${deliverer._id}:`, err);
      }
    }

    console.log(`✅ Notified ${deliverers.length} deliverers about group formation (${groupType})`);
  } catch (error) {
    console.error('Error notifying deliverers:', error);
  }
}

module.exports = {
  areProvidersClose,
  isClientInRange,
  findGroupingCandidates,
  groupOrdersIntoA2,
  groupOrdersIntoA3,
  detectAndGroupOrders,
  notifyGroupFormed,
  MAX_PROVIDER_DISTANCE,
  MAX_CLIENT_DISTANCE
};
