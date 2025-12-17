const User = require('../models/User');
const Order = require('../models/Order');
const Provider = require('../models/Provider');

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private (Super Admin only)
exports.getDashboardStats = async (req, res) => {
  try {
    // Get today's date range
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Get counts for today
    const todayOrders = await Order.countDocuments({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    const activeClients = await User.countDocuments({
      role: 'client',
      status: 'active'
    });

    const activeDeliverers = await User.countDocuments({
      role: 'deliverer',
      status: 'active'
    });

    // Calculate today's revenue (sum of client-paid amounts)
    const todayRevenueResult = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          status: { $in: ['delivered', 'completed'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$clientProductsPrice' }
        }
      }
    ]);

    // Calculate platform solde (revenue - restaurant payout + fees)
    const todaySoldeResult = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          status: { $in: ['delivered', 'completed'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$platformSolde' }
        }
      }
    ]);

    const todayRevenue = todayRevenueResult.length > 0 ? todayRevenueResult[0].total.toFixed(2) : '0.00';
    const todaySolde = todaySoldeResult.length > 0 ? todaySoldeResult[0].total.toFixed(2) : '0.00';

    res.status(200).json({
      todayOrders,
      activeClients,
      activeDeliverers,
      todayRevenue,
      todaySolde
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des statistiques',
      error:   error.message
    });
  }
};

// @desc    Get platform balance (solde total plateforme)
// @route   GET /api/dashboard/platform-balance
// @access  Private (Super Admin only)
exports.getPlatformBalance = async (req, res) => {
  try {
    const { startDate, endDate, category } = req.query;
    
    let matchStage = { status: { $in: ['delivered', 'completed'] } };
    
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }
    
    if (category) {
      matchStage['items.deliveryCategory'] = category;
    }

    const result = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalSolde: { $sum: '$platformSolde' },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$clientProductsPrice' },
          totalPayout: { $sum: '$restaurantPayout' },
          totalDeliveryFee: { $sum: '$deliveryFee' },
          totalAppFee: { $sum: '$appFee' }
        }
      }
    ]);

    const balance = result.length > 0 ? result[0] : {
      totalSolde: 0,
      totalOrders: 0,
      totalRevenue: 0,
      totalPayout: 0,
      totalDeliveryFee: 0,
      totalAppFee: 0
    };

    res.status(200).json({
      totalSolde: balance.totalSolde.toFixed(3),
      totalOrders: balance.totalOrders,
      totalRevenue: balance.totalRevenue.toFixed(3),
      totalPayout: balance.totalPayout.toFixed(3),
      totalDeliveryFee: balance.totalDeliveryFee.toFixed(3),
      totalAppFee: balance.totalAppFee.toFixed(3),
      breakdown: {
        commissionPlateforme: (balance.totalRevenue - balance.totalPayout).toFixed(3),
        fraisLivraison: balance.totalDeliveryFee.toFixed(3),
        fraisApplication: balance.totalAppFee.toFixed(3)
      }
    });

  } catch (error) {
    console.error('Error fetching platform balance:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération du solde plateforme',
      error:   error.message
    });
  }
};

