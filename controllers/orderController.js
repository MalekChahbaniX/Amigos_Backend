const Order = require('../models/Order');
const Provider = require('../models/Provider');
const Promo = require('../models/Promo');
const AppSetting = require('../models/AppSetting');
const Zone = require('../models/Zone');
const Product = require('../models/Product');
const { calculateDistance } = require('../utils/distanceCalculator');
// notifyNewOrder is now available globally from server.js

// @desc    Calculate order fees (delivery + app fee) before confirming
// @route   POST /api/orders/calculate-fees
// @access  Private (client)
exports.calculateOrderFees = async (req, res) => {
  const {
    provider: providerId,
    items,
    deliveryAddress, // { latitude, longitude }
    zoneId
  } = req.body;

  try {
    console.log('💰 Calculating order fees...');
    
    // 1. Fetch provider
    const providerData = await Provider.findById(providerId);
    if (!providerData) {
      return res.status(404).json({ message: 'Provider not found' });
    }

    // 2. Calculate delivery fee based on zone/distance
    let calculatedDeliveryFee = 0;
    let calculatedDistance = 0;
    let matchedZoneId = null;

    if (
      providerData.location && 
      providerData.location.latitude && 
      providerData.location.longitude &&
      deliveryAddress && 
      deliveryAddress.latitude && 
      deliveryAddress.longitude
    ) {
      calculatedDistance = calculateDistance(
        providerData.location.latitude,
        providerData.location.longitude,
        deliveryAddress.latitude,
        deliveryAddress.longitude
      );

      const zone = await Zone.findOne({
        minDistance: { $lte: calculatedDistance },
        maxDistance: { $gt: calculatedDistance }
      });

      if (zone) {
        calculatedDeliveryFee = zone.price;
        matchedZoneId = zone._id;
        console.log(`📍 Zone matched: ${zone.number}, fee: ${zone.price} TND`);
      } else {
        console.log('⚠️ No zone matched for distance:', calculatedDistance);
      }
    }

    // 3. Calculate product categories to determine app fee
    let hasRestaurant = false;
    let hasCourse = false;
    let hasPharmacy = false;
    let p2Total = 0;

    const productIds = items.map(item => item.productId || item.product).filter(Boolean);
    const products = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    for (const item of items) {
      const product = productMap.get((item.productId || item.product || '').toString());
      let p2;
      let deliveryCategory;

      if (product) {
        p2 = product.p2;
        deliveryCategory = product.deliveryCategory;
      } else {
        p2 = item.price || 0;
        deliveryCategory = providerData.type;
      }

      if (deliveryCategory === 'restaurant') hasRestaurant = true;
      if (deliveryCategory === 'course') hasCourse = true;
      if (deliveryCategory === 'pharmacy') hasPharmacy = true;
      if (deliveryCategory === 'store') hasPharmacy = true;

      p2Total += p2 * (item.quantity || 1);
    }

    // 4. Determine delivery category and get app fee
    let deliveryCategory = 'restaurant';
    if (hasCourse) deliveryCategory = 'course';
    else if (hasPharmacy) deliveryCategory = 'pharmacy';

    console.log(`🏷️ Delivery category determined: ${deliveryCategory}`);

    // Get app fee from database
    const appSetting = await AppSetting.findOne();
    console.log('📊 AppSetting from DB:', appSetting);

    let appFee = 0;
    if (appSetting && appSetting.appFee !== undefined) {
      appFee = appSetting.appFee;
      console.log(`✅ Using appFee from DB: ${appFee} TND`);
    } else {
      // Fallback to defaults if no setting exists
      appFee = (deliveryCategory === 'restaurant' ? 0 : 1.5);
      console.log(`⚠️ No AppSetting in DB, using default: ${appFee} TND for category ${deliveryCategory}`);
    }

    // 5. Return fees
    res.status(200).json({
      success: true,
      deliveryFee: calculatedDeliveryFee,
      appFee: appFee,
      distance: calculatedDistance,
      zoneId: matchedZoneId,
      deliveryCategory: deliveryCategory,
      p2Total: p2Total,
      totalFees: calculatedDeliveryFee + appFee,
      total: p2Total + calculatedDeliveryFee + appFee
    });

  } catch (error) {
    console.error('Error calculating fees:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating order fees',
      error: error.message
    });
  }
};

