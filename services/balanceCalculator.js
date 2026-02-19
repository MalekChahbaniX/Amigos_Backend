// Balance calculation utilities for orders
// Exports:
// - calculateSoldeSimple(order)
// - calculateSoldeDual(order1, order2)
// - calculateSoldeTriple(order1, order2, order3)
// - calculateSoldeAmigos(orders, appFee)
// - calculatePlatformSolde(order) - NOUVEAU: avec marges et frais Excel

const MarginSettings = require('../models/MarginSettings');
const AdditionalFees = require('../models/AdditionalFees');
const AppSetting = require('../models/AppSetting');

function calculateSoldeSimple(order) {
  // clientPrice - restaurantPayout
  // Accept either order.clientProductsPrice / order.restaurantPayout or p2Total/p1Total
  const clientPrice = typeof order.clientProductsPrice === 'number' ? order.clientProductsPrice : (order.p2Total || 0);
  const restaurantPayout = typeof order.restaurantPayout === 'number' ? order.restaurantPayout : (order.p1Total || 0);
  return Number((clientPrice - restaurantPayout) || 0);
}

function calculateSoldeDual(order1, order2) {
  return calculateSoldeSimple(order1) + calculateSoldeSimple(order2);
}

function calculateSoldeTriple(order1, order2, order3) {
  return calculateSoldeSimple(order1) + calculateSoldeSimple(order2) + calculateSoldeSimple(order3);
}

function calculateSoldeAmigos(orders, appFee) {
  // Sum simple soldes + appFee
  const sum = (orders || []).reduce((acc, o) => acc + calculateSoldeSimple(o), 0);
  return Number((sum + (appFee || 0)) || 0);
}

// NOUVEAU: Calcul du solde plateforme avec logique Excel complète
async function calculatePlatformSolde(order) {
  try {
    const clientPrice = order.clientProductsPrice || order.p2Total || 0;
    const restaurantPayout = order.restaurantPayout || order.p1Total || 0;
    const deliveryFee = order.deliveryFee || 0;
    const appFee = order.appFee || 0;
    
    // 1. Obtenir les paramètres de marge selon type de commande
    let orderTypeForMargin = 'C1'; // défaut
    if (order.orderType) {
      // Mapper A1-A4 vers C1-C3 pour les marges
      if (['A1', 'A2'].includes(order.orderType)) orderTypeForMargin = 'C1';
      else if (order.orderType === 'A3') orderTypeForMargin = 'C2';
      else if (order.orderType === 'A4') orderTypeForMargin = 'C3';
    }
    
    const marginConfig = await MarginSettings.getMarginByType(orderTypeForMargin);
    const calculatedMargin = await MarginSettings.calculateMargin(orderTypeForMargin, clientPrice - restaurantPayout);
    
    // 2. Calculer les frais additionnels
    const feesConfig = await AdditionalFees.calculateApplicableFees(orderTypeForMargin);
    
    // 3. Obtenir le bonus AMIGOS
    const appSettings = await AppSetting.findOne();
    const amigosBonus = (appSettings && appSettings.amigosBonusEnabled) ? 
      (appSettings.amigosBonusCourseAmount || 0) : 0;
    
    // 4. Calculer le solde plateforme selon Excel:
    // Marge_Net_AmiGo = (clientPrice - restaurantPayout) + deliveryFee + appFee - margin - fees + bonus
    const baseSolde = (clientPrice - restaurantPayout) + deliveryFee + appFee;
    const totalDeductions = calculatedMargin + feesConfig.totalFees;
    const platformSolde = baseSolde - totalDeductions + amigosBonus;
    
    return {
      platformSolde: Number(platformSolde.toFixed(3)),
      breakdown: {
        baseSolde: Number(baseSolde.toFixed(3)),
        margin: Number(calculatedMargin.toFixed(3)),
        marginConfig,
        additionalFees: Number(feesConfig.totalFees.toFixed(3)),
        feesBreakdown: feesConfig.applicableFees,
        amigosBonus: Number(amigosBonus.toFixed(3)),
        margeNetAmigos: Number((baseSolde - totalDeductions).toFixed(3))
      }
    };
  } catch (error) {
    console.error('Error calculating platform solde:', error);
    // Fallback au calcul simple
    const fallbackSolde = (order.clientProductsPrice - order.restaurantPayout) + (order.deliveryFee || 0) + (order.appFee || 0);
    return {
      platformSolde: Number(fallbackSolde.toFixed(3)),
      breakdown: {
        baseSolde: Number(fallbackSolde.toFixed(3)),
        margin: 0,
        additionalFees: 0,
        amigosBonus: 0,
        margeNetAmigos: Number(fallbackSolde.toFixed(3))
      }
    };
  }
}

async function updateOrderSoldes(order) {
  // Do not modify other fields; compute soldes and persist
  const soldeSimple = calculateSoldeSimple(order);
  const soldeAmigos = calculateSoldeAmigos([order], order.appFee || 0);
  
  // NOUVEAU: Calculer le solde plateforme avec logique Excel
  const platformSoldeResult = await calculatePlatformSolde(order);

  order.soldeSimple = soldeSimple;
  order.soldeAmigos = soldeAmigos;
  order.platformSolde = platformSoldeResult.platformSolde; // NOUVEAU
  
  // Ajouter le détail du calcul dans l'ordre pour debugging
  order.calculationBreakdown = platformSoldeResult.breakdown;

  // Save order document and return it
  return await order.save();
}

// Calculate soldes for an order based on orderType and grouped orders
async function calculateSoldesByOrderType(mainOrder) {
  // mainOrder must have orderType and potentially groupedOrders populated
  if (!mainOrder.orderType) {
    return null; // orderType not assigned yet
  }

  const orders = [mainOrder];
  
  // If groupedOrders are populated, include them in solde calculation
  if (mainOrder.groupedOrders && Array.isArray(mainOrder.groupedOrders)) {
    // groupedOrders can be populated (objects) or just IDs
    for (const grouped of mainOrder.groupedOrders) {
      if (grouped && grouped.clientProductsPrice !== undefined) {
        orders.push(grouped);
      }
    }
  }

  let totalSolde = 0;
  
  switch (mainOrder.orderType) {
    case 'A1':
      totalSolde = calculateSoldeSimple(mainOrder);
      break;
    case 'A2':
      if (orders.length >= 2) {
        totalSolde = calculateSoldeDual(orders[0], orders[1]);
      } else {
        totalSolde = calculateSoldeSimple(mainOrder);
      }
      break;
    case 'A3':
      if (orders.length >= 3) {
        totalSolde = calculateSoldeTriple(orders[0], orders[1], orders[2]);
      } else {
        totalSolde = calculateSoldeAmigos(orders, mainOrder.appFee || 0);
      }
      break;
    case 'A4':
      // Urgent orders: sum all grouped + main order
      totalSolde = calculateSoldeAmigos(orders, mainOrder.appFee || 0);
      break;
  }

  return totalSolde;
}

module.exports = {
  calculateSoldeSimple,
  calculateSoldeDual,
  calculateSoldeTriple,
  calculateSoldeAmigos,
  calculatePlatformSolde, // NOUVEAU
  updateOrderSoldes,
  calculateSoldesByOrderType
};