// @desc    Get deliverer balance (solde par livreur)
// @route   GET /api/dashboard/deliverer-balance
// @access  Private (Super Admin only)
exports.getDelivererBalance = async (req, res) => {
  try {
    const { delivererId, startDate, endDate } = req.query;
    
    let matchStage = {
      status: { $in: ['delivered', 'completed'] },
      deliveryDriver: { $ne: null }
    };
    
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }
    
    if (delivererId) {
      matchStage.deliveryDriver = delivererId;
    }

    const result = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$deliveryDriver',
          totalSolde: { $sum: '$platformSolde' },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$clientProductsPrice' },
          totalPayout: { $sum: '$restaurantPayout' },
          totalDeliveryFee: { $sum: '$deliveryFee' },
          totalAppFee: { $sum: '$appFee' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'deliverer'
        }
      },
      {
        $unwind: '$deliverer'
      },
      {
        $project: {
          delivererId: '$_id',
          delivererName: { $concat: ['$deliverer.firstName', ' ', '$deliverer.lastName'] },
          totalSolde: 1,
          totalOrders: 1,
          totalRevenue: 1,
          totalPayout: 1,
          totalDeliveryFee: 1,
          totalAppFee: 1
        }
      },
      { $sort: { totalSolde: -1 } }
    ]);

    // Si on demande un livreur spécifique, retourner un seul résultat
    if (delivererId && result.length > 0) {
      const deliverer = result[0];
      res.status(200).json({
        delivererId: deliverer.delivererId,
        delivererName: deliverer.delivererName,
        totalSolde: deliverer.totalSolde.toFixed(3),
        totalOrders: deliverer.totalOrders,
        totalRevenue: deliverer.totalRevenue.toFixed(3),
        totalPayout: deliverer.totalPayout.toFixed(3),
        totalDeliveryFee: deliverer.totalDeliveryFee.toFixed(3),
        totalAppFee: deliverer.totalAppFee.toFixed(3),
        breakdown: {
          commissionPlateforme: (deliverer.totalRevenue - deliverer.totalPayout).toFixed(3),
          fraisLivraison: deliverer.totalDeliveryFee.toFixed(3),
          fraisApplication: deliverer.totalAppFee.toFixed(3)
        }
      });
    } else {
      // Sinon retourner la liste de tous les livreurs
      const formattedResult = result.map(deliverer => ({
        delivererId: deliverer.delivererId,
        delivererName: deliverer.delivererName,
        totalSolde: deliverer.totalSolde.toFixed(3),
        totalOrders: deliverer.totalOrders,
        totalRevenue: deliverer.totalRevenue.toFixed(3),
        totalPayout: deliverer.totalPayout.toFixed(3),
        totalDeliveryFee: deliverer.totalDeliveryFee.toFixed(3),
        totalAppFee: deliverer.totalAppFee.toFixed(3)
      }));
      
      res.status(200).json(formattedResult);
    }

  } catch (error) {
    console.error('Error fetching deliverer balance:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération du solde livreurs',
      error:   error.message
    });
  }
};

// @desc    Get deliverer details with orders
// @route   GET /api/dashboard/deliverer/:id/orders
// @access  Private (Super Admin only)
exports.getDelivererOrders = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    
    let matchStage = {
      deliveryDriver: id,
      status: { $in: ['delivered', 'completed'] }
    };
    
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const orders = await Order.find(matchStage)
      .populate('client', 'firstName lastName phoneNumber')
      .populate('provider', 'name type phone address')
      .sort({ createdAt: -1 });

    const summary = orders.reduce((acc, order) => {
      acc.totalSolde += order.platformSolde || 0;
      acc.totalOrders += 1;
      acc.totalRevenue += order.clientProductsPrice || 0;
      acc.totalPayout += order.restaurantPayout || 0;
      acc.totalDeliveryFee += order.deliveryFee || 0;
      acc.totalAppFee += order.appFee || 0;
      return acc;
    }, {
      totalSolde: 0,
      totalOrders: 0,
      totalRevenue: 0,
      totalPayout: 0,
      totalDeliveryFee: 0,
      totalAppFee: 0
    });

    const formattedOrders = orders.map(order => ({
      id: order._id,
      orderNumber: `CMD-${order._id.toString().slice(-6).toUpperCase()}`,
      client: {
        name: `${order.client.firstName} ${order.client.lastName}`,
        phone: order.client.phoneNumber
      },
      provider: {
        name: order.provider.name,
        type: order.provider.type
      },
      total: order.totalAmount,
      solde: (order.platformSolde || 0).toFixed(3),
      status: order.status,
      deliveryAddress: order.deliveryAddress,
      createdAt: order.createdAt,
      breakdown: {
        products: order.clientProductsPrice,
        delivery: order.deliveryFee,
        appFee: order.appFee,
        solde: order.platformSolde
      }
    }));

    res.status(200).json({
      delivererId: id,
      summary: {
        totalSolde: summary.totalSolde.toFixed(3),
        totalOrders: summary.totalOrders,
        totalRevenue: summary.totalRevenue.toFixed(3),
        totalPayout: summary.totalPayout.toFixed(3),
        totalDeliveryFee: summary.totalDeliveryFee.toFixed(3),
        totalAppFee: summary.totalAppFee.toFixed(3)
      },
      orders: formattedOrders
    });

  } catch (error) {
    console.error('Error fetching deliverer orders:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des commandes du livreur',
      error:   error.message
    });
  }
};

