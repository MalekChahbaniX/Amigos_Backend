const Order = require('../models/Order');
const User = require('../models/User');
const Session = require('../models/Session');
const balanceCalc = require('../services/balanceCalculator');
const delivererValidator = require('../services/delivererOrderValidation');
const { protect, isDeliverer } = require('../middleware/auth');
const { validateSecurityCode } = require('../utils/securityCodeGenerator');

// @desc    Get orders assigned to a deliverer
// @route   GET /api/deliverers/orders
// @access  Private (deliverer)
exports.getDelivererOrders = async (req, res) => {
  try {
    const delivererId = req.user.id; // Récupéré du middleware d'authentification
    
    const orders = await Order.find({
      deliveryDriver: delivererId
    })
      .populate('client', 'firstName lastName phoneNumber location')
      .populate('provider', 'name type phone address')
      .sort({ createdAt: -1 });
    
    // Filter out orders where client or provider population failed
    const validOrders = orders.filter(order => order.client && order.provider);
    
    if (validOrders.length !== orders.length) {
      console.warn(`Warning: ${orders.length - validOrders.length} orders had null client or provider references and were filtered out`);
    }
    
    // Format orders for deliverer interface
    const formattedOrders = validOrders.map(order => ({
      id: order._id,
      orderNumber: `CMD-${order._id.toString().slice(-6).toUpperCase()}`,
      client: order.client ? {
        id: order.client._id,
        name: `${order.client.firstName} ${order.client.lastName}`,
        phone: order.client.phoneNumber,
        location: order.client.location || {},
      } : null,
      provider: order.provider ? {
        id: order.provider._id,
        name: order.provider.name,
        type: order.provider.type,
        phone: order.provider.phone,
        address: order.provider.address,
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
    }));
    
    res.json({
      success: true,
      orders: formattedOrders,
      count: formattedOrders.length
    });
  } catch (error) {
    console.error('Error in getDelivererOrders:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur',
      error:   error.message
    });
  }
};

// @desc    Get available orders for a deliverer
// @route   GET /api/deliverers/orders/available
// @access  Private (deliverer)
exports.getDelivererAvailableOrders = async (req, res) => {
  try {
    const delivererId = req.user.id;
    
    const now = new Date();
    // Inclure les commandes des 20 dernières minutes qui sont toujours pending
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
    
    // PROTECTION WINDOW: Only show orders where:
    // 1. protectionEnd <= now (protection expired), OR
    // 2. isUrgent: true (urgent orders bypass protection)
    // 3. Created within last 20 minutes and still pending
    const availableOrders = await Order.find({
      status: 'pending',
      deliveryDriver: null,
      $and: [
        {
          $or: [
            { $and: [{ protectionEnd: { $lte: now } }, { isUrgent: false }] },  // Non-urgent orders after protection
            { $and: [{ isUrgent: true }, { protectionEnd: { $lte: now } }] },     // Urgent orders (but still respect protection if it exists)
            { $and: [{ createdAt: { $gte: twentyMinutesAgo } }, { isUrgent: false }] } // Recent orders within 20 minutes
          ]
        },
        { $or: [ { scheduledFor: null }, { scheduledFor: { $lte: now } } ] }
      ]
    })
      .populate('client', 'firstName lastName phoneNumber location')
      .populate('provider', 'name type phone address')
      .sort({ isUrgent: -1, createdAt: -1 });
    
    // Filter out orders where client or provider population failed
    const validOrders = availableOrders.filter(order => order.client && order.provider);
    
    if (validOrders.length !== availableOrders.length) {
      console.warn(`Warning: ${availableOrders.length - validOrders.length} orders had null client or provider references and were filtered out`);
    }
    
    // Format available orders
    const formattedOrders = validOrders.map(order => ({
      id: order._id,
      orderNumber: `CMD-${order._id.toString().slice(-6).toUpperCase()}`,
      client: order.client ? {
        id: order.client._id,
        name: `${order.client.firstName} ${order.client.lastName}`,
        phone: order.client.phoneNumber,
        location: order.client.location || {},
      } : null,
      provider: order.provider ? {
        id: order.provider._id,
        name: order.provider.name,
        type: order.provider.type,
        phone: order.provider.phone,
        address: order.provider.address,
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
      urgentBadge: order.isUrgent ? 'URGENT' : undefined,
    }));
    
    res.json({
      success: true,
      orders: formattedOrders,
      count: formattedOrders.length
    });
  } catch (error) {
    console.error('Error in getDelivererAvailableOrders:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur',
      error:   error.message
    });
  }
};