// @desc    Create a new order with complete pricing logic
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

  const {
    client,
    provider,
    items,
    deliveryAddress, // Doit contenir { latitude, longitude }
    paymentMethod,
    totalAmount,
    deliveryFee: clientProvidedDeliveryFee, // On le renomme pour éviter la confusion
    subtotal,
    cardInfo,
    zoneId
  } = req.body;

  try {
    // 1. Charger provider
    console.log('🔍 Fetching provider:', provider);
    const providerData = await Provider.findById(provider);

    if (!providerData) {
      console.log('❌ Provider not found:', provider);
      return res.status(404).json({ message: 'Provider not found' });
    }

    // --- LOGIQUE DE CALCUL DE DISTANCE ET ZONE ---
    let calculatedDeliveryFee = 0;
    let calculatedDistance = 0;
    let matchedZoneId = zoneId; // Si déjà fourni

    // Vérifier si on a les coordonnées pour calculer
    if (
        providerData.location && 
        providerData.location.latitude && 
        providerData.location.longitude &&
        deliveryAddress && 
        deliveryAddress.latitude && 
        deliveryAddress.longitude
    ) {
        console.log('📏 Calculating precise distance server-side...');
        
        calculatedDistance = calculateDistance(
            providerData.location.latitude,
            providerData.location.longitude,
            deliveryAddress.latitude,
            deliveryAddress.longitude
        );

        console.log(`📏 Distance calculated: ${calculatedDistance.toFixed(3)} km`);

        // Trouver la zone correspondante
        const zone = await Zone.findOne({
            minDistance: { $lte: calculatedDistance },
            maxDistance: { $gt: calculatedDistance } // Strictement supérieur
        });

        if (zone) {
            calculatedDeliveryFee = zone.price;
            matchedZoneId = zone._id;
            console.log(`📍 Matched Zone ${zone.number}: price = ${zone.price} TND`);
        } else {
            console.log('⚠️ No zone matched for this distance');
            // Optionnel : Rejeter la commande si hors zone
            // return res.status(400).json({ message: "Adresse hors zone de livraison" });
            
            // Ou fallback sur une valeur par défaut / valeur envoyée par le client
            calculatedDeliveryFee = clientProvidedDeliveryFee || 0;
        }
    } else {
        console.log('⚠️ Missing GPS coordinates for calculation. Using provided deliveryFee or 0.');
        // Fallback si pas de coordonnées (ex: anciennes adresses)
        calculatedDeliveryFee = clientProvidedDeliveryFee || 0;
    }
    // ---------------------------------------------

    // 2. Charger les produits
    console.log('🛒 Loading products for pricing...');
    const productIds = items.map(item => item.product).filter(Boolean);
    const products = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    // 3. Calculer les totaux P1, P2 et vérifier les catégories
    console.log('💰 Calculating pricing with commissions...');
    let p1Total = 0;
    let p2Total = 0;
    let hasRestaurant = false;
    let hasCourse = false;
    let hasPharmacy = false;
    let hasStore = false;
    const formattedItems = [];

    for (const item of items) {
      const product = productMap.get(item.product?.toString() || item.productId?.toString());
      let P1, P2, deliveryCategory;

      if (product) {
        P1 = product.p1;
        P2 = product.p2;
        deliveryCategory = product.deliveryCategory;

        if (deliveryCategory === 'restaurant') hasRestaurant = true;
        if (deliveryCategory === 'course') hasCourse = true;
        if (deliveryCategory === 'pharmacy') hasPharmacy = true;
        if (deliveryCategory === 'store') hasStore = true;
      } else {
        const P = item.price || 0;
        const csR = (providerData.csRPercent || 5) / 100;
        const csC = (providerData.csCPercent || 0) / 100;
        P1 = P * (1 - csR);
        P2 = P * (1 + csC);
        deliveryCategory = providerData.type;
      }

      const qty = item.quantity || 1;
      p1Total += P1 * qty;
      p2Total += P2 * qty;

      formattedItems.push({
        product: item.product || item.productId || null,
        name: item.name,
        price: item.price,
        quantity: qty,
        p1: P1,
        p2: P2,
        deliveryCategory: deliveryCategory,
      });
    }

    // 4. Déterminer la catégorie de livraison
    let deliveryCategory = 'restaurant';
    if (hasCourse) deliveryCategory = 'course';
    else if (hasPharmacy) deliveryCategory = 'pharmacy';
    else if (hasStore) deliveryCategory = 'store';

    // 5. Utiliser les frais calculés
    const finalDeliveryFee = calculatedDeliveryFee;

    // 6. Charger les frais application
    console.log('💳 Loading app fees from database...');
    const appSetting = await AppSetting.findOne();
    console.log('📊 AppSetting from DB:', appSetting);
    
    let appFee = 0;
    if (appSetting && appSetting.appFee !== undefined) {
      appFee = appSetting.appFee;
      console.log(`✅ Using appFee from DB: ${appFee} TND`);
    } else {
      // Fallback to defaults if no setting exists
      appFee = (deliveryCategory === 'restaurant' ? 0 : 1.5);
      console.log(`⚠️ No AppSetting in DB, using default: ${appFee} TND for category ${deliveryCategory}`);
    }

    // 7. Calculer le montant final
    const finalAmount = p2Total + finalDeliveryFee + appFee;
    console.log(`💰 Final amount details: Products(${p2Total}) + Delivery(${finalDeliveryFee}) + AppFee(${appFee}) = ${finalAmount}`);

    // 8. Vérifier promo
    console.log('🎁 Checking for active promo...');
    const promo = await Promo.findOne({ status: 'active' });
    let appliedPromo = null;
    let promoDiscount = 0;

    if (
      promo &&
      promo.targetServices.includes(deliveryCategory) &&
      promo.ordersUsed < promo.maxOrders &&
      finalAmount <= promo.maxAmount
    ) {
      appliedPromo = promo;
      promoDiscount = promo.discountAmount || 0;
      console.log(`✅ Promo "${promo.name}" applied! Discount: ${promoDiscount}`);
      
      promo.ordersUsed += 1;
      await promo.save();
    }

    const totalAmountAfterPromo = Math.max(0, finalAmount - promoDiscount);

    // 10. Valider le montant total (Tolérance de 0.1 pour les arrondis)
    if (Math.abs(totalAmount - totalAmountAfterPromo) > 0.1) {
      console.log(`❌ Total mismatch: submitted=${totalAmount}, expected=${totalAmountAfterPromo}`);
      // Optionnel : Rejeter ou Forcer le montant calculé (ici on log juste pour debug, mais en prod il vaut mieux rejeter ou corriger)
      // return res.status(400).json({ ... });
    }

    // 11. Calculer le solde plateforme
    const platformSolde = (p2Total - p1Total) + finalDeliveryFee + appFee - promoDiscount;

    // 12. Créer la commande
    const orderData = {
      client,
      provider,
      items: formattedItems,
      deliveryAddress,
      paymentMethod: paymentMethod === 'card' ? 'online' : paymentMethod,
      totalAmount: totalAmountAfterPromo, // On utilise le montant calculé par sécurité
      clientProductsPrice: p2Total,
      restaurantPayout: p1Total,
      deliveryFee: finalDeliveryFee,
      appFee,
      platformSolde,
      p1Total,
      p2Total,
      // solde fields (to be calculated by balanceCalculator)
      soldeSimple: 0,
      soldeDual: 0,
      soldeTriple: 0,
      soldeAmigos: 0,
      finalAmount: totalAmountAfterPromo,
      status: 'pending',
      zone: matchedZoneId || null,
      distance: calculatedDistance || null,
      appliedPromo: appliedPromo ? appliedPromo._id : null,
      promo: appliedPromo ? appliedPromo._id : null,
      cardInfo: cardInfo || undefined,
      subtotal: subtotal || p2Total,
    };

    // Compute soldeSimple and soldeAmigos using balanceCalculator
    try {
      const balanceCalc = require('../services/balanceCalculator');
      orderData.soldeSimple = balanceCalc.calculateSoldeSimple({ clientProductsPrice: p2Total, restaurantPayout: p1Total });
      // For a single order, soldeDual/Triple default to 0; soldeAmigos includes appFee
      orderData.soldeAmigos = balanceCalc.calculateSoldeAmigos([ { clientProductsPrice: p2Total, restaurantPayout: p1Total } ], appFee);
    } catch (calcErr) {
      console.error('Erreur calcul solde:', calcErr);
    }

    // PROTECTION WINDOW: Set protectionEnd = createdAt + 3 minutes (180 seconds = 180000ms)
    const protectionDurationMs = 3 * 60 * 1000; // 3 minutes
    const protectionEndTime = new Date(Date.now() + protectionDurationMs);
    orderData.protectionEnd = protectionEndTime;

    // Prepare delay variables in outer scope to avoid ReferenceError
    let delayMinutes = null;
    let scheduledForTime = null;

    // Normalize urgent flag from possible client representations
    const urgentFlag = req.body.urgent === true || req.body.urgent === 'true' || req.body.urgent === 1 || req.body.urgent === '1';
    const isUrgent = req.body.orderType === 'A4' || urgentFlag;

    if (isUrgent) {
      // A4 orders bypass delays and are never grouped
      orderData.orderType = 'A4';
      orderData.processingDelay = 0;
      orderData.scheduledFor = null;
      orderData.isUrgent = true;
      orderData.canBeGrouped = false; // Explicitly mark as non-groupable
      console.log('🔥 Marking order as URGENT (A4) - bypassing processing delay and excluded from grouping');
    } else {
      // Set processing delay (5-10 minutes) for grouping eligibility
      delayMinutes = Math.floor(Math.random() * 6) + 5; // Random between 5-10
      scheduledForTime = new Date(Date.now() + delayMinutes * 60 * 1000); // Add delay to current time
      orderData.processingDelay = delayMinutes;
      orderData.scheduledFor = scheduledForTime;
      orderData.canBeGrouped = true;

      console.log('💾 Creating order with processing delay of', delayMinutes, 'minutes, scheduled for', scheduledForTime.toISOString());
    }
    const createdOrder = await Order.create(orderData);

    // Notify deliverers about new order. Urgent orders are notified immediately.
    try {
      if (createdOrder.isUrgent) {
        // Send immediate notification for urgent orders
        try {
          await global.notifyNewOrder(createdOrder);
          console.log('📢 Immediate URGENT notification sent for order', createdOrder._id);
        } catch (err) {
          console.error('❌ Immediate URGENT notification failed for order', createdOrder._id, err);
        }
      } else {
        const notifyDelayMs = Math.max(0, new Date(createdOrder.scheduledFor).getTime() - Date.now());
        if (notifyDelayMs > 0) {
          console.log(`⏳ Scheduling deliverer notification in ${Math.round(notifyDelayMs/1000)}s`);
          setTimeout(async () => {
            try {
              await global.notifyNewOrder(createdOrder);
              console.log('📢 Delayed notification sent for order', createdOrder._id);
            } catch (err) {
              console.error('❌ Delayed notification failed for order', createdOrder._id, err);
            }
          }, notifyDelayMs);
        } else {
          await global.notifyNewOrder(createdOrder);
          console.log('📢 Notification sent for order', createdOrder._id);
        }
      }
    } catch (notificationError) {
      console.error('❌ Failed to schedule/send notification:', notificationError);
    }

    res.status(201).json({
      message: appliedPromo ? `Promo "${appliedPromo.name}" appliquée !` : 'Commande créée avec succès',
      order: {
        ...createdOrder.toObject(),
        promoName: appliedPromo ? appliedPromo.name : null,
        promoDiscount: promoDiscount,
        breakdown: {
          products: p2Total,
          delivery: finalDeliveryFee,
          appFee: appFee,
          promoDiscount: promoDiscount,
          total: totalAmountAfterPromo
        }
      }
    });

  } catch (error) {
    console.error('❌ Error creating order:', error);
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
    const now = new Date();
    // Prioritize urgent orders by sorting on `isUrgent` first, then newest
    const availableOrders = await Order.find({
      status: 'pending',
      deliveryDriver: null,
      $or: [ { scheduledFor: null }, { scheduledFor: { $lte: now } } ]
    })
      .populate('client', 'firstName lastName phoneNumber location')
      .populate('provider', 'name type phone address')
      .sort({ isUrgent: -1, createdAt: -1 });
    
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
      urgent: !!order.isUrgent,
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
    // Use findOneAndUpdate with atomic operation to prevent race conditions
    const order = await Order.findOneAndUpdate(
      {
        _id: orderId,
        status: 'pending',
        deliveryDriver: { $exists: false }
      },
      {
        deliveryDriver: deliveryDriverId,
        status: 'accepted',
        assignedAt: new Date()
      },
      { new: true }
    )
    .populate('client', 'firstName lastName phoneNumber location')
    .populate('provider', 'name type phone address');
    
    if (!order) {
      return res.status(400).json({
        message: 'La commande ne peut pas être assignée (soit déjà assignée, soit non trouvée)'
      });
    }

    console.log(`✅ Order ${orderId} assigned to deliverer ${deliveryDriverId}`);

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
          montantRestaurant: formattedOrder.restaurantPayout,
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

    // PROTECTION WINDOW: Prevent cancellation during protection period (first 3 minutes)
    if (status === 'cancelled' && order.status === 'pending') {
      const now = Date.now();
      if (order.protectionEnd && new Date(order.protectionEnd).getTime() > now) {
        const remainingMs = new Date(order.protectionEnd).getTime() - now;
        const remainingSec = Math.ceil(remainingMs / 1000);
        return res.status(403).json({ 
          message: `Order is protected from cancellation. Please wait ${remainingSec} seconds.`,
          protectionEnd: order.protectionEnd,
          remainingSeconds: remainingSec
        });
      }
    }

    order.status = status;
    await order.save();

    // If delivered, compute solde fields (use shared helper)
    if (status === 'delivered') {
      try {
        const balanceCalc = require('../services/balanceCalculator');
        await balanceCalc.updateOrderSoldes(order);
      } catch (calcErr) {
        console.error('Error calculating solde on status update:', calcErr);
      }
    }

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
    // 1. Récupérer toutes les commandes
    const orders = await Order.find().populate('promo');

    // 2. Calculs de base
    const totalOrders = orders.length;
    const promoOrders = orders.filter(o => o.promo).length;
    const noPromoOrders = totalOrders - promoOrders;

    const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const promoRevenue = orders
      .filter(o => o.promo)
      .reduce((sum, o) => sum + o.totalAmount, 0);
    const normalRevenue = totalRevenue - promoRevenue;

    // 3. Détails par catégorie
    const categoryStats = {
      restaurant: { count: 0, revenue: 0, solde: 0 },
      course: { count: 0, revenue: 0, solde: 0 },
      pharmacy: { count: 0, revenue: 0, solde: 0 }
    };

    for (const order of orders) {
      const category = order.items[0]?.deliveryCategory || 'restaurant';
      categoryStats[category].count += 1;
      categoryStats[category].revenue += order.totalAmount;
      categoryStats[category].solde += order.platformSolde || 0;
    }

    // 4. Détails par promo
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

    // 5. Calcul des revenus via appFee et deliveryFee
    const appFeeRevenue = orders.reduce((sum, o) => sum + (o.appFee || 0), 0);
    const deliveryFeeRevenue = orders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
    const platformTotalSolde = orders.reduce((sum, o) => sum + (o.platformSolde || 0), 0);

    res.json({
      totalOrders,
      promoOrders,
      noPromoOrders,
      totalRevenue: totalRevenue.toFixed(3),
      promoRevenue: promoRevenue.toFixed(3),
      normalRevenue: normalRevenue.toFixed(3),
      appFeeRevenue: appFeeRevenue.toFixed(3),
      deliveryFeeRevenue: deliveryFeeRevenue.toFixed(3),
      platformTotalSolde: platformTotalSolde.toFixed(3),
      categoryStats,
      promoStats,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
