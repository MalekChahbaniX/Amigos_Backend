const Order = require('../models/Order');
const Provider = require('../models/Provider');
const Promo = require('../models/Promo');
const AppSetting = require('../models/AppSetting');
const Zone = require('../models/Zone');
const Product = require('../models/Product');

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
    deliveryAddress, 
    paymentMethod, 
    totalAmount, 
    deliveryFee, 
    subtotal, 
    cardInfo,
    zoneId,
    distance
  } = req.body;

  try {
    // 1. Charger provider (pour connaître son type : restaurant, course, etc.)
    console.log('🔍 Fetching provider:', provider);
    const providerData = await Provider.findById(provider);
    if (!providerData) {
      console.log('❌ Provider not found:', provider);
      return res.status(404).json({ message: 'Provider not found' });
    }
    console.log('✅ Provider loaded:', { 
      id: providerData._id, 
      name: providerData.name, 
      type: providerData.type, 
      csR: providerData.csRPercent, 
      csC: providerData.csCPercent 
    });

    // 2. Charger les produits pour obtenir P1, P2, deliveryCategory
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

    const formattedItems = [];
    
    for (const item of items) {
      const product = productMap.get(item.product?.toString() || item.productId?.toString());
      let P1, P2, deliveryCategory;
      
      if (product) {
        // Utiliser les valeurs calculées du produit
        P1 = product.p1;
        P2 = product.p2;
        deliveryCategory = product.deliveryCategory;
        
        // Catégorisation
        if (deliveryCategory === 'restaurant') hasRestaurant = true;
        if (deliveryCategory === 'course') hasCourse = true;
        if (deliveryCategory === 'pharmacy') hasPharmacy = true;
      } else {
        // Calculer manuellement si le produit n'existe pas
        const P = item.price || 0;
        const csR = (providerData.csRPercent || 5) / 100;
        const csC = (providerData.csCPercent || 0) / 100;
        P1 = P * (1 - csR);
        P2 = P * (1 + csC);
        deliveryCategory = providerData.type; // Utiliser le type du provider comme fallback
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
      
      console.log(`Item ${item.name || 'unknown'}: P=${item.price}, qty=${qty}, P1=${P1}, P2=${P2}, category=${deliveryCategory}`);
    }

    console.log(`🧮 Totals: p1Total=${p1Total}, p2Total=${p2Total}`);

    // 4. Déterminer la catégorie de livraison (priorité: course > pharmacy > restaurant)
    let deliveryCategory = 'restaurant';
    if (hasCourse) deliveryCategory = 'course';
    else if (hasPharmacy) deliveryCategory = 'pharmacy';
    
    console.log('🏷️ Delivery category:', deliveryCategory);

    // 5. Calculer les frais de livraison selon la zone
    console.log('🚚 Calculating delivery fee...');
    let calculatedDeliveryFee = 0;
    
    if (zoneId) {
      const zone = await Zone.findById(zoneId);
      if (zone) {
        calculatedDeliveryFee = zone.price;
        console.log(`📍 Zone ${zone.number}: delivery fee = ${calculatedDeliveryFee}`);
      }
    } else if (distance) {
      // Trouver la zone correspondante à la distance
      const zone = await Zone.findOne({
        minDistance: { $lte: distance },
        maxDistance: { $gte: distance }
      });
      if (zone) {
        calculatedDeliveryFee = zone.price;
        console.log(`📍 Distance ${distance}km -> Zone ${zone.number}: delivery fee = ${calculatedDeliveryFee}`);
      }
    }
    
    // Utiliser la deliveryFee fournie ou celle calculée
    const finalDeliveryFee = deliveryFee !== undefined ? deliveryFee : calculatedDeliveryFee;

    // 6. Charger les frais application
    console.log('💳 Loading app fees...');
    const appSetting = await AppSetting.findOne();
    const appFee = appSetting ? appSetting.appFee : (deliveryCategory === 'restaurant' ? 0 : 1.5);
    console.log('📱 App fee:', appFee);

    // 7. Calculer le montant final
    const finalAmount = p2Total + finalDeliveryFee + appFee;
    console.log(`💰 Final amount: p2Total(${p2Total}) + deliveryFee(${finalDeliveryFee}) + appFee(${appFee}) = ${finalAmount}`);

    // 8. Vérifier promo active applicable
    console.log('🎁 Checking for active promo...');
    const promo = await Promo.findOne({ status: 'active' });
    console.log('Promo found:', promo ? { id: promo._id, name: promo.name, maxOrders: promo.maxOrders, ordersUsed: promo.ordersUsed } : 'None');

    let appliedPromo = null;
    let promoDiscount = 0;

    if (
      promo &&
      promo.targetServices.includes(deliveryCategory) &&
      promo.ordersUsed < promo.maxOrders &&
      finalAmount <= promo.maxAmount
    ) {
      // Promo applicable
      appliedPromo = promo;
      promoDiscount = promo.discountAmount || 0;
      console.log(`✅ Promo "${promo.name}" applied! Discount: ${promoDiscount}`);
      
      // Incrémenter le compteur promo
      promo.ordersUsed += 1;
      await promo.save();
    }

    // 9. Appliquer la promo si applicable
    const totalAmountAfterPromo = Math.max(0, finalAmount - promoDiscount);

    // 10. Valider le montant total
    if (Math.abs(totalAmount - totalAmountAfterPromo) > 0.01) {
      console.log(`❌ Total mismatch: submitted=${totalAmount}, expected=${totalAmountAfterPromo}`);
      return res.status(400).json({ 
        message: 'Total amount does not match calculated amount',
        expected: totalAmountAfterPromo,
        submitted: totalAmount
      });
    }

    // 11. Calculer le solde plateforme
    const platformSolde = (p2Total - p1Total) + finalDeliveryFee + appFee - promoDiscount;
    console.log(`🧮 Platform solde: (${p2Total} - ${p1Total}) + ${finalDeliveryFee} + ${appFee} - ${promoDiscount} = ${platformSolde}`);

    // 12. Créer la commande
    const orderData = {
      client,
      provider,
      items: formattedItems,
      deliveryAddress,
      paymentMethod: paymentMethod === 'card' ? 'online' : paymentMethod,
      totalAmount,
      clientProductsPrice: p2Total,
      restaurantPayout: p1Total,
      deliveryFee: finalDeliveryFee,
      appFee,
      platformSolde,
      p1Total,
      p2Total,
      finalAmount: totalAmountAfterPromo,
      status: 'pending',
      zone: zoneId || null,
      distance: distance || null,
      appliedPromo: appliedPromo ? appliedPromo._id : null,
      // Champs optionnels pour compatibilité
      promo: appliedPromo ? appliedPromo._id : null,
      cardInfo: cardInfo || undefined,
      subtotal: subtotal || p2Total,
    };

    console.log('💾 Creating order with data:', orderData);

    const createdOrder = await Order.create(orderData);
    console.log('✅ Order created successfully:', { 
      id: createdOrder._id, 
      status: createdOrder.status, 
      paymentMethod: createdOrder.paymentMethod,
      platformSolde: createdOrder.platformSolde
    });

    res.status(201).json({
      message: appliedPromo 
        ? `Promo "${appliedPromo.name}" appliquée !` 
        : 'Commande créée sans promo',
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
