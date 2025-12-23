const Order = require('../models/Order');
const User = require('../models/User');
const Cancellation = require('../models/Cancellation');
const { calculateMontantCourse } = require('./remunerationService');

/**
 * Helper: Decrement deliverer's activeOrdersCount and reset status to 'active' if count reaches 0
 * @param {Object} deliverer - Deliverer user document
 */
async function decrementDelivererActiveOrders(deliverer) {
  if (!deliverer) return;
  
  deliverer.activeOrdersCount = Math.max(0, (deliverer.activeOrdersCount || 1) - 1);
  
  // Reset status to 'active' if no more active orders
  if (deliverer.activeOrdersCount === 0) {
    deliverer.status = 'active';
  }
  
  await deliverer.save();
  console.log(`📉 Deliverer ${deliverer._id}: activeOrdersCount decremented to ${deliverer.activeOrdersCount}, status=${deliverer.status}`);
}

/**
 * Handle ANNULER_1: Client cancellation within 1 minute of order creation
 * No penalty, no solde deduction
 * 
 * @param {Object} order - The order document
 * @returns {Promise<Object>} Cancellation result
 */
async function handleAnnuler1(order) {
  try {
    if (!order) {
      throw new Error('Order is required');
    }

    // Verify the order was created less than 1 minute ago
    const createdTime = order.createdAt ? new Date(order.createdAt) : null;
    if (!createdTime) {
      throw new Error('Order creation time not found');
    }

    const elapsedMinutes = (Date.now() - createdTime.getTime()) / (1000 * 60);
    if (elapsedMinutes > 1) {
      return {
        success: false,
        message: 'La fenêtre d\'annulation de 1 minute est dépassée'
      };
    }

    // Cancel order with no penalty
    order.cancellationType = 'ANNULER_1';
    order.cancellationSolde = 0;
    order.cancellationReason = 'Client cancellation within 1 minute';
    order.cancelledAt = new Date();
    order.status = 'cancelled';
    await order.save();

    // Create cancellation record for ANNULER_1 (with zero solde)
    const deliverer = order.deliveryDriver ? await User.findById(order.deliveryDriver) : null;
    await createCancellationRecord(order, deliverer, 'ANNULER_1', 0, 'Client cancellation within 1 minute');

    console.log(`🚫 ANNULER_1: Order ${order._id} cancelled by client (no penalty)`);

    return {
      success: true,
      message: 'Commande annulée sans pénalité',
      cancellationType: 'ANNULER_1',
      solde: 0
    };
  } catch (error) {
    console.error('Error in handleAnnuler1:', error.message);
    throw error;
  }
}

/**
 * Handle ANNULER_2: Provider cancellation due to product unavailability
 * Solde = Mode_1 ? (Payout + 0.3×Mnt_Course) : 0.3×Mnt_Course
 * 
 * @param {Object} order - The order document (must have zone and deliveryDriver populated)
 * @param {String} reason - Cancellation reason
 * @returns {Promise<Object>} Cancellation result
 */
