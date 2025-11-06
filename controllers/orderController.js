const Order = require('../models/Order');
const Provider = require('../models/Provider');
const Promo = require('../models/Promo');
const AppSetting = require('../models/AppSetting');

// @desc    Create a new order
// @route   POST /api/orders
// @access  Private (client)
exports.createOrder = async (req, res) => {
  const { client, provider, items, deliveryAddress, paymentMethod, totalAmount } = req.body;

  try {
    // 🧠 1. Charger paramètres globaux
    const appSetting = await AppSetting.findOne() || { appFee: 1.0 };

    // 🧠 2. Charger provider (pour connaître son type : restaurant, course, etc.)
    const providerData = await Provider.findById(provider);
    if (!providerData) {
      return res.status(404).json({ message: 'Provider not found' });
    }

    // 🧠 3. Vérifier promo active applicable
    const promo = await Promo.findOne({ status: 'active' });

    let finalAmount = totalAmount;
    let appliedPromo = null;

    if (
      promo &&
      promo.targetServices.includes(providerData.type) &&
      promo.ordersUsed < promo.maxOrders &&
      totalAmount <= promo.maxAmount
    ) {
      // ✅ Promo applicable
      const appliedAppFee = promo.overrideAppFee ?? appSetting.appFee;
      finalAmount = appliedAppFee; // le client paie juste les frais app
      appliedPromo = promo;

      // Incrémenter le compteur promo
      promo.ordersUsed += 1;
      await promo.save();
    } else {
      // ❌ Pas de promo → montant normal + frais app
      finalAmount = totalAmount + appSetting.appFee;
    }

    // 🧠 4. Créer la commande
    const order = await Order.create({
      client,
      provider,
      items,
      deliveryAddress,
      paymentMethod,
      totalAmount: finalAmount,
      promo: appliedPromo?._id || null,
    });

    res.status(201).json({
      message: appliedPromo
        ? `Promo "${appliedPromo.name}" appliquée !`
        : 'Commande créée sans promo',
      order,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// @desc    Get order history for a client
// @route   GET /api/orders/user/:id
// @access  Private (client)
exports.getOrdersByClient = async (req, res) => {
  try {
    const orders = await Order.find({ client: req.params.id })
      .populate('provider', 'name') // Populate provider name
      .sort({ createdAt: -1 });
    
    // Format the response to match frontend expectations
    const formattedOrders = orders.map(order => ({
      ...order.toObject(),
      provider: order.provider?.name || 'Restaurant', // fallback name
      deliveryAddress: order.deliveryAddress
        ? `${order.deliveryAddress.street || ''}, ${order.deliveryAddress.city || ''}`.replace(/, $/, '')
        : 'Adresse de livraison'
    }));
    
    res.json(formattedOrders);
  } catch (error) {
    console.error('Error in getOrdersByClient:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get orders assigned to a superAdmin
// @route   GET /api/orders/superadmin/:id
// @access  Private (superAdmin)
exports.getOrdersBySuperAdmin = async (req, res) => {
  try {
    const orders = await Order.find({ deliveryDriver: req.params.id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get available orders for superAdmins
// @route   GET /api/orders/superadmin/available
// @access  Private (superAdmin)
exports.getAvailableOrders = async (req, res) => {
  try {
    const availableOrders = await Order.find({ status: 'pending', deliveryDriver: null });
    res.json(availableOrders);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Assign an order to a superAdmin
// @route   PUT /api/orders/assign/:orderId
// @access  Private (superAdmin)
exports.assignOrder = async (req, res) => {
  const { orderId } = req.params;
  const { deliveryDriverId } = req.body;

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.status !== 'pending') {
      return res.status(400).json({ message: 'Order cannot be assigned in its current state' });
    }

    order.deliveryDriver = deliveryDriverId;
    order.status = 'accepted';
    await order.save();

    res.json({ message: 'Order assigned successfully', order });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private (client, superAdmin)
exports.updateOrderStatus = async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['in_delivery', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status provided' });
  }

  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.status = status;
    await order.save();
    res.json({ message: 'Order status updated successfully', order });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get summary of all orders (stats globales)
// @route   GET /api/orders/summary
// @access  Private (superAdmin)
exports.getOrdersSummary = async (req, res) => {
  try {
    // 1️⃣ Récupérer toutes les commandes
    const orders = await Order.find().populate('promo');

    // 2️⃣ Calculs
    const totalOrders = orders.length;
    const promoOrders = orders.filter(o => o.promo).length;
    const noPromoOrders = totalOrders - promoOrders;

    const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const promoRevenue = orders
      .filter(o => o.promo)
      .reduce((sum, o) => sum + o.totalAmount, 0);
    const normalRevenue = totalRevenue - promoRevenue;

    // 3️⃣ Détails par promo
    const promoStats = {};
    for (const order of orders) {
      if (order.promo) {
        const promoName = order.promo.name;
        if (!promoStats[promoName]) {
          promoStats[promoName] = { count: 0, total: 0 };
        }
        promoStats[promoName].count += 1;
        promoStats[promoName].total += order.totalAmount;
      }
    }

    // 4️⃣ Calcul des revenus via appFee
    const appFeeRevenue = await calculateAppFeeRevenue(orders);

    res.json({
      totalOrders,
      promoOrders,
      noPromoOrders,
      totalRevenue: totalRevenue.toFixed(2),
      promoRevenue: promoRevenue.toFixed(2),
      normalRevenue: normalRevenue.toFixed(2),
      appFeeRevenue: appFeeRevenue.toFixed(2),
      promoStats,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Fonction utilitaire interne
async function calculateAppFeeRevenue(orders) {
  let totalAppFee = 0;

  for (const order of orders) {
    if (order.promo && order.promo.overrideAppFee != null) {
      totalAppFee += order.promo.overrideAppFee;
    } else {
      // Charger appFee global une seule fois si besoin
      const { default: AppSetting } = await import('../models/AppSetting.js');
      const globalSetting = await AppSetting.findOne() || { appFee: 1.0 };
      totalAppFee += globalSetting.appFee;
    }
  }
  return totalAppFee;
}
