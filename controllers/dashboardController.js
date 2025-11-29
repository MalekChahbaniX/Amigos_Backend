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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      .populate('clientId', 'firstName lastName')
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};