async function handleAnnuler2(order, reason = 'Product unavailable') {
  try {
    if (!order) {
      throw new Error('Order is required');
    }

    // Get montant course and payment mode
    const deliverer = order.deliveryDriver ? await User.findById(order.deliveryDriver) : null;
    let montantCourse = 0;

    if (deliverer && order.zone && order.orderType) {
      try {
        montantCourse = await calculateMontantCourse(order, deliverer, order.orderType);
      } catch (calcErr) {
        console.warn('Could not calculate montant course:', calcErr.message);
        montantCourse = 0;
      }
    }

    // Determine payment mode (default to 'Mode_1' if not specified)
    const paymentMode = order.providerPaymentMode || 'especes'; // especes/facture
    const payout = order.restaurantPayout || order.p1Total || 0;

    // Calculate solde based on payment mode
    // Mode_1 (especes/standard): Payout + 0.3 × Mnt_Course
    // Mode_2/3/4 (other modes): 0.3 × Mnt_Course
    let cancellationSolde = 0.3 * montantCourse;
    if (paymentMode === 'especes') {
      // Treat especes as Mode_1
      cancellationSolde = payout + (0.3 * montantCourse);
    }

    // Update order
    order.cancellationType = 'ANNULER_2';
    order.cancellationSolde = Number(cancellationSolde.toFixed(2));
    order.cancellationReason = reason;
    order.cancelledAt = new Date();
    order.status = 'cancelled';
    await order.save();

    // COMMENT 1: Decrement deliverer's activeOrdersCount and reset status if needed
    await decrementDelivererActiveOrders(deliverer);

    // Update deliverer's daily balance if exists
    if (deliverer) {
      await updateDelivererCancellationBalance(deliverer, order, cancellationSolde);
    }

    // Create cancellation record
    await createCancellationRecord(order, deliverer, 'ANNULER_2', cancellationSolde, reason);

    console.log(`🚫 ANNULER_2: Order ${order._id} cancelled by provider - solde=${Number(cancellationSolde.toFixed(2))}`);

    return {
      success: true,
      message: 'Commande annulée par le prestataire',
      cancellationType: 'ANNULER_2',
      solde: Number(cancellationSolde.toFixed(2))
    };
  } catch (error) {
    console.error('Error in handleAnnuler2:', error.message);
    throw error;
  }
}

/**
 * Handle ANNULER_3: Admin cancellation due to client absence
 * Blocks the client account and deducts solde from deliverer
 * Solde = Mode_1 ? (Payout + 0.3×Mnt_Course) : 0.3×Mnt_Course
 * 
 * @param {Object} order - The order document (must have client, zone, deliveryDriver populated)
 * @param {String} adminId - The admin ID performing the cancellation
 * @returns {Promise<Object>} Cancellation result
 */
async function handleAnnuler3(order, adminId) {
  try {
    if (!order || !adminId) {
      throw new Error('Order and adminId are required');
    }

    // Get montant course and payment mode
    const deliverer = order.deliveryDriver ? await User.findById(order.deliveryDriver) : null;
    let montantCourse = 0;

    if (deliverer && order.zone && order.orderType) {
      try {
        montantCourse = await calculateMontantCourse(order, deliverer, order.orderType);
      } catch (calcErr) {
        console.warn('Could not calculate montant course:', calcErr.message);
        montantCourse = 0;
      }
    }

    // Determine payment mode (default to 'Mode_1' if not specified)
    const paymentMode = order.providerPaymentMode || 'especes';
    const payout = order.restaurantPayout || order.p1Total || 0;

    // Calculate solde based on payment mode
    // Mode_1 (especes/standard): Payout + 0.3 × Mnt_Course
    // Mode_2/3/4 (other modes): 0.3 × Mnt_Course
    let cancellationSolde = 0.3 * montantCourse;
    if (paymentMode === 'especes') {
      // Treat especes as Mode_1
      cancellationSolde = payout + (0.3 * montantCourse);
    }

    // Block the client account
    const client = order.client ? await User.findById(order.client) : null;
    if (client) {
      client.isBlocked = true;
      client.blockedReason = 'Client absence - account blocked by admin';
      client.blockedAt = new Date();
      await client.save();
      console.log(`🚷 Client ${client._id} blocked for account absence`);
    }

    // Update order
    order.cancellationType = 'ANNULER_3';
    order.cancellationSolde = Number(cancellationSolde.toFixed(2));
    order.cancellationReason = 'Client absence - account blocked';
    order.cancelledBy = adminId;
    order.cancelledAt = new Date();
    order.status = 'cancelled';
    await order.save();

    // COMMENT 1: Decrement deliverer's activeOrdersCount and reset status if needed
    await decrementDelivererActiveOrders(deliverer);

    // Update deliverer's daily balance
    if (deliverer) {
      await updateDelivererCancellationBalance(deliverer, order, cancellationSolde);
    }

    // Create cancellation record
    await createCancellationRecord(order, deliverer, 'ANNULER_3', cancellationSolde, 'Client absence - account blocked');

    console.log(`🚫 ANNULER_3: Order ${order._id} cancelled by admin - Client blocked - solde=${Number(cancellationSolde.toFixed(2))}`);

    return {
      success: true,
      message: 'Commande annulée et compte client bloqué',
      cancellationType: 'ANNULER_3',
      clientBlocked: true,
      solde: Number(cancellationSolde.toFixed(2))
    };
  } catch (error) {
    console.error('Error in handleAnnuler3:', error.message);
    throw error;
  }
}

