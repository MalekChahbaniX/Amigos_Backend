const Order = require('../models/Order');
const Provider = require('../models/Provider');
const Promo = require('../models/Promo');
const AppSetting = require('../models/AppSetting');

// @desc    Create a new order
// @route   POST /api/orders
// @access  Private (client)
exports.createOrder = async (req, res) => {
  console.log('📥 Incoming order request:', {
    client: req.body.client,
    provider: req.body.provider,
    paymentMethod: req.body.paymentMethod,
    totalAmount: req.body.totalAmount,
    itemsCount: req.body.items?.length || 0,
  });

  const { client, provider, items, deliveryAddress, paymentMethod, totalAmount, deliveryFee, subtotal, cardInfo } = req.body;

  try {
    // 🧠 2. Charger provider (pour connaître son type : restaurant, course, etc.)
    console.log('🔍 Fetching provider:', provider);
    const providerData = await Provider.findById(provider);
    if (!providerData) {
      console.log('❌ Provider not found:', provider);
      return res.status(404).json({ message: 'Provider not found' });
    }
    console.log('✅ Provider loaded:', { id: providerData._id, name: providerData.name, type: providerData.type, csR: providerData.csRPercent, csC: providerData.csCPercent });

    // 🧠 Calculer les sous-totaux P1 (restaurant) et P2 (client) selon commissions
    console.log('💰 Calculating pricing with commissions...');
    let clientSubtotal = 0;
    let restaurantSubtotal = 0;
    const csR = (providerData.csRPercent || 5) / 100; // default 5%
    const csC = (providerData.csCPercent || 0) / 100; // default 0%
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ message: 'Invalid or missing items array' });
    }
    for (const item of items) {
      const P = item.price || 0;
      const qty = item.quantity || 1;
      const P1 = P * (1 - csR); // restaurant payout
      const P2 = P * (1 + csC); // client price
      clientSubtotal += P2 * qty;
      restaurantSubtotal += P1 * qty;
      console.log(`Item ${item.name || 'unknown'}: P=${P}, qty=${qty}, P1=${P1}, P2=${P2}`);
    }
    console.log(`🧮 Subtotals: client=${clientSubtotal}, restaurant=${restaurantSubtotal}`);

    // ✅ Valider que le total soumis correspond au sous-total client (tolérance 0.01)
    if (Math.abs(totalAmount - clientSubtotal) > 0.01) {
      console.log(`❌ Total mismatch: submitted=${totalAmount}, expected=${clientSubtotal}`);
      return res.status(400).json({ message: 'Total amount does not match calculated client subtotal' });
    }

    // 🧠 3. Vérifier promo active applicable
    console.log('🎁 Checking for active promo...');
    const promo = await Promo.findOne({ status: 'active' });
    console.log('Promo found:', promo ? { id: promo._id, name: promo.name, maxOrders: promo.maxOrders, ordersUsed: promo.ordersUsed } : 'None');

    let finalAmount = totalAmount;
    let appliedPromo = null;

    if (
      promo &&
      promo.targetServices.includes(providerData.type) &&
      promo.ordersUsed < promo.maxOrders &&
      totalAmount <= promo.maxAmount
    ) {
      // ✅ Promo applicable
      const appliedAppFee = promo.overrideAppFee ?? (providerData.type === 'restaurant' ? 0 : 1.5);
      finalAmount = appliedAppFee; // le client paie juste les frais app
      appliedPromo = promo;

      // Incrémenter le compteur promo
      promo.ordersUsed += 1;
      await promo.save();
    } else {
      // ❌ Pas de promo → montant normal + frais app (category-dependent)
      const categoryAppFee = providerData.type === 'restaurant' ? 0 : 1.5;
      finalAmount = totalAmount + categoryAppFee;
      console.log('❌ No promo applied, final amount:', finalAmount, 'appFee:', categoryAppFee);
    }

    // 🧠 4. Créer la commande avec les champs solde et prix détaillés
    const orderData = new Order({
      client,
      provider,
      items,
      deliveryAddress,
      paymentMethod,
      deliveryFee: deliveryFee || 0,
      subtotal: subtotal || clientSubtotal,
      totalAmount,
      clientProductsPrice: clientSubtotal,
      restaurantPayout: restaurantSubtotal,
      appFee: providerData.type === 'restaurant' ? 0 : 1.5,
      platformSolde: clientSubtotal - restaurantSubtotal + (deliveryFee || 0) + (providerData.type === 'restaurant' ? 0 : 1.5),
      status: 'pending',
      finalAmount,
      appliedPromo: appliedPromo ? appliedPromo._id : null,
    });
    console.log('📦 Order created with solde:', orderData.platformSolde);

    // Sauvegarder
    await orderData.save();
    await orderData.populate('provider');
    console.log('✅ Order saved and populated');

    // 🧠 5. Traiter l'adresse de livraison
    console.log('📍 Processing delivery address:', deliveryAddress);
    let formattedDeliveryAddress = {};
    if (typeof deliveryAddress === 'string') {
      // Convertir l'adresse string en objet
      formattedDeliveryAddress = {
        street: deliveryAddress,
        city: '', // À compléter si besoin
        zipCode: '', // À compléter si besoin
      };
    } else if (typeof deliveryAddress === 'object') {
      formattedDeliveryAddress = deliveryAddress;
    }
    console.log('📍 Formatted address:', formattedDeliveryAddress);

    // 🧠 5. Traiter les items
    const formattedItems = items.map(item => ({
      product: item.productId || item.product || null, // Convertir productId en product
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    }));

    // 🧠 6. Convertir la méthode de paiement
    console.log('💳 Original payment method:', paymentMethod);
    let formattedPaymentMethod = paymentMethod;
    if (paymentMethod === 'card') {
      formattedPaymentMethod = 'online';
    }
    console.log('💳 Formatted payment method:', formattedPaymentMethod);

    // 🧠 7. Créer la commande
    const orderToCreate = {
      client,
      provider,
      items: formattedItems,
      deliveryAddress: formattedDeliveryAddress,
      paymentMethod: formattedPaymentMethod,
      totalAmount: finalAmount,
      promo: appliedPromo?._id || null,
      // Champs optionnels pour la compatibilité frontend
      deliveryFee: deliveryFee || 0,
      subtotal: subtotal || 0,
      cardInfo: cardInfo || undefined,
      // Calculer platformSolde pour éviter les erreurs undefined
      platformSolde: clientSubtotal - restaurantSubtotal + (deliveryFee || 0) + (providerData.type === 'restaurant' ? 0 : 1.5),
    };
    console.log('💾 Creating order with data:', orderToCreate);

    const createdOrder = await Order.create(orderToCreate);
    console.log('✅ Order created successfully:', { id: createdOrder._id, status: createdOrder.status, paymentMethod: createdOrder.paymentMethod });

    res.status(201).json({
      message: appliedPromo
        ? `Promo "${appliedPromo.name}" appliquée !`
        : 'Commande créée sans promo',
      orderData,
    });
  } catch (error) {
    console.error('❌ Error creating order:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
    });
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