// @desc    Get recent orders
// @route   GET /api/dashboard/recent-orders
// @access  Private (Super Admin only)
exports.getRecentOrders = async (req, res) => {
  try {
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('client', 'firstName lastName')
      .select('orderNumber totalAmount status createdAt');

    const formattedOrders = recentOrders.map(order => ({
      id: order.orderNumber || order._id.toString(),
      client: order.clientId ? `${order.clientId.firstName} ${order.clientId.lastName}` : 'Client inconnu',
      total: `${order.clientProductsPrice || order.totalAmount} DT`,
      solde: `${order.platformSolde || 0} DT`,
      status: order.status,
      time: new Date(order.createdAt).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }));

    res.status(200).json(formattedOrders);

  } catch (error) {
    console.error('Error fetching recent orders:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des commandes récentes',
      error:   error.message
    });
  }
};

// @desc    Get all orders with pagination and filtering
// @route   GET /api/dashboard/orders
// @access  Private (Super Admin only)
exports.getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const skip = (page - 1) * limit;
    
    let matchStage = {};
    
    if (search) {
      matchStage.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'client.firstName': { $regex: search, $options: 'i' } },
        { 'client.lastName': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status && status !== 'all') {
      matchStage.status = status;
    }

    const orders = await Order.find(matchStage)
      .populate('client', 'firstName lastName phoneNumber')
      .populate('provider', 'name type phone address')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(matchStage);
    const totalPages = Math.ceil(total / limit);

    const formattedOrders = orders.map(order => ({
      id: order._id,
      orderNumber: order.orderNumber || `CMD-${order._id.toString().slice(-6).toUpperCase()}`,
      client: order.client ? `${order.client.firstName} ${order.client.lastName}` : 'Client inconnu',
      phone: order.client?.phoneNumber,
      address: order.deliveryAddress
        ? `${order.deliveryAddress.street || ''}, ${order.deliveryAddress.city || ''}`.replace(/, $/, '')
        : 'Adresse inconnue',
      total: `${order.totalAmount} DT`,
      solde: order.platformSolde ? `${order.platformSolde.toFixed(3)} DT` : '0.000 DT',
      status: order.status,
      date: new Date(order.createdAt).toLocaleDateString('fr-FR'),
      deliverer: order.deliveryDriver ? 'Assigné' : 'Non assigné',
      provider: order.provider ? order.provider.name : 'Restaurant',
      items: order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price
      }))
    }));

    res.status(200).json({
      orders: formattedOrders,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages
    });

  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des commandes',
      error:   error.message
    });
  }
};

