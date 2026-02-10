const Order = require('../models/Order');
const Provider = require('../models/Provider');
const Promo = require('../models/Promo');
const AppSetting = require('../models/AppSetting');
const Zone = require('../models/Zone');
const Product = require('../models/Product');
const User = require('../models/User');
const { calculateDistance } = require('../utils/distanceCalculator');
const cancellationService = require('../services/cancellationService');
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
        calculatedDeliveryFee = zone.isPromoActive && zone.promoPrice !== null 
          ? zone.promoPrice 
          : zone.price;
        matchedZoneId = zone._id;
        console.log(`📍 Zone matched: ${zone.number}, fee: ${calculatedDeliveryFee} TND ${zone.isPromoActive ? '(PROMO)' : ''}`);
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

// @desc    Create a new order with complete pricing logic (multi-provider support)
// @route   POST /api/orders
// @access  Private (client)
exports.createOrder = async (req, res) => {
  console.log('📥 Incoming order request:', {
    client: req.body.client,
    provider: req.body.provider,
    providers: req.body.providers,
    paymentMethod: req.body.paymentMethod,
    totalAmount: req.body.totalAmount,
    itemsCount: req.body.items?.length || 0,
  });

  const {
    client,
    provider,
    providers: providersArray,
    items,
    deliveryAddress, // Doit contenir { latitude, longitude }
    paymentMethod,
    totalAmount,
    deliveryFee: clientProvidedDeliveryFee, // On le renomme pour éviter la confusion
    subtotal,
    cardInfo,
    zoneId,
    prescription
  } = req.body;
  
  // Support both legacy provider and new providers array
  const providersToProcess = providersArray && Array.isArray(providersArray) && providersArray.length > 0 
    ? providersArray 
    : (provider ? [provider] : []);

  try {
    // Validate providers
    if (providersToProcess.length < 1 || providersToProcess.length > 2) {
      console.log('❌ Invalid providers count:', providersToProcess.length);
      return res.status(400).json({ 
        message: 'Une commande doit contenir entre 1 et 2 prestataires',
        providersCount: providersToProcess.length 
      });
    }

    // CHECK CLIENT BLOCKING STATUS
    const clientData = await User.findById(client);
    if (!clientData) {
      console.log('❌ Client not found:', client);
      return res.status(404).json({ message: 'Client not found' });
    }

    if (clientData.isBlocked) {
      console.log(`🚷 Blocked client ${client} attempted to create order`);
      return res.status(403).json({
        success: false,
        message: 'Votre compte a été bloqué',
        blockedReason: clientData.blockedReason || 'Vous n\'êtes pas autorisé à passer de commandes'
      });
    }

    // 0. Validate prescription if provided
    let validatedPrescription = null;
    if (prescription) {
      if (!['photo', 'text', 'none'].includes(prescription.type)) {
        return res.status(400).json({ message: 'Invalid prescription type' });
      }
      
      if (prescription.type === 'photo' && !prescription.imageUrl) {
        return res.status(400).json({ message: 'Photo prescription requires imageUrl' });
      }
      
      if (prescription.type === 'text' && !prescription.textContent) {
        return res.status(400).json({ message: 'Text prescription requires textContent' });
      }
      
      validatedPrescription = {
        type: prescription.type,
        imageUrl: prescription.imageUrl || undefined,
        textContent: prescription.textContent || undefined,
        fileName: prescription.fileName,
        fileSize: prescription.fileSize,
        uploadedAt: prescription.uploadedAt || new Date()
      };
    }

    // COMMENT 2-3: Multi-Provider Support - Group items by providerId and calculate per-provider fees
    // ========================================================================================

    // 1. Charger les providers (plural support)
    console.log('🔍 Fetching providers:', providersToProcess);
    const providersData = await Provider.find({ _id: { $in: providersToProcess } });

    if (providersData.length === 0) {
      console.log('❌ No providers found');
      return res.status(404).json({ message: 'Aucun prestataire trouvé' });
    }

    const providerMap = new Map(providersData.map(p => [p._id.toString(), p]));

    // 2. Charger les produits
    console.log('🛒 Loading products for pricing...');
    const productIds = items.map(item => item.product || item.productId).filter(Boolean);
    const products = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    // 3. Group items by providerId (COMMENT 2)
    console.log('🔀 Grouping items by providerId...');
    const itemsByProvider = {};
    providersToProcess.forEach(pid => {
      itemsByProvider[pid.toString()] = [];
    });

    for (const item of items) {
      let providerId = item.providerId?.toString();
      
      // If item has no providerId and we have only one provider, assign it
      if (!providerId && providersToProcess.length === 1) {
        providerId = providersToProcess[0].toString();
        console.log(`🔧 Assigning providerId ${providerId} to item without providerId:`, item.name || item.productId);
      }
      
      if (!providerId || !itemsByProvider[providerId]) {
        console.warn('⚠️ Item has no valid providerId:', item);
        continue;
      }
      itemsByProvider[providerId].push(item);
    }

    // 4. Process each provider separately for fees calculation
    console.log('💰 Calculating fees per provider...');
    let p1Total = 0;
    let p2Total = 0;
    let totalDeliveryFee = 0;
    let totalAppFee = 0;
    const providerFees = []; // Array to store per-provider fee breakdown
    const formattedItems = [];
    const deliveryCategories = new Set();

    const appSetting = await AppSetting.findOne();
    console.log('📊 AppSetting from DB:', appSetting);

    // For each provider, calculate delivery fee and app fee
    for (const providerId of providersToProcess) {
      const providerIdStr = providerId.toString();
      const providerData = providerMap.get(providerIdStr);
      const providerItems = itemsByProvider[providerIdStr] || [];

      if (!providerData || providerItems.length === 0) {
        continue;
      }

      console.log(`\n📦 Processing Provider ${providerIdStr}:`);

      // --- Distance & Zone Calculation per Provider ---
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
        console.log('📏 Calculating precise distance server-side...');
        
        calculatedDistance = calculateDistance(
          providerData.location.latitude,
          providerData.location.longitude,
          deliveryAddress.latitude,
          deliveryAddress.longitude
        );

        console.log(`📏 Distance calculated: ${calculatedDistance.toFixed(3)} km`);

        const zone = await Zone.findOne({
          minDistance: { $lte: calculatedDistance },
          maxDistance: { $gt: calculatedDistance }
        });

        if (zone) {
          calculatedDeliveryFee = zone.isPromoActive && zone.promoPrice !== null 
            ? zone.promoPrice 
            : zone.price;
          matchedZoneId = zone._id;
          console.log(`📍 Provider ${providerIdStr} - Zone matched: ${zone.number}, fee: ${calculatedDeliveryFee} TND ${zone.isPromoActive ? '(PROMO)' : ''}`);
        } else {
          console.log('⚠️ No zone matched for this distance');
          calculatedDeliveryFee = clientProvidedDeliveryFee || 0;
        }
      } else {
        console.log('⚠️ Missing GPS coordinates for calculation. Using provided deliveryFee or 0.');
        calculatedDeliveryFee = clientProvidedDeliveryFee || 0;
      }

      // --- App Fee per Provider ---
      let providerAppFee = 0;
      let providerDeliveryCategory = providerData.type || 'restaurant';

      if (appSetting && appSetting.appFee !== undefined) {
        providerAppFee = appSetting.appFee;
        console.log(`✅ Using appFee from DB: ${providerAppFee} TND`);
      } else {
        providerAppFee = (providerDeliveryCategory === 'restaurant' ? 0 : 1.5);
        console.log(`⚠️ No AppSetting in DB, using default: ${providerAppFee} TND`);
      }

      // --- Process items for this provider ---
      let providerP1 = 0;
      let providerP2 = 0;

      for (const item of providerItems) {
        const product = productMap.get(item.product?.toString() || item.productId?.toString());
        let P1, P2, deliveryCategory;

        if (product) {
          P1 = product.p1;
          P2 = product.p2;
          deliveryCategory = product.deliveryCategory;
        } else {
          const P = item.price || 0;
          const csR = (providerData.csRPercent || 5) / 100;
          const csC = (providerData.csCPercent || 0) / 100;
          P1 = P * (1 - csR);
          P2 = P * (1 + csC);
          deliveryCategory = providerData.type;
        }

        const qty = item.quantity || 1;
        providerP1 += P1 * qty;
        providerP2 += P2 * qty;
        p1Total += P1 * qty;
        p2Total += P2 * qty;
        deliveryCategories.add(deliveryCategory);

        // COMMENT 3: Include providerId in formattedItems
        formattedItems.push({
          product: item.product || item.productId || null,
          name: item.name,
          price: item.price,
          quantity: qty,
          p1: P1,
          p2: P2,
          deliveryCategory: deliveryCategory,
          providerId: providerId, // ← COMMENT 3: Add providerId to match Order schema
        });
      }

      // Store per-provider fees
      totalDeliveryFee += calculatedDeliveryFee;
      totalAppFee += providerAppFee;

      providerFees.push({
        providerId: providerId,
        deliveryFee: calculatedDeliveryFee,
        appFee: providerAppFee,
        p1Total: providerP1,
        p2Total: providerP2,
      });

      console.log(`✅ Provider summary: P1=${providerP1}, P2=${providerP2}, DeliveryFee=${calculatedDeliveryFee}, AppFee=${providerAppFee}`);
    }

    // 5. Determine delivery category based on all items
    let finalDeliveryCategory = 'restaurant';
    if (deliveryCategories.has('course')) finalDeliveryCategory = 'course';
    else if (deliveryCategories.has('pharmacy')) finalDeliveryCategory = 'pharmacy';
    else if (deliveryCategories.has('store')) finalDeliveryCategory = 'store';

    // 6. Calculate final amount (COMMENT 7: Use summed per-provider fees, don't overwrite)
    const finalAmount = p2Total + totalDeliveryFee + totalAppFee;
    console.log(`💰 Final amount details: Products(${p2Total}) + Delivery(${totalDeliveryFee}) + AppFee(${totalAppFee}) = ${finalAmount}`);

    // 7. Check for promo
    console.log('🎁 Checking for active promo...');
    const promo = await Promo.findOne({ status: 'active' });
    let appliedPromo = null;
    let promoDiscount = 0;

    if (
      promo &&
      promo.targetServices.includes(finalDeliveryCategory) &&
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

    // 8. Validate total amount (tolerance of 2 TND for app fee differences)
    if (Math.abs(totalAmount - totalAmountAfterPromo) > 2) {
      console.log(`❌ Total mismatch: submitted=${totalAmount}, expected=${totalAmountAfterPromo}`);
      // Use backend calculated amount if difference is too large
      // For small differences (like missing app fee), we'll use the backend amount
    } else if (Math.abs(totalAmount - totalAmountAfterPromo) > 0.1) {
      console.log(`⚠️ Small total difference: submitted=${totalAmount}, expected=${totalAmountAfterPromo} - using backend calculation`);
      // Use backend calculated amount for consistency
    }

    // 9. Calculate platform solde
    const platformSolde = (p2Total - p1Total) + totalDeliveryFee + totalAppFee - promoDiscount;

    // 10. Create order with multi-provider support
    const orderData = {
      client,
      providers: providersToProcess, // COMMENT 2: Multiple providers
      // Ajouter provider (singulier) pour compatibilité avec le système de grouping
      ...(providersToProcess.length === 1 && { provider: providersToProcess[0] }),
      items: formattedItems,
      providerFees: providerFees, // COMMENT 2: Per-provider fee breakdown
      deliveryAddress,
      paymentMethod: paymentMethod === 'card' ? 'online' : paymentMethod,
      totalAmount: totalAmountAfterPromo,
      clientProductsPrice: p2Total,
      restaurantPayout: p1Total,
      deliveryFee: totalDeliveryFee,
      appFee: totalAppFee, // COMMENT 7: Use summed per-provider appFees
      platformSolde,
      p1Total,
      p2Total,
      // Add transactionId if available (for payment tracking)
      ...(req.body.transactionId && { transactionId: req.body.transactionId }),
      // solde fields (to be calculated by balanceCalculator)
      soldeSimple: 0,
      soldeDual: 0,
      soldeTriple: 0,
      soldeAmigos: 0,
      finalAmount: totalAmountAfterPromo,
      status: 'pending',
      distance: null, // Multi-provider may have different distances
      appliedPromo: appliedPromo ? appliedPromo._id : null,
      promo: appliedPromo ? appliedPromo._id : null,
      cardInfo: cardInfo || undefined,
      subtotal: subtotal || p2Total,
      ...(validatedPrescription && { prescription: validatedPrescription }),
    };

    // Compute soldeSimple and soldeAmigos using balanceCalculator
    try {
      const balanceCalc = require('../services/balanceCalculator');
      orderData.soldeSimple = balanceCalc.calculateSoldeSimple({ clientProductsPrice: p2Total, restaurantPayout: p1Total });
      // For a single order, soldeDual/Triple default to 0; soldeAmigos includes appFee
      orderData.soldeAmigos = balanceCalc.calculateSoldeAmigos([ { clientProductsPrice: p2Total, restaurantPayout: p1Total } ], totalAppFee);
    } catch (calcErr) {
      console.error('Erreur calcul solde:', calcErr);
    }

    // PROTECTION WINDOW: Set protectionEnd = createdAt + 3 minutes (180 seconds = 180000ms)
    const protectionDurationMs = 3 * 60 * 1000; // 3 minutes
    const protectionEndTime = new Date(Date.now() + protectionDurationMs);
    orderData.protectionEnd = protectionEndTime;

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
      // Non-urgent orders: immediately available but eligible for grouping
      orderData.orderType = 'A1';
      orderData.processingDelay = 0;
      orderData.scheduledFor = null;
      orderData.canBeGrouped = true;
      console.log('📦 Creating non-urgent order (A1) - immediately available and eligible for grouping');
    }
    const createdOrder = await Order.create(orderData);

    // Populate order with necessary data for notifications
    const populatedOrder = await Order.findById(createdOrder._id)
      .populate('client', 'firstName lastName phoneNumber location')
      .populate('providers', 'name type phone address')
      .populate('provider', 'name type phone address location'); // Ajouter provider singulier
    
    // S'assurer que provider est disponible pour la notification (prendre le premier si plusieurs)
    const providerForNotification = populatedOrder.providers && populatedOrder.providers.length > 0 
      ? populatedOrder.providers[0] 
      : null;
    
    console.log('🎯 Provider for notification:', providerForNotification);
    
    // IMMEDIATE ADMIN NOTIFICATION - Always notify admins immediately regardless of order type
    try {
      if (global.notifyAdminsImmediate) {
        await global.notifyAdminsImmediate(populatedOrder);
        console.log('📢 [IMMEDIATE] Admin notification sent for order', populatedOrder._id);
      }
    } catch (adminNotificationError) {
      console.error('❌ Failed to send immediate admin notification:', adminNotificationError);
    }

    // Notify deliverers about new order immediately (both urgent and non-urgent)
    try {
      await global.notifyNewOrder(populatedOrder);
      console.log('📢 Immediate notification sent to deliverers for order', populatedOrder._id);
    } catch (notificationError) {
      console.error('❌ Failed to send deliverer notification:', notificationError);
    }

    // Schedule auto-cancellation after 20 minutes (1200000ms)
    if (global.scheduleOrderAutoCancellation) {
      global.scheduleOrderAutoCancellation(createdOrder._id.toString(), 1200000);
    }

    res.status(201).json({
      message: appliedPromo ? `Promo "${appliedPromo.name}" appliquée !` : 'Commande créée avec succès',
      order: {
        ...createdOrder.toObject(),
        promoName: appliedPromo ? appliedPromo.name : null,
        promoDiscount: promoDiscount,
        breakdown: {
          products: p2Total,
          delivery: totalDeliveryFee,
          appFee: totalAppFee,
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
      .populate('providers', 'name type phone address')
      .sort({ isUrgent: -1, createdAt: -1 });
    
    // Format available orders with detailed information for livreurs
    const formattedOrders = availableOrders.map(order => {
      // Handle both single provider and multi-provider orders
      const primaryProvider = order.providers && order.providers.length > 0 
        ? order.providers[0] 
        : order.provider;

      return {
        id: order._id,
        orderNumber: `CMD-${order._id.toString().slice(-6).toUpperCase()}`,
        client: {
          id: order.client?._id,
          name: order.client ? `${order.client.firstName} ${order.client.lastName}` : 'Unknown Client',
          phone: order.client?.phoneNumber,
          location: order.client?.location || {},
        },
        provider: primaryProvider ? {
          id: primaryProvider._id,
          name: primaryProvider.name,
          type: primaryProvider.type,
          phone: primaryProvider.phone,
          address: primaryProvider.address,
        } : null,
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
        orderType: order.orderType || 'A1',
        isGrouped: !!order.isGrouped,
        groupSize: order.groupedOrders ? order.groupedOrders.length : 1,
      };
    });
    
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

// @desc    Cancel order by client (ANNULER_1)
// @route   POST /api/orders/:id/cancel-client
// @access  Private (client)
exports.cancelOrderByClient = async (req, res) => {
  const { id: orderId } = req.params;
  const clientId = req.user.id;

  try {
    const order = await Order.findById(orderId)
      .populate('client')
      .populate('deliveryDriver')
      .populate('zone');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    // Verify the order belongs to the client
    if (order.client._id.toString() !== clientId) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à annuler cette commande'
      });
    }

    // Check if order can still be cancelled by client (not already accepted/assigned)
    if (order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cette commande ne peut plus être annulée par le client'
      });
    }

    // Handle ANNULER_1
    const result = await cancellationService.handleAnnuler1(order);

    res.json({
      success: result.success,
      message: result.message,
      order: {
        id: order._id,
        status: order.status,
        cancellationType: order.cancellationType,
        cancellationSolde: order.cancellationSolde
      }
    });
  } catch (error) {
    console.error('Error in cancelOrderByClient:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
};

// @desc    Cancel order by provider (ANNULER_2)
// @route   POST /api/orders/:id/cancel-provider
// @access  Private (provider)
exports.cancelOrderByProvider = async (req, res) => {
  const { id: orderId } = req.params;
  const { reason } = req.body;
  const providerId = req.user.id;

  try {
    const order = await Order.findById(orderId)
      .populate('client')
      .populate('provider')
      .populate('deliveryDriver')
      .populate('zone');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    // Verify the order belongs to the provider
    if (order.provider._id.toString() !== providerId) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à annuler cette commande'
      });
    }

    // Check if order can be cancelled by provider
    if (!['pending', 'accepted', 'collected'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cette commande ne peut plus être annulée par le prestataire'
      });
    }

    const cancellationReason = reason || 'Produit indisponible';

    // Handle ANNULER_2
    const result = await cancellationService.handleAnnuler2(order, cancellationReason);

    res.json({
      success: result.success,
      message: result.message,
      order: {
        id: order._id,
        status: order.status,
        cancellationType: order.cancellationType,
        cancellationSolde: order.cancellationSolde
      }
    });
  } catch (error) {
    console.error('Error in cancelOrderByProvider:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
};

// @desc    Cancel order by admin (ANNULER_3)
// @route   POST /api/orders/:id/cancel-admin
// @access  Private (admin/superAdmin)
exports.cancelOrderByAdmin = async (req, res) => {
  const { id: orderId } = req.params;
  const adminId = req.user.id;

  try {
    // Verify user is admin or superAdmin
    const admin = await User.findById(adminId);
    if (!admin || !['admin', 'superAdmin'].includes(admin.role)) {
      return res.status(403).json({
        success: false,
        message: 'Seuls les administrateurs peuvent annuler les commandes'
      });
    }

    const order = await Order.findById(orderId)
      .populate('client')
      .populate('provider')
      .populate('deliveryDriver')
      .populate('zone');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    // Check if order can be cancelled by admin
    if (order.status === 'delivered' || order.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cette commande ne peut plus être annulée'
      });
    }

    // Handle ANNULER_3
    const result = await cancellationService.handleAnnuler3(order, adminId);

    res.json({
      success: result.success,
      message: result.message,
      clientBlocked: result.clientBlocked,
      order: {
        id: order._id,
        status: order.status,
        cancellationType: order.cancellationType,
        cancellationSolde: order.cancellationSolde
      }
    });
  } catch (error) {
    console.error('Error in cancelOrderByAdmin:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
};