// @desc    Accept an order
// @route   PUT /api/deliverers/orders/:orderId/accept
// @access  Private (deliverer)
exports.acceptOrder = async (req, res) => {
  const { orderId } = req.params;
  const delivererId = req.user.id;
  
  console.log('🎯 Accept order request:', { orderId, delivererId });
  
  try {
    // Fetch deliverer with their active orders count
    const deliverer = await User.findById(delivererId);
    if (!deliverer) {
      return res.status(404).json({
        success: false,
        message: 'Livreur non trouvé'
      });
    }

    const order = await Order.findById(orderId)
      .populate('client', 'firstName lastName phoneNumber location')
      .populate('provider', 'name type phone address location')
      .populate('zone');
    
    console.log('🎯 Found order:', order ? order._id : 'null');
    console.log('🎯 Order client:', order?.client);
    console.log('🎯 Order provider:', order?.provider);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }
    
    // Check if populated references are null (documents not found)
    if (!order.client || !order.provider) {
      return res.status(404).json({
        success: false,
        message: 'Commande invalide: client ou fournisseur introuvable'
      });
    }

    // Validate that deliverer can accept the order
    const canAcceptValidation = delivererValidator.canAcceptOrder(deliverer, order);
    if (!canAcceptValidation.canAccept) {
      return res.status(400).json({
        success: false,
        message: canAcceptValidation.reason
      });
    }

    // Get current active orders count
    const activeOrdersCount = deliverer.activeOrdersCount || 0;

    // Validate distance criteria based on current number of active orders
    if (activeOrdersCount === 1) {
      // Trying to accept a second order - validate A2 criteria
      const activeOrders = await Order.find({
        deliveryDriver: delivererId,
        status: { $nin: ['delivered', 'cancelled'] }
      })
        .select('deliveryAddress client provider zone status')
        .populate('client', 'location')
        .populate('provider', 'location')
        .populate('zone');

      if (activeOrders.length >= 1) {
        const validation = delivererValidator.validateA2Criteria(activeOrders[0], order);
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            message: `Critères A2 non respectés: ${validation.reason}`
          });
        }
      }
    } else if (activeOrdersCount === 2) {
      // Trying to accept a third order - validate A3 criteria
      const activeOrders = await Order.find({
        deliveryDriver: delivererId,
        status: { $nin: ['delivered', 'cancelled'] }
      })
        .select('deliveryAddress client provider zone status')
        .populate('client', 'location')
        .populate('provider', 'location')
        .populate('zone');

      if (activeOrders.length >= 2) {
        const validation = delivererValidator.validateA3Criteria(activeOrders[0], activeOrders[1], order);
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            message: `Critères A3 non respectés: ${validation.reason}`
          });
        }
      }
    }

    // Assign the order to the deliverer
    // Status remains 'pending' until system validates all criteria (already done above)
    order.deliveryDriver = delivererId;
    
    // COMMENT 3: Determine order type, preserving A4 for urgent orders
    // Check if order is urgent/A4 first; if not, determine by active count
    if (order.isUrgent) {
      // Force A4 for urgent orders and don't let it be overwritten
      order.orderType = 'A4';
    } else {
      // For non-urgent orders, determine type based on active orders count
      const orderType = delivererValidator.determineOrderTypeByCount(activeOrdersCount);
      order.orderType = orderType;
    }

    // Capture the final orderType value for logging
    const orderType = order.orderType;

    order.status = 'accepted';
    await order.save();

    // Cancel auto-cancellation timer since order is now accepted
    if (global.cancelOrderAutoCancellation) {
      global.cancelOrderAutoCancellation(orderId);
    }

    // Increment deliverer's active orders count
    deliverer.activeOrdersCount = (deliverer.activeOrdersCount || 0) + 1;

    // Update deliverer status to 'occupé' if they now have active orders
    if (deliverer.activeOrdersCount > 0) {
      deliverer.status = 'occupé';
    }

    await deliverer.save();

    console.log(`📦 Deliverer ${delivererId}: Accepted order ${orderId} (orderType=${orderType}, activeCount=${deliverer.activeOrdersCount})`);

    // Return complete order details
    const formattedOrder = {
      id: order._id,
      orderNumber: `CMD-${order._id.toString().slice(-6).toUpperCase()}`,
      client: order.client ? {
        id: order.client._id,
        name: `${order.client.firstName} ${order.client.lastName}`,
        phone: order.client.phoneNumber,
        location: order.client.location || {},
      } : null,
      provider: order.provider ? {
        id: order.provider._id,
        name: order.provider.name,
        type: order.provider.type,
        phone: order.provider.phone,
        address: order.provider.address,
      } : null,
      items: order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
      total: order.totalAmount,
      solde: order.platformSolde ? order.platformSolde.toFixed(3) : '0.000',
      status: order.status,
      orderType: order.orderType,
      deliveryAddress: order.deliveryAddress,
      paymentMethod: order.paymentMethod,
      finalAmount: order.finalAmount,
      createdAt: order.createdAt,
      platformSolde: order.platformSolde,
    };

    res.json({
      success: true,
      message: 'Commande acceptée avec succès',
      order: formattedOrder,
      deliverStatus: {
        activeOrdersCount: deliverer.activeOrdersCount,
        status: deliverer.status
      }
    });
  } catch (error) {
    console.error('Error in acceptOrder:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur',
      error:   error.message
    });
  }
};

// @desc    Reject an order
// @route   PUT /api/deliverers/orders/:orderId/reject
// @access  Private (deliverer)
exports.rejectOrder = async (req, res) => {
  const { orderId } = req.params;
  const delivererId = req.user.id;

  try {
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ 
        success: false,
        message: 'Commande non trouvée' 
      });
    }
    
    // Only allow rejection if the order is assigned to this deliverer and is in 'accepted' status
    if (order.deliveryDriver && order.deliveryDriver.toString() !== delivererId) {
      return res.status(400).json({ 
        success: false,
        message: 'Vous ne pouvez pas rejeter cette commande' 
      });
    }
    
    if (order.status !== 'accepted') {
      return res.status(400).json({ 
        success: false,
        message: 'La commande ne peut pas être rejetée dans son état actuel' 
      });
    }

    // Unassign the order from the deliverer
    order.deliveryDriver = null;
    order.status = 'pending';
    await order.save();

    res.json({
      success: true,
      message: 'Commande rejetée avec succès'
    });
  } catch (error) {
    console.error('Error in rejectOrder:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur',
      error:   error.message
    });
  }
};