// @desc    Update order status
// @route   PUT /api/dashboard/orders/:id/status
// @access  Private (Super Admin only)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['pending', 'confirmed', 'preparing', 'in_delivery', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Statut invalide',
        validStatuses
      });
    }

    const order = await Order.findById(id)
      .populate('client', 'firstName lastName phoneNumber')
      .populate('provider', 'name type phone address');

    if (!order) {
      return res.status(404).json({
        message: 'Commande non trouvée'
      });
    }

    order.status = status;
    await order.save();

    const formattedOrder = {
      id: order._id,
      orderNumber: order.orderNumber || `CMD-${order._id.toString().slice(-6).toUpperCase()}`,
      client: order.client ? `${order.client.firstName} ${order.client.lastName}` : 'Client inconnu',
      phone: order.client?.phoneNumber,
      address: order.deliveryAddress
        ? `${order.deliveryAddress.street || ''}, ${order.deliveryAddress.city || ''}`.replace(/, $/, '')
        : 'Adresse inconnue',
      total: `${order.totalAmount} DT`,
      solde: order.platformSolde ? `${order.platformSolde.toFixed(3)} DT` : '0.000 DT',
      status: order.status,
      date: new Date(order.createdAt).toLocaleDateString('fr-FR'),
      deliverer: order.deliveryDriver ? 'Assigné' : 'Non assigné',
      provider: order.provider ? order.provider.name : 'Restaurant',
      items: order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price
      }))
    };

    res.status(200).json({
      message: 'Statut mis à jour avec succès',
      order: formattedOrder
    });

  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      message: 'Erreur lors de la mise à jour du statut',
      error:   error.message
    });
  }
};

// @desc    Assign deliverer to order
// @route   PUT /api/dashboard/orders/:id/assign-deliverer
// @access  Private (Super Admin only)
exports.assignDeliverer = async (req, res) => {
  try {
    const { id } = req.params;
    const { delivererId } = req.body;
    
    const order = await Order.findById(id)
      .populate('client', 'firstName lastName phoneNumber')
      .populate('provider', 'name type phone address');

    if (!order) {
      return res.status(404).json({
        message: 'Commande non trouvée'
      });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({
        message: 'La commande ne peut pas être assignée dans son état actuel'
      });
    }

    order.deliveryDriver = delivererId;
    order.status = 'in_delivery';
    await order.save();

    const formattedOrder = {
      id: order._id,
      orderNumber: order.orderNumber || `CMD-${order._id.toString().slice(-6).toUpperCase()}`,
      client: order.client ? `${order.client.firstName} ${order.client.lastName}` : 'Client inconnu',
      phone: order.client?.phoneNumber,
      address: order.deliveryAddress
        ? `${order.deliveryAddress.street || ''}, ${order.deliveryAddress.city || ''}`.replace(/, $/, '')
        : 'Adresse inconnue',
      total: `${order.totalAmount} DT`,
      solde: order.platformSolde ? `${order.platformSolde.toFixed(3)} DT` : '0.000 DT',
      status: order.status,
      date: new Date(order.createdAt).toLocaleDateString('fr-FR'),
      deliverer: order.deliveryDriver ? 'Assigné' : 'Non assigné',
      provider: order.provider ? order.provider.name : 'Restaurant',
      items: order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price
      }))
    };

    res.status(200).json({
      message: 'Livreur assigné avec succès',
      order: formattedOrder
    });

  } catch (error) {
    console.error('Error assigning deliverer:', error);
    res.status(500).json({
      message: 'Erreur lors de l\'assignation du livreur',
      error:   error.message
    });
  }
};

// @desc    Get active deliverers
// @route   GET /api/dashboard/active-deliverers
// @access  Private (Super Admin only)
exports.getActiveDeliverers = async (req, res) => {
  try {
    const activeDeliverers = await User.find({
      role: 'deliverer',
      status: 'active'
    }).select('firstName lastName phoneNumber location');

    const formattedDeliverers = activeDeliverers.map(deliverer => ({
      id: deliverer._id,
      name: `${deliverer.firstName} ${deliverer.lastName}`,
      phone: deliverer.phoneNumber,
      location: deliverer.location,
      status: 'active'
    }));

    res.status(200).json(formattedDeliverers);

  } catch (error) {
    console.error('Error fetching active deliverers:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des livreurs actifs',
      error:   error.message
    });
  }
};