/**
 * Update deliverer's daily balance with cancellation solde
 * @private
 */
async function updateDelivererCancellationBalance(deliverer, order, cancellationSolde) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find or create today's balance entry
    let entryIndex = -1;
    if (Array.isArray(deliverer.dailyBalance)) {
      entryIndex = deliverer.dailyBalance.findIndex(e => {
        if (!e || !e.date) return false;
        const d = new Date(e.date);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
      });
    } else {
      deliverer.dailyBalance = [];
    }

    if (entryIndex >= 0) {
      // Update existing entry
      deliverer.dailyBalance[entryIndex].soldeAnnulation = 
        Number((deliverer.dailyBalance[entryIndex].soldeAnnulation || 0) + cancellationSolde);
    } else {
      // Create new entry
      deliverer.dailyBalance.push({
        date: today,
        orders: [],
        soldeAmigos: 0,
        soldeAnnulation: Number(cancellationSolde),
        paid: false,
        paidAt: null
      });
    }

    await deliverer.save();
    console.log(`💰 Deliverer ${deliverer._id}: soldeAnnulation updated (+${cancellationSolde.toFixed(2)})`);
  } catch (error) {
    console.error('Error updating deliverer cancellation balance:', error.message);
  }
}

/**
 * Create a cancellation record in the Cancellation collection
 * @private
 */
async function createCancellationRecord(order, deliverer, type, solde, reason) {
  try {
    const cancellation = new Cancellation({
      order: order._id,
      deliverer: deliverer ? deliverer._id : null, // Optional: can be null if no deliverer assigned
      type,
      solde: Number(solde.toFixed(2)),
      mode: order.orderType || 'A1',
      reason,
      createdAt: new Date()
    });

    await cancellation.save();
    console.log(`📋 Cancellation record created: ${cancellation._id} (type=${type}, deliverer=${deliverer ? deliverer._id : 'none'})`);
  } catch (error) {
    console.error('Error creating cancellation record:', error.message);
    // Do not throw - allow operation to continue if record creation fails
  }
}

/**
 * Calculate total cancellation amount (masse d'annulation) for a deliverer on a given date
 * 
 * @param {Object} deliverer - The deliverer user document
 * @param {Date} date - The date to calculate for
 * @returns {Promise<Number>} Total cancellation solde for the date
 */
async function calculateMasseAnnulation(deliverer, date) {
  try {
    if (!deliverer || !date) {
      throw new Error('Deliverer and date are required');
    }

    // Find all cancellations for this deliverer on the given date
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const cancellations = await Cancellation.find({
      deliverer: deliverer._id,
      createdAt: { $gte: startDate, $lte: endDate }
    });

    const totalSolde = cancellations.reduce((sum, cancel) => {
      return sum + (cancel.solde || 0);
    }, 0);

    console.log(`📊 Masse d'annulation for ${deliverer._id} on ${date.toDateString()}: ${totalSolde.toFixed(2)} TND`);

    return Number(totalSolde.toFixed(2));
  } catch (error) {
    console.error('Error calculating masse annulation:', error.message);
    throw error;
  }
}

/**
 * Check if a client is blocked from placing new orders
 * 
 * @param {String} clientId - The client user ID
 * @returns {Promise<Object>} { isBlocked: boolean, reason: string }
 */
async function checkClientBlockStatus(clientId) {
  try {
    const client = await User.findById(clientId);
    if (!client) {
      return { isBlocked: false, reason: null };
    }

    return {
      isBlocked: client.isBlocked || false,
      reason: client.blockedReason || null
    };
  } catch (error) {
    console.error('Error checking client block status:', error.message);
    throw error;
  }
}

module.exports = {
  handleAnnuler1,
  handleAnnuler2,
  handleAnnuler3,
  calculateMasseAnnulation,
  checkClientBlockStatus,
  // Private helpers (exported for testing if needed)
  updateDelivererCancellationBalance,
  createCancellationRecord
};