// @desc    Update order status
// @route   PUT /api/deliverers/orders/:orderId/status
// @access  Private (deliverer)
exports.updateOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const { status, securityCode } = req.body;
  const delivererId = req.user.id;

  const validStatuses = ['collected', 'in_delivery', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ 
      success: false,
      message: 'Statut invalide fourni' 
    });
  }

  // Require security code for critical status transitions
  if (['collected', 'delivered'].includes(status) && !securityCode) {
    return res.status(400).json({
      success: false,
      message: 'Code de sécurité requis pour cette action'
    });
  }

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ 
        success: false,
        message: 'Commande non trouvée' 
      });
    }

    // Verify that the order belongs to the authenticated deliverer
    if (!order.deliveryDriver || order.deliveryDriver.toString() !== delivererId) {
      return res.status(403).json({ 
        success: false,
        message: 'Accès non autorisé à cette commande' 
      });
    }

    // Define valid status transitions
    const validTransitions = {
      'accepted': ['collected', 'cancelled'],
      'collected': ['in_delivery', 'cancelled'],
      'in_delivery': ['delivered', 'cancelled']
    };

    const currentStatus = order.status;
    const allowedStatuses = validTransitions[currentStatus] || [];
    
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false,
        message: `Transition de statut invalide: ${currentStatus} → ${status}` 
      });
    }

    // ===== SECURITY CODE VERIFICATION FOR CRITICAL STATUS TRANSITIONS =====
    if (['collected', 'delivered'].includes(status)) {
      console.log(`🔐 [Order Status] Verifying security code for deliverer ${delivererId} on order ${orderId}`);
      
      const deliverer = await User.findById(delivererId);
      if (!deliverer) {
        return res.status(404).json({
          success: false,
          message: 'Livreur non trouvé'
        });
      }

      // Handle legacy deliverers without security codes
      if (!deliverer.securityCode) {
        console.warn(`⚠️ [Security] Deliverer ${delivererId} missing security code. Auto-generating...`);
        try {
          await deliverer.save({ validateBeforeSave: false });
          console.log(`🔐 [Security] Security code auto-generated for deliverer ${delivererId}`);
        } catch (autoGenErr) {
          console.error('Error auto-generating security code:', autoGenErr);
          return res.status(500).json({
            success: false,
            message: 'Erreur lors de la génération du code de sécurité'
          });
        }
      }

      // Check if deliverer is locked due to failed attempts
      if (deliverer.securityCodeLockedUntil && new Date() < new Date(deliverer.securityCodeLockedUntil)) {
        const remainingMs = new Date(deliverer.securityCodeLockedUntil) - new Date();
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        console.warn(`⚠️ [Security] Deliverer ${delivererId} locked until ${deliverer.securityCodeLockedUntil}`);
        
        return res.status(429).json({
          success: false,
          message: `Trop de tentatives. Réessayez dans ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`
        });
      }

      // Validate provided security code against stored code
      if (!validateSecurityCode(securityCode, deliverer.securityCode)) {
        console.warn(`⚠️ [Security] Invalid security code for order ${orderId}. Current attempts: ${deliverer.failedSecurityCodeAttempts || 0}`);
        
        // Increment failed attempts
        deliverer.failedSecurityCodeAttempts = (deliverer.failedSecurityCodeAttempts || 0) + 1;

        // Lock account after 5 failed attempts
        if (deliverer.failedSecurityCodeAttempts >= 5) {
          deliverer.securityCodeLockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
          console.warn(`🔒 [Security] Deliverer ${delivererId} locked until ${deliverer.securityCodeLockedUntil}`);
        }

        await deliverer.save();

        return res.status(401).json({
          success: false,
          message: 'Code de sécurité invalide'
        });
      }

      // Security code is valid: reset failed attempts and unlock account
      deliverer.failedSecurityCodeAttempts = 0;
      deliverer.securityCodeLockedUntil = null;
      await deliverer.save();
      console.log(`✅ [Security] Security code validated for order ${orderId}`);
    }
    // ===== END SECURITY CODE VERIFICATION =====

    // HANDLE 'collected' STATUS: Manage provider payment confirmation
    if (status === 'collected') {
      const { providerPaymentMode } = req.body;
      
      if (!providerPaymentMode) {
        return res.status(400).json({
          success: false,
          message: 'providerPaymentMode est requis pour confirmer la collecte'
        });
      }

      // For grouped orders, handle multiple payment modes
      if (order.isGrouped && order.groupedOrders && order.groupedOrders.length > 0) {
        // For grouped orders, expect an array of payment modes
        if (!Array.isArray(providerPaymentMode)) {
          return res.status(400).json({
            success: false,
            message: 'Pour les commandes groupées, providerPaymentMode doit être un array'
          });
        }
        order.providerPaymentMode = providerPaymentMode; // Array of {provider, mode}
      } else {
        // For single orders, expect a string: 'especes' or 'facture'
        if (typeof providerPaymentMode !== 'string' || !['especes', 'facture'].includes(providerPaymentMode)) {
          return res.status(400).json({
            success: false,
            message: 'providerPaymentMode doit être "especes" ou "facture"'
          });
        }
        order.providerPaymentMode = providerPaymentMode;
      }

      console.log(`💰 Order ${order._id}: Payment confirmed - mode=${JSON.stringify(providerPaymentMode)}`);
    }

    // CALCULATE ORDERTYPE when transitioning to 'in_delivery'
    if (status === 'in_delivery') {
      // Determine orderType based on grouping and urgency
      // A1 = single (no grouped), not urgent
      // A2 = dual (2 grouped)
      // A3 = triple (3 grouped)
      // A4 = urgent
      if (order.isUrgent) {
        order.orderType = 'A4';
      } else if (order.groupedOrders && order.groupedOrders.length >= 3) {
        order.orderType = 'A3';
      } else if (order.groupedOrders && order.groupedOrders.length >= 2) {
        order.orderType = 'A2';
      } else {
        order.orderType = 'A1';
      }
      
      console.log(`📦 Order ${order._id}: Assigned orderType=${order.orderType} (grouped=${order.groupedOrders?.length || 0}, urgent=${order.isUrgent})`);
      
      // CALCULATE SOLDES based on orderType and grouped orders
      try {
        // Populate groupedOrders if they are just IDs
        if (order.groupedOrders && order.groupedOrders.length > 0 && typeof order.groupedOrders[0] === 'object' && !order.groupedOrders[0].clientProductsPrice) {
          await order.populate('groupedOrders');
        }
        const groupedSolde = await balanceCalc.calculateSoldesByOrderType(order);
        if (groupedSolde !== null) {
          // For grouped orders, use combined solde
          order.soldeAmigos = groupedSolde;
        }
        console.log(`💰 Order ${order._id}: Calculated soldes (A${order.orderType.slice(1)}) - soldeAmigos=${order.soldeAmigos})`);
      } catch (soldeErr) {
        console.error('Error calculating soldes for orderType:', soldeErr);
      }
    }

    order.status = status;
    await order.save();

    // Handle delivery or cancellation: decrement active orders count
    if (status === 'delivered' || status === 'cancelled') {
      try {
        const deliverer = await User.findById(delivererId);
        if (deliverer) {
          // Decrement active orders count
          deliverer.activeOrdersCount = Math.max(0, (deliverer.activeOrdersCount || 1) - 1);

          // Change status from 'occupé' to 'active' if no more active orders
          if (deliverer.activeOrdersCount === 0 && deliverer.status === 'occupé') {
            deliverer.status = 'active';
          }

          await deliverer.save();
          console.log(`👤 Deliverer ${delivererId}: activeOrdersCount=${deliverer.activeOrdersCount}, status=${deliverer.status}`);
        }
      } catch (delErr) {
        console.error('Error updating deliverer active orders count:', delErr);
      }
    }

    // If delivered, compute solde fields and persist (real-time calculation)
    if (status === 'delivered') {
      try {
        const updatedOrder = await balanceCalc.updateOrderSoldes(order);

        // Update deliverer's daily balance record
        try {
          const deliverer = await User.findById(delivererId);
          if (deliverer) {
            const today = new Date();
            today.setHours(0,0,0,0);

            // Find existing entry for today
            let entryIndex = -1;
            if (Array.isArray(deliverer.dailyBalance)) {
              entryIndex = deliverer.dailyBalance.findIndex(e => {
                if (!e || !e.date) return false;
                const d = new Date(e.date);
                d.setHours(0,0,0,0);
                return d.getTime() === today.getTime();
              });
            } else {
              deliverer.dailyBalance = [];
            }

            if (entryIndex >= 0) {
              // Append order and update totals
              deliverer.dailyBalance[entryIndex].orders.push(updatedOrder._id);
              deliverer.dailyBalance[entryIndex].soldeAmigos = Number((deliverer.dailyBalance[entryIndex].soldeAmigos || 0) + (updatedOrder.soldeAmigos || 0));
              // When a new delivered order is added to today's balance, it should be marked unpaid
              deliverer.dailyBalance[entryIndex].paid = false;
              deliverer.dailyBalance[entryIndex].paidAt = null;
            } else {
              // Create new entry for today
              deliverer.dailyBalance.push({
                date: today,
                orders: [updatedOrder._id],
                soldeAmigos: Number(updatedOrder.soldeAmigos || 0),
                paid: false,
                paidAt: null
              });
            }

            await deliverer.save();
          }
        } catch (dbErr) {
          console.error('Error updating deliverer dailyBalance:', dbErr);
        }

        // Update provider's daily balance record
        try {
          if (updatedOrder.provider) {
            const Provider = require('../models/Provider');
            const provider = await Provider.findById(updatedOrder.provider);
            if (provider) {
              const today = new Date();
              today.setHours(0,0,0,0);

              // Find existing entry for today
              let entryIndex = -1;
              if (Array.isArray(provider.dailyBalance)) {
                entryIndex = provider.dailyBalance.findIndex(db => {
                  if (!db || !db.date) return false;
                  const d = new Date(db.date);
                  d.setHours(0,0,0,0);
                  return d.getTime() === today.getTime();
                });
              } else {
                provider.dailyBalance = [];
              }

              const payout = updatedOrder.restaurantPayout || 0;

              if (entryIndex >= 0) {
                // Append order and update total payout
                provider.dailyBalance[entryIndex].orders.push(updatedOrder._id);
                provider.dailyBalance[entryIndex].totalPayout = Number((provider.dailyBalance[entryIndex].totalPayout || 0) + payout);
                // Mark as unpaid when new order added
                provider.dailyBalance[entryIndex].paid = false;
                provider.dailyBalance[entryIndex].paidAt = null;
              } else {
                // Create new entry for today
                provider.dailyBalance.push({
                  date: today,
                  orders: [updatedOrder._id],
                  totalPayout: Number(payout),
                  paymentMode: 'especes',
                  paid: false,
                  paidAt: null
                });
              }

              await provider.save();
              console.log(`💰 Provider ${updatedOrder.provider}: Daily balance updated - payout=${payout}`);
            }
          }
        } catch (providerErr) {
          console.error('Error updating provider dailyBalance:', providerErr);
        }
      } catch (calcErr) {
        console.error('Error calculating solde after delivery:', calcErr);
      }
    }
    
    res.json({ 
      success: true,
      message: 'Statut de la commande mis à jour avec succès',
      order: {
        id: order._id,
        status: order.status,
        updatedAt: order.updatedAt
      }
    });
  } catch (error) {
    console.error('Error in updateOrderStatus:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur',
      error:   error.message
    });
  }
};

