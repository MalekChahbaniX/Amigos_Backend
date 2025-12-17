// Balance calculation utilities for orders
// Exports:
// - calculateSoldeSimple(order)
// - calculateSoldeDual(order1, order2)
// - calculateSoldeTriple(order1, order2, order3)
// - calculateSoldeAmigos(orders, appFee)

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

async function updateOrderSoldes(order) {
  // Do not modify other fields; compute soldes and persist
  const soldeSimple = calculateSoldeSimple(order);
  const soldeAmigos = calculateSoldeAmigos([order], order.appFee || 0);

  order.soldeSimple = soldeSimple;
  order.soldeAmigos = soldeAmigos;

  // Save the order document and return it
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
  updateOrderSoldes,
  calculateSoldesByOrderType
};
