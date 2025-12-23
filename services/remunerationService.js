const mongoose = require('mongoose');
const City = require('../models/City');
const Zone = require('../models/Zone');
const { calculateSoldeSimple, calculateSoldeDual, calculateSoldeTriple, calculateSoldeAmigos } = require('./balanceCalculator');

/**
 * Calculate the delivery amount (montant course) based on the formula: Multi × Min_G/Z(n)
 * where Multi is the city multiplier and Min_G is the minimum guarantee for the order type
 * 
 * @param {Object} order - The order document (must have zone and orderType populated/referenced)
 * @param {Object} deliverer - The deliverer user document
 * @param {String} orderType - The order type (A1, A2, A3, A4)
 * @returns {Promise<Number>} The calculated delivery amount
 */
async function calculateMontantCourse(order, deliverer, orderType) {
  try {
    if (!order || !orderType) {
      throw new Error('Order and orderType are required');
    }

    // Get zone and city information
    let zone;
    if (order.zone && order.zone._id) {
      zone = order.zone;
    } else if (order.zone) {
      zone = await Zone.findById(order.zone);
    } else {
      throw new Error('Zone information not found in order');
    }

    if (!zone) {
      throw new Error('Zone not found');
    }

    // Get the minimum guarantee for the order type
    let minGarantie = 0;
    switch (orderType) {
      case 'A1':
        minGarantie = zone.minGarantieA1 || 0;
        break;
      case 'A2':
        minGarantie = zone.minGarantieA2 || 0;
        break;
      case 'A3':
        minGarantie = zone.minGarantieA3 || 0;
        break;
      case 'A4':
        minGarantie = zone.minGarantieA4 || 0;
        break;
      default:
        minGarantie = zone.minGarantieA1 || 0;
    }

    // Get the city multiplier
    let city;
    if (deliverer && deliverer.location && deliverer.location.zone) {
      // Try to find city from zone or use a default approach
      city = await City.findOne({ activeZones: zone.number });
    }

    if (!city) {
      // Fallback: create a default city or use a default multiplier
      city = { multiplicateur: 1 };
    }

    const multiplicateur = city.multiplicateur || 1;

    // Calculate montant course: Multi × Min_G
    const montantCourse = multiplicateur * minGarantie;

    return Number(montantCourse.toFixed(2));
  } catch (error) {
    console.error('Error calculating montant course:', error.message);
    throw error;
  }
}

/**
 * COMMENT 4: Determine payment mode based on order characteristics
 * Modes:
 *   Mode_1: Standard delivery (single order, normal priority)
 *   Mode_2: Express delivery (fast delivery required)
 *   Mode_3: Grouped delivery (A2/A3 grouped orders)
 *   Mode_4: Urgent delivery (A4 urgent orders)
 * 
 * @param {Object} order - The order document
 * @returns {String} The payment mode
 */
function determinePaymentMode(order) {
  if (!order) return 'Mode_1';
  
  // Priority: Urgent > Grouped > Express > Standard
  if (order.isUrgent || order.orderType === 'A4') {
    return 'Mode_4'; // Urgent: premium pricing
  }
  
  if (order.isGrouped || (order.orderType && ['A2', 'A3'].includes(order.orderType))) {
    return 'Mode_3'; // Grouped: economic pricing
  }
  
  // Check for express/priority flag if it exists
  if (order.isExpress || order.isPriority) {
    return 'Mode_2'; // Express: moderate premium
  }
  
  // Default to standard
  return 'Mode_1';
}

/**
 * COMMENT 4: Calculate provider payout based on order, payment mode, and business flow
 * Payouts vary by mode to reflect pricing strategy
 * 
 * @param {Object} order - The order document
 * @param {String} providerPaymentMode - The payment mode for the provider (especes, facture, etc.)
 * @param {String} businessMode - The business mode (Mode_1, Mode_2, Mode_3, Mode_4)
 * @returns {Promise<Object>} Object with payout details
 */