// @desc    Get deliverer earnings and statistics
// @route   GET /api/deliverers/earnings
// @access  Private (deliverer)
exports.getDelivererEarnings = async (req, res) => {
  try {
    const delivererId = req.user.id;
    
    const orders = await Order.find({ 
      deliveryDriver: delivererId,
      status: { $in: ['delivered', 'cancelled'] }
    });

    const totalEarnings = orders.reduce((sum, order) => {
      return sum + (order.platformSolde || 0);
    }, 0);

    const deliveredOrders = orders.filter(order => order.status === 'delivered');
    const cancelledOrders = orders.filter(order => order.status === 'cancelled');

    const averageEarnings = deliveredOrders.length > 0 ? 
      totalEarnings / deliveredOrders.length : 0;

    // Group earnings by month
    const monthlyEarnings = {};
    orders.forEach(order => {
      const month = new Date(order.createdAt).toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyEarnings[month]) {
        monthlyEarnings[month] = {
          month,
          total: 0,
          orders: 0,
          delivered: 0,
          cancelled: 0
        };
      }
      monthlyEarnings[month].total += order.platformSolde || 0;
      monthlyEarnings[month].orders++;
      if (order.status === 'delivered') {
        monthlyEarnings[month].delivered++;
      } else {
        monthlyEarnings[month].cancelled++;
      }
    });

    // Include dailyBalance entries for the deliverer
    const deliverer = await User.findById(delivererId).select('dailyBalance');

    res.json({
      success: true,
      earnings: {
        total: parseFloat(totalEarnings.toFixed(3)),
        average: parseFloat(averageEarnings.toFixed(3)),
        orderCount: orders.length,
        deliveredCount: deliveredOrders.length,
        cancelledCount: cancelledOrders.length,
        monthly: Object.values(monthlyEarnings).sort((a, b) => b.month - a.month)
      },
      dailyBalances: (deliverer && Array.isArray(deliverer.dailyBalance)) ? deliverer.dailyBalance : []
    });
  } catch (error) {
    console.error('Error in getDelivererEarnings:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur',
      error:   error.message
    });
  }
};

