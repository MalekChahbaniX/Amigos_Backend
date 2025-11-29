const Order = require('../models/Order');
const User = require('../models/User');
const { protect, isDeliverer } = require('../middleware/auth');

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
    
    // Format orders for deliverer interface
    const formattedOrders = orders.map(order => ({
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get available orders for a deliverer
// @route   GET /api/deliverers/orders/available
// @access  Private (deliverer)
exports.getDelivererAvailableOrders = async (req, res) => {
  try {
    const delivererId = req.user.id;
    
    const availableOrders = await Order.find({ 
      status: 'pending', 
      deliveryDriver: null 
    })
      .populate('client', 'firstName lastName phoneNumber location')
      .populate('provider', 'name type phone address')
      .sort({ createdAt: -1 });
    
    // Format available orders
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Accept an order
// @route   PUT /api/deliverers/orders/:orderId/accept
// @access  Private (deliverer)
exports.acceptOrder = async (req, res) => {
  const { orderId } = req.params;
  const delivererId = req.user.id;

  try {
    const order = await Order.findById(orderId)
      .populate('client', 'firstName lastName phoneNumber location')
      .populate('provider', 'name type phone address');
    
    if (!order) {
      return res.status(404).json({ 
        success: false,
        message: 'Commande non trouvée' 
      });
    }
    
    if (order.status !== 'pending') {
      return res.status(400).json({ 
        success: false,
        message: 'La commande ne peut pas être acceptée dans son état actuel' 
      });
    }
    
    if (order.deliveryDriver && order.deliveryDriver.toString() !== delivererId) {
      return res.status(400).json({ 
        success: false,
        message: 'La commande a déjà été assignée à un autre livreur' 
      });
    }

    // Assign the order to the deliverer
    order.deliveryDriver = delivererId;
    order.status = 'accepted';
    await order.save();

    // Return complete order details
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
      success: true,
      message: 'Commande acceptée avec succès',
      order: formattedOrder
    });
  } catch (error) {
    console.error('Error in acceptOrder:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update order status
// @route   PUT /api/deliverers/orders/:orderId/status
// @access  Private (deliverer)
exports.updateOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;
  const delivererId = req.user.id;

  const validStatuses = ['in_delivery', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ 
      success: false,
      message: 'Statut invalide fourni' 
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
      'accepted': ['in_delivery', 'cancelled'],
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

    order.status = status;
    await order.save();
    
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

    res.json({
      success: true,
      earnings: {
        total: parseFloat(totalEarnings.toFixed(3)),
        average: parseFloat(averageEarnings.toFixed(3)),
        orderCount: orders.length,
        deliveredCount: deliveredOrders.length,
        cancelledCount: cancelledOrders.length,
        monthly: Object.values(monthlyEarnings).sort((a, b) => b.month - a.month)
      }
    });
  } catch (error) {
    console.error('Error in getDelivererEarnings:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

    // Get order statistics
    const totalOrders = await Order.countDocuments({ deliveryDriver: delivererId });
    const deliveredOrders = await Order.countDocuments({ 
      deliveryDriver: delivererId, 
      status: 'delivered' 
    });
    const cancelledOrders = await Order.countDocuments({ 
      deliveryDriver: delivererId, 
      status: 'cancelled' 
    });

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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};