async function calculateProviderPayout(order, providerPaymentMode = 'especes', businessMode = 'Mode_1') {
  try {
    if (!order) {
      throw new Error('Order is required');
    }

    const restaurantPayout = order.restaurantPayout || order.p1Total || 0;
    
    // Apply mode-based multiplier
    let payoutAmount = restaurantPayout;
    let modeMultiplier = 1;
    
    switch (businessMode) {
      case 'Mode_1': // Standard
        modeMultiplier = 1;
        break;
      case 'Mode_2': // Express: 1.1x payout for partner
        modeMultiplier = 1.1;
        break;
      case 'Mode_3': // Grouped: 0.95x payout for partner (economy)
        modeMultiplier = 0.95;
        break;
      case 'Mode_4': // Urgent: 1.2x payout for partner
        modeMultiplier = 1.2;
        break;
      default:
        modeMultiplier = 1;
    }
    
    payoutAmount = restaurantPayout * modeMultiplier;

    return {
      baseAmount: Number(restaurantPayout.toFixed(2)),
      modeMultiplier: modeMultiplier,
      amount: Number(payoutAmount.toFixed(2)),
      mode: providerPaymentMode,
      businessMode: businessMode,
      currency: 'TND',
      description: `Payout for order ${order._id}`
    };
  } catch (error) {
    console.error('Error calculating provider payout:', error.message);
    throw error;
  }
}

/**
 * COMMENT 4: Calculate client total based on order and business mode
 * Client amounts vary by mode reflecting pricing strategy and incentives
 * 
 * @param {Object} order - The order document
 * @param {String} clientPaymentMethod - The payment method (cash, online, etc.)
 * @param {String} businessMode - The business mode (Mode_1, Mode_2, Mode_3, Mode_4)
 * @returns {Promise<Object>} Object with client total details
 */
async function calculateClientTotal(order, clientPaymentMethod = 'cash', businessMode = 'Mode_1') {
  try {
    if (!order) {
      throw new Error('Order is required');
    }

    const totalAmount = order.totalAmount || order.finalAmount || 0;
    const clientProductsPrice = order.clientProductsPrice || order.p2Total || 0;
    const deliveryFee = order.deliveryFee || 0;
    const appFee = order.appFee || 0;

    // Apply mode-based multiplier
    let clientAmount = totalAmount;
    let modeMultiplier = 1;
    
    switch (businessMode) {
      case 'Mode_1': // Standard
        modeMultiplier = 1;
        break;
      case 'Mode_2': // Express: 1.15x (premium for speed)
        modeMultiplier = 1.15;
        break;
      case 'Mode_3': // Grouped: 0.9x (discount for grouping)
        modeMultiplier = 0.9;
        break;
      case 'Mode_4': // Urgent: 1.25x (premium for urgency)
        modeMultiplier = 1.25;
        break;
      default:
        modeMultiplier = 1;
    }
    
    clientAmount = totalAmount * modeMultiplier;

    return {
      baseAmount: Number(totalAmount.toFixed(2)),
      modeMultiplier: modeMultiplier,
      totalAmount: Number(clientAmount.toFixed(2)),
      productPrice: Number((clientProductsPrice * modeMultiplier).toFixed(2)),
      deliveryFee: Number((deliveryFee * modeMultiplier).toFixed(2)),
      appFee: Number((appFee * modeMultiplier).toFixed(2)),
      paymentMethod: clientPaymentMethod,
      businessMode: businessMode,
      currency: 'TND',
      description: `Client payment for order ${order._id}`
    };
  } catch (error) {
    console.error('Error calculating client total:', error.message);
    throw error;
  }
}