// @desc    Get deliverer profile
// @route   GET /api/deliverers/profile
// @access  Private (deliverer)
exports.getDelivererProfile = async (req, res) => {
  try {
    const delivererId = req.user.id;
    
    const deliverer = await User.findById(delivererId);
    
    if (!deliverer || deliverer.role !== 'deliverer') {
      return res.status(404).json({ 
        success: false,
        message: 'Profil livreur non trouvé' 
      });
    }

    // Get order statistics with null checks for client/provider
    const orders = await Order.find({ deliveryDriver: delivererId })
      .populate('client', 'firstName lastName phoneNumber location')
      .populate('provider', 'name type phone address');
    
    // Filter out orders where client or provider population failed
    const validOrders = orders.filter(order => order.client && order.provider);
    
    if (validOrders.length !== orders.length) {
      console.warn(`Warning: ${orders.length - validOrders.length} orders had null client or provider references in getDelivererProfile`);
    }
    
    // Count by status
    const totalOrders = validOrders.length;
    const deliveredOrders = validOrders.filter(order => order.status === 'delivered').length;
    const cancelledOrders = validOrders.filter(order => order.status === 'cancelled').length;

    res.json({
      success: true,
      profile: {
        id: deliverer._id,
        firstName: deliverer.firstName,
        lastName: deliverer.lastName,
        phoneNumber: deliverer.phoneNumber,
        email: deliverer.email,
        vehicle: deliverer.vehicle,
        location: deliverer.location,
        status: deliverer.status,
        isVerified: deliverer.isVerified,
        createdAt: deliverer.createdAt,
        statistics: {
          totalOrders,
          deliveredOrders,
          cancelledOrders,
          rating: deliverer.rating || 0
        }
      }
    });
  } catch (error) {
    console.error('Error in getDelivererProfile:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur',
      error:   error.message
    });
  }
};