// @desc    Get available orders for superAdmins (livreurs)
// @route   GET /api/orders/superadmin/available
// @access  Private (superAdmin)
exports.getAvailableOrders = async (req, res) => {
  try {
    const availableOrders = await Order.find({ status: 'pending', deliveryDriver: null })
      .populate('client', 'firstName lastName phoneNumber location')
      .populate('provider', 'name type phone address')
      .sort({ createdAt: -1 });
    
    // Format available orders with detailed information for livreurs
    const formattedOrders = availableOrders.map(order => ({
      id: order._id,
      orderNumber: `CMD-${order._id.toString().slice(-6).toUpperCase()}`,
      client: {
        id: order.client._id,
        name: `${order.client.firstName} ${order.client.lastName}`,
        phone: order.client.phoneNumber,
        location: order.client.location || {},
      },
      provider: {
        id: order.provider._id,
        name: order.provider.name,
        type: order.provider.type,
        phone: order.provider.phone,
        address: order.provider.address,
      },
      items: order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
      total: order.totalAmount,
      solde: order.platformSolde ? order.platformSolde.toFixed(3) : '0.000',
      status: order.status,
      deliveryAddress: order.deliveryAddress,
      paymentMethod: order.paymentMethod,
      finalAmount: order.finalAmount,
      createdAt: order.createdAt,
      platformSolde: order.platformSolde,
    }));
    
    res.json(formattedOrders);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Assign an order to a superAdmin (livreur)
// @route   PUT /api/orders/assign/:orderId
// @access  Private (superAdmin)
exports.assignOrder = async (req, res) => {
  const { orderId } = req.params;
  const { deliveryDriverId } = req.body;

  try {
    const order = await Order.findById(orderId)
      .populate('client', 'firstName lastName phoneNumber location')
      .populate('provider', 'name type phone address');
    
    if (!order) {
      return res.status(404).json({ message: 'Commande non trouvée' });
    }
    if (order.status !== 'pending') {
      return res.status(400).json({ message: 'La commande ne peut pas être assignée dans son état actuel' });
    }

    order.deliveryDriver = deliveryDriverId;
    order.status = 'accepted';
    await order.save();

    // Return complete order details for the livreur
    const formattedOrder = {
      id: order._id,
      orderNumber: `CMD-${order._id.toString().slice(-6).toUpperCase()}`,
      client: {
        id: order.client._id,
        name: `${order.client.firstName} ${order.client.lastName}`,
        phone: order.client.phoneNumber,
        location: order.client.location || {},
      },
      provider: {
        id: order.provider._id,
        name: order.provider.name,
        type: order.provider.type,
        phone: order.provider.phone,
        address: order.provider.address,
      },
      items: order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
      total: order.totalAmount,
      solde: order.platformSolde ? order.platformSolde.toFixed(3) : '0.000',
      status: order.status,
      deliveryAddress: order.deliveryAddress,
      paymentMethod: order.paymentMethod,
      finalAmount: order.finalAmount,
      createdAt: order.createdAt,
      platformSolde: order.platformSolde,
    };

    res.json({
      message: 'Commande assignée avec succès',
      order: formattedOrder,
      livraison: {
        clientContact: {
          nom: formattedOrder.client.name,
          telephone: formattedOrder.client.phone,
          adresse: formattedOrder.deliveryAddress,
          coordonnees: formattedOrder.client.location
        },
        restaurantContact: {
          nom: formattedOrder.provider.name,
          telephone: formattedOrder.provider.phone,
          adresse: formattedOrder.provider.address
        },
        details: {
          montantClient: formattedOrder.finalAmount,
          montantRestaurant: (formattedOrder.total * (1 - (formattedOrder.provider.csRPercent || 5) / 100)).toFixed(3),
          soldePlateforme: formattedOrder.solde
        }
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
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
      // Use category-dependent appFee
      const provider = await Provider.findById(order.provider);
      const categoryAppFee = provider && provider.type === 'restaurant' ? 0 : 1.5;
      totalAppFee += categoryAppFee;
    }
  }
  return totalAppFee;
}