/**
 * COMMENT 4: Calculate remuneration with per-mode pricing strategy
 * Each mode (1-4) has distinct business flows:
 * 
 * Mode_1 (Standard):
 *   - Deliverer: montantCourse
 *   - Partner: restaurantPayout
 *   - Client: totalAmount
 *   - Platform: totalAmount - restaurantPayout - montantCourse
 * 
 * Mode_2 (Express):
 *   - Deliverer: montantCourse × 1.3
 *   - Partner: restaurantPayout × 1.1
 *   - Client: totalAmount × 1.15
 *   - Platform: (totalAmount × 1.15) - (restaurantPayout × 1.1) - (montantCourse × 1.3)
 * 
 * Mode_3 (Grouped):
 *   - Deliverer: montantCourse × 0.85 (reduced for economy)
 *   - Partner: restaurantPayout × 0.95
 *   - Client: totalAmount × 0.9 (discount for grouping)
 *   - Platform: (totalAmount × 0.9) - (restaurantPayout × 0.95) - (montantCourse × 0.85)
 * 
 * Mode_4 (Urgent):
 *   - Deliverer: montantCourse × 1.7 (premium for urgency)
 *   - Partner: restaurantPayout × 1.2
 *   - Client: totalAmount × 1.25
 *   - Platform: (totalAmount × 1.25) - (restaurantPayout × 1.2) - (montantCourse × 1.7)
 * 
 * @param {Object} order - The order document with zone populated
 * @param {Object} deliverer - The deliverer user document
 * @param {String} paymentMode - The payment mode (Mode_1, Mode_2, Mode_3, Mode_4)
 * @returns {Promise<Object>} Object with detailed remuneration breakdown per mode
 */
async function calculateRemuneration(order, deliverer, paymentMode) {
  try {
    if (!order || !deliverer) {
      throw new Error('Order and deliverer are required');
    }

    const orderType = order.orderType || 'A1';
    
    // Auto-detect payment mode if not provided
    if (!paymentMode) {
      paymentMode = determinePaymentMode(order);
    }

    // Get montant course (base delivery fee)
    const montantCourse = await calculateMontantCourse(order, deliverer, orderType);

    // Get base amounts
    const restaurantPayout = order.restaurantPayout || order.p1Total || 0;
    const totalAmount = order.totalAmount || order.finalAmount || 0;

    // Get solde based on order type
    let baseSolde = 0;
    switch (orderType) {
      case 'A1':
        baseSolde = calculateSoldeSimple(order);
        break;
      case 'A2':
        baseSolde = calculateSoldeDual(order);
        break;
      case 'A3':
        baseSolde = calculateSoldeTriple(order);
        break;
      case 'A4':
        baseSolde = calculateSoldeSimple(order);
        break;
      default:
        baseSolde = calculateSoldeSimple(order);
    }

    // Calculate per-mode breakdown
    let delivererRemuneration = 0;
    let partnerPayout = 0;
    let clientAmount = 0;
    let platformRevenue = 0;
    let modePriceMultiplier = 1;
    let modeDeliveryMultiplier = 1;

    switch (paymentMode) {
      case 'Mode_1': // Standard
        delivererRemuneration = montantCourse;
        partnerPayout = restaurantPayout;
        clientAmount = totalAmount;
        platformRevenue = totalAmount - restaurantPayout - montantCourse;
        modePriceMultiplier = 1;
        modeDeliveryMultiplier = 1;
        break;

      case 'Mode_2': // Express (1.3x delivery, 1.1x partner, 1.15x client)
        modePriceMultiplier = 1.15;
        modeDeliveryMultiplier = 1.3;
        delivererRemuneration = montantCourse * 1.3;
        partnerPayout = restaurantPayout * 1.1;
        clientAmount = totalAmount * 1.15;
        platformRevenue = clientAmount - partnerPayout - delivererRemuneration;
        break;

      case 'Mode_3': // Grouped (0.85x delivery, 0.95x partner, 0.9x client)
        modePriceMultiplier = 0.9;
        modeDeliveryMultiplier = 0.85;
        delivererRemuneration = montantCourse * 0.85;
        partnerPayout = restaurantPayout * 0.95;
        clientAmount = totalAmount * 0.9;
        platformRevenue = clientAmount - partnerPayout - delivererRemuneration;
        break;

      case 'Mode_4': // Urgent (1.7x delivery, 1.2x partner, 1.25x client)
        modePriceMultiplier = 1.25;
        modeDeliveryMultiplier = 1.7;
        delivererRemuneration = montantCourse * 1.7;
        partnerPayout = restaurantPayout * 1.2;
        clientAmount = totalAmount * 1.25;
        platformRevenue = clientAmount - partnerPayout - delivererRemuneration;
        break;

      default:
        delivererRemuneration = montantCourse;
        partnerPayout = restaurantPayout;
        clientAmount = totalAmount;
        platformRevenue = totalAmount - restaurantPayout - montantCourse;
    }

    return {
      orderType,
      paymentMode,
      montantCourse: Number(montantCourse.toFixed(2)),
      modeMultipliers: {
        price: modePriceMultiplier,
        delivery: modeDeliveryMultiplier
      },
      breakdown: {
        delivererRemuneration: Number(delivererRemuneration.toFixed(2)),
        partnerPayout: Number(partnerPayout.toFixed(2)),
        clientAmount: Number(clientAmount.toFixed(2)),
        platformRevenue: Number(platformRevenue.toFixed(2))
      },
      solde: {
        baseSolde: Number(baseSolde.toFixed(2)),
        modeSolde: Number((baseSolde * modePriceMultiplier).toFixed(2))
      },
      zone: order.zone?._id || order.zone,
      deliverer: deliverer._id,
      order: order._id,
      currency: 'TND'
    };
  } catch (error) {
    console.error('Error calculating remuneration:', error.message);
    throw error;
  }
}