// @desc    Update deliverer push token
// @route   PUT /api/deliverers/profile/push-token
// @access  Private (deliverer)
exports.updateDelivererPushToken = async (req, res) => {
  try {
    const delivererId = req.user.id;
    const { pushToken } = req.body;
    
    if (!pushToken) {
      return res.status(400).json({ 
        success: false,
        message: 'Push token est requis' 
      });
    }

    // Valider le format du token Expo
    if (!pushToken.startsWith('ExponentPushToken[') || !pushToken.endsWith(']')) {
      return res.status(400).json({ 
        success: false,
        message: 'Format du token Expo invalide' 
      });
    }

    const deliverer = await User.findById(delivererId);
    
    if (!deliverer || deliverer.role !== 'deliverer') {
      return res.status(404).json({ 
        success: false,
        message: 'Profil livreur non trouvé' 
      });
    }

    // Mettre à jour le token
    deliverer.pushToken = pushToken;
    await deliverer.save();

    console.log(`📱 Token Expo mis à jour pour le livreur ${delivererId}: ${pushToken}`);

    res.json({
      success: true,
      message: 'Token Expo mis à jour avec succès',
      pushToken: deliverer.pushToken
    });
  } catch (error) {
    console.error('Error in updateDelivererPushToken:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
};

// @desc    Update deliverer location
// @route   PUT /api/deliverers/profile/location
// @access  Private (deliverer)
exports.updateDelivererLocation = async (req, res) => {
  try {
    const delivererId = req.user.id;
    const { latitude, longitude, address } = req.body;
    
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ 
        success: false,
        message: 'Latitude et longitude sont requises' 
      });
    }

    const deliverer = await User.findById(delivererId);
    
    if (!deliverer || deliverer.role !== 'deliverer') {
      return res.status(404).json({ 
        success: false,
        message: 'Profil livreur non trouvé' 
      });
    }

    deliverer.location = {
      latitude,
      longitude,
      address: address || deliverer.location?.address
    };
    
    await deliverer.save();

    res.json({
      success: true,
      message: 'Localisation mise à jour avec succès',
      location: deliverer.location
    });
  } catch (error) {
    console.error('Error in updateDelivererLocation:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur',
      error:   error.message
    });
  }
};

// @desc    Logout deliverer (invalidate token)
// @route   POST /api/deliverers/logout
// @access  Private (deliverer)
exports.logoutDeliverer = async (req, res) => {
  try {
    const delivererId = req.user.id;
    
    // For now, we'll just return success since JWT tokens are stateless
    // In a production environment, you might want to implement a token blacklist
    // or use a database to track revoked tokens
    
    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });
  } catch (error) {
    console.error('Error in logoutDeliverer:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error:   error.message
    });
  }
};