/**
 * COMMENT 4: Batch calculate remuneration for multiple orders with mode awareness
 * Useful for daily balance calculations with per-mode breakdowns
 * 
 * @param {Array<Object>} orders - Array of order documents
 * @param {Object} deliverer - The deliverer user document
 * @returns {Promise<Object>} Aggregated remuneration details by mode
 */
async function calculateBatchRemuneration(orders, deliverer) {
  try {
    if (!Array.isArray(orders) || !deliverer) {
      throw new Error('Orders array and deliverer are required');
    }

    const remunerations = [];
    const modeBreakdown = {
      Mode_1: { count: 0, totalDeliverer: 0, totalPartner: 0, totalClient: 0, totalPlatform: 0 },
      Mode_2: { count: 0, totalDeliverer: 0, totalPartner: 0, totalClient: 0, totalPlatform: 0 },
      Mode_3: { count: 0, totalDeliverer: 0, totalPartner: 0, totalClient: 0, totalPlatform: 0 },
      Mode_4: { count: 0, totalDeliverer: 0, totalPartner: 0, totalClient: 0, totalPlatform: 0 }
    };

    let totalAmountDue = 0;
    let totalSolde = 0;

    for (const order of orders) {
      const remuneration = await calculateRemuneration(order, deliverer);
      remunerations.push(remuneration);
      
      // Track by mode
      const mode = remuneration.paymentMode;
      if (modeBreakdown[mode]) {
        modeBreakdown[mode].count += 1;
        modeBreakdown[mode].totalDeliverer += remuneration.breakdown.delivererRemuneration;
        modeBreakdown[mode].totalPartner += remuneration.breakdown.partnerPayout;
        modeBreakdown[mode].totalClient += remuneration.breakdown.clientAmount;
        modeBreakdown[mode].totalPlatform += remuneration.breakdown.platformRevenue;
      }
      
      totalAmountDue += remuneration.breakdown.delivererRemuneration;
      totalSolde += remuneration.solde.modeSolde;
    }

    return {
      deliverer: deliverer._id,
      count: orders.length,
      remunerations,
      modeBreakdown,
      totals: {
        delivererEarnings: Number(totalAmountDue.toFixed(2)),
        totalSolde: Number(totalSolde.toFixed(2))
      },
      currency: 'TND',
      calculatedAt: new Date()
    };
  } catch (error) {
    console.error('Error calculating batch remuneration:', error.message);
    throw error;
  }
}

module.exports = {
  calculateMontantCourse,
  determinePaymentMode,
  calculateProviderPayout,
  calculateClientTotal,
  calculateRemuneration,
  calculateBatchRemuneration
};