// @desc    Start deliverer session (clock in)
// @route   POST /api/deliverers/session/start
// @access  Private (deliverer)
exports.startSession = async (req, res) => {
  try {
    const delivererId = req.user.id;
    if (!req.user || req.user.role !== 'deliverer') {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    // Validate security code if provided
    const { securityCode } = req.body;
    if (securityCode) {
      const deliverer = await User.findById(delivererId).select('securityCode');
      if (!deliverer || deliverer.securityCode !== securityCode) {
        return res.status(400).json({ message: 'Code de sécurité invalide' });
      }
    }

    // Prevent multiple active sessions for the same deliverer today
    const today = new Date();
    const startOfToday = new Date(today);
    startOfToday.setHours(0,0,0,0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    // Check user's currentSession first
    let existingSession = null;
    const user = await User.findById(delivererId).select('+currentSession +sessionActive +sessionDate');
    if (user && user.currentSession) {
      const s = await Session.findById(user.currentSession);
      if (s && s.active) {
        const sd = new Date(s.startTime);
        if (sd >= startOfToday && sd < startOfTomorrow) {
          existingSession = s;
        }
      }
    }

    // If none, search for an active session for today in Session collection
    if (!existingSession) {
      existingSession = await Session.findOne({
        deliverer: delivererId,
        active: true,
        startTime: { $gte: startOfToday, $lt: startOfTomorrow }
      });
    }

    if (existingSession) {
      // Ensure User fields are synchronized
      await User.findByIdAndUpdate(delivererId, {
        currentSession: existingSession._id,
        sessionDate: startOfToday,
        sessionActive: true
      });

      return res.status(200).json({ success: true, message: 'Session déjà active', session: existingSession });
    }

    // Create a new Session document and attach it to the user
    const session = await Session.create({ deliverer: delivererId });
    const sDate = new Date(session.startTime);
    sDate.setHours(0,0,0,0);

    await User.findByIdAndUpdate(delivererId, {
      currentSession: session._id,
      sessionDate: sDate,
      sessionActive: true
    });

    res.status(200).json({ success: true, message: 'Session démarrée', session: session });
  } catch (error) {
    console.error('Error in startSession:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// @desc    Pause deliverer session
// @route   POST /api/deliverers/session/pause
// @access  Private (deliverer)
exports.pauseSession = async (req, res) => {
  try {
    const delivererId = req.user.id;
    if (!req.user || req.user.role !== 'deliverer') {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const deliverer = await User.findById(delivererId).select('+currentSession +sessionDate +sessionActive');

    if (!deliverer || !deliverer.currentSession) {
      return res.status(400).json({ success: false, message: 'Aucune session active à mettre en pause' });
    }

    const session = await Session.findById(deliverer.currentSession);
    if (!session || !session.active) {
      return res.status(400).json({ success: false, message: 'Session non trouvée ou déjà terminée' });
    }

    // Mettre en pause la session
    session.paused = true;
    session.pauseTime = new Date();
    await session.save();

    // Mettre à jour le statut du livreur
    await User.findByIdAndUpdate(delivererId, { status: 'paused' });

    res.status(200).json({ success: true, message: 'Session mise en pause', session: session });
  } catch (error) {
    console.error('Error in pauseSession:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// @desc    Resume deliverer session
// @route   POST /api/deliverers/session/resume
// @access  Private (deliverer)
exports.resumeSession = async (req, res) => {
  try {
    const delivererId = req.user.id;
    if (!req.user || req.user.role !== 'deliverer') {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const deliverer = await User.findById(delivererId).select('+currentSession +sessionDate +sessionActive');

    if (!deliverer || !deliverer.currentSession) {
      return res.status(400).json({ success: false, message: 'Aucune session active à reprendre' });
    }

    const session = await Session.findById(deliverer.currentSession);
    if (!session || !session.active) {
      return res.status(400).json({ success: false, message: 'Session non trouvée ou déjà terminée' });
    }

    // Reprendre la session
    session.paused = false;
    session.resumeTime = new Date();
    await session.save();

    // Mettre à jour le statut du livreur
    await User.findByIdAndUpdate(delivererId, { status: 'online' });

    res.status(200).json({ success: true, message: 'Session reprise', session: session });
  } catch (error) {
    console.error('Error in resumeSession:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// @desc    Stop deliverer session (clock out)
// @route   POST /api/deliverers/session/stop
// @access  Private (deliverer)
exports.stopSession = async (req, res) => {
  try {
    const delivererId = req.user.id;
    if (!req.user || req.user.role !== 'deliverer') {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const deliverer = await User.findById(delivererId).select('+currentSession +sessionDate +sessionActive');

    if (!deliverer || !deliverer.currentSession) {
      return res.status(400).json({ success: false, message: 'Aucune session active à terminer' });
    }

    // Load session even if it started on a previous day — allow closing old sessions
    const session = await Session.findById(deliverer.currentSession);
    if (!session) {
      // If the session referenced on user does not exist, just clear the user fields
      await User.findByIdAndUpdate(delivererId, { currentSession: null, sessionActive: false });
      return res.status(200).json({ success: true, message: 'Session nettoyée (session introuvable)' });
    }

    // Close the session
    session.endTime = new Date();
    session.active = false;
    await session.save();

    // Update user fields to reflect closed session
    await User.findByIdAndUpdate(delivererId, {
      currentSession: null,
      sessionActive: false,
      // keep sessionDate as the session's start date (date-only)
      sessionDate: (function() {
        const d = new Date(session.startTime);
        d.setHours(0,0,0,0);
        return d;
      })()
    });

    res.status(200).json({ success: true, message: 'Session terminée', session: session });
  } catch (error) {
    console.error('Error in stopSession:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// @desc    Get past sessions for the authenticated deliverer
// @route   GET /api/deliverer/sessions
// @access  Private (deliverer)
exports.getDelivererSessions = async (req, res) => {
  try {
    const delivererId = req.user.id;

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = (page - 1) * limit;

    const filter = { deliverer: delivererId };

    const [total, sessions] = await Promise.all([
      Session.countDocuments(filter),
      Session.find(filter)
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(limit)
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages,
      sessions
    });
  } catch (error) {
    console.error('Error in getDelivererSessions:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

// @desc    Get deliverer's daily balance for today (or specified date)
// @route   GET /api/deliverers/daily-balance
// @access  Private (deliverer)
exports.getDailyBalance = async (req, res) => {
  try {
    const delivererId = req.user.id;
    const dateParam = req.query.date; // optional YYYY-MM-DD

    // Strictly parse YYYY-MM-DD to avoid timezone issues
    let targetDate = new Date();
    if (dateParam) {
      const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(dateParam);
      if (!m) return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD' });
      const year = parseInt(m[1], 10);
      const month = parseInt(m[2], 10) - 1; // monthIndex
      const day = parseInt(m[3], 10);
      targetDate = new Date(year, month, day);
    }
    targetDate.setHours(0,0,0,0);

    // Use $elemMatch to project only the matching dailyBalance element
    const deliverer = await User.findOne(
      { _id: delivererId },
      { dailyBalance: { $elemMatch: { date: targetDate } } }
    ).populate('dailyBalance.orders');

    if (!deliverer) return res.status(404).json({ success: false, message: 'Deliverer not found' });

    const entry = (deliverer.dailyBalance || [])[0];

    if (!entry) {
      return res.json({ success: true, dailyBalance: { date: targetDate, orders: [], soldeAmigos: 0, paid: false } });
    }

    res.json({ success: true, dailyBalance: entry });
  } catch (error) {
    console.error('Error in getDailyBalance:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

// @desc    Mark deliverer's daily balance as paid
// @route   POST /api/deliverers/pay-balance
// @access  Private (deliverer)
exports.payDailyBalance = async (req, res) => {
  try {
    const delivererId = req.user.id;
    const dateParam = req.body.date; // optional YYYY-MM-DD

    // Strictly parse YYYY-MM-DD to avoid timezone issues
    let targetDate = new Date();
    if (dateParam) {
      const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(dateParam);
      if (!m) return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD' });
      const year = parseInt(m[1], 10);
      const month = parseInt(m[2], 10) - 1;
      const day = parseInt(m[3], 10);
      targetDate = new Date(year, month, day);
    }
    targetDate.setHours(0,0,0,0);

    const deliverer = await User.findById(delivererId);
    if (!deliverer) return res.status(404).json({ success: false, message: 'Deliverer not found' });

    let entryIndex = -1;
    if (Array.isArray(deliverer.dailyBalance)) {
      entryIndex = deliverer.dailyBalance.findIndex(e => {
        if (!e || !e.date) return false;
        const d = new Date(e.date);
        d.setHours(0,0,0,0);
        return d.getTime() === targetDate.getTime();
      });
    }

    if (entryIndex === -1) {
      return res.status(404).json({ success: false, message: 'Daily balance not found for date' });
    }

    deliverer.dailyBalance[entryIndex].paid = true;
    deliverer.dailyBalance[entryIndex].paidAt = new Date();

    await deliverer.save();

    res.json({ success: true, message: 'Daily balance marked as paid', dailyBalance: deliverer.dailyBalance[entryIndex] });
  } catch (error) {
    console.error('Error in payDailyBalance:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

// @desc    Get precise statistics for deliverer dashboard (#1)
// @route   GET /api/deliverer/me/statistics
// @access  Private (deliverer)
exports.getDelivererStatistics = async (req, res) => {
  try {
    const delivererId = req.user.id;

    const deliverer = await User.findById(delivererId);
    if (!deliverer) {
      return res.status(404).json({ success: false, message: 'Livreur non trouvé' });
    }

    // Get today's date at start of day
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find today's balance entry
    const todayBalance = deliverer.dailyBalance?.find(db => {
      const d = new Date(db.date);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    });

    // Get all delivered orders for this deliverer
    const allDeliveredOrders = await Order.find({
      deliveryDriver: delivererId,
      status: 'delivered'
    });

    // Get today's delivered orders
    const todayDeliveredOrders = allDeliveredOrders.filter(o => {
      const oDate = new Date(o.createdAt);
      oDate.setHours(0, 0, 0, 0);
      return oDate.getTime() === today.getTime();
    });

    // Get today's cancelled orders
    const todayCancelledOrders = await Order.find({
      deliveryDriver: delivererId,
      status: 'cancelled',
      createdAt: { $gte: today }
    });

    // Count by status
    const totalDelivered = allDeliveredOrders.length;
    const totalCancelled = (await Order.countDocuments({
      deliveryDriver: delivererId,
      status: 'cancelled'
    })) || 0;

    // Calculate solde amounts
    const soldeAmigosTodayAmount = todayBalance?.soldeAmigos || 0;
    const soldeAnnulationTodayAmount = todayBalance?.soldeAnnulation || 0;
    const cashCollectedToday = Math.max(0, soldeAmigosTodayAmount - soldeAnnulationTodayAmount);

    // Total earnings
    const totalSoldeAmigos = (deliverer.dailyBalance || []).reduce((sum, db) => sum + (db.soldeAmigos || 0), 0);
    const totalSoldeAnnulation = (deliverer.dailyBalance || []).reduce((sum, db) => sum + (db.soldeAnnulation || 0), 0);

    res.json({
      success: true,
      statistics: {
        // Badge #1: Amigos CASH (today's soldeAmigos)
        amigosCashToday: Number(soldeAmigosTodayAmount.toFixed(3)),
        
        // Badge #2: Vos CASH (cash collected = soldeAmigos - annulation)
        yourCashToday: Number(cashCollectedToday.toFixed(3)),
        
        // Badge #3: Commandes réalisées (today)
        ordersCompletedToday: todayDeliveredOrders.length,
        
        // Badge #4: Commandes refusées (today) - can be orders rejected or cancelled
        ordersRejectedToday: todayCancelledOrders.length,
        
        // Badge #5: Solde annulation (today)
        cancellationSoldeToday: Number(soldeAnnulationTodayAmount.toFixed(3)),
        
        // Badge #6: Total livreur stats
        totalDelivered,
        totalCancelled,
        totalSoldeAmigos: Number(totalSoldeAmigos.toFixed(3)),
        totalCancellationSolde: Number(totalSoldeAnnulation.toFixed(3)),
        
        // Additional info
        todayDate: today.toISOString(),
        delivererName: `${deliverer.firstName} ${deliverer.lastName}`,
        currency: 'DT'
      }
    });
  } catch (error) {
    console.error('Error in getDelivererStatistics:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};
