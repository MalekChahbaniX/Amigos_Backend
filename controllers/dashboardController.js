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
    // For now, return mock data since deliverer role might not be implemented yet
    // In a real implementation, you would fetch actual deliverer data
    const activeDeliverers = [
      {
        id: '1',
        name: 'Ahmed Ben Ali',
        orders: 5,
        status: 'active'
      },
      {
        id: '2',
        name: 'Mohamed Triki',
        orders: 3,
        status: 'active'
      },
      {
        id: '3',
        name: 'Fatma Gharbi',
        orders: 7,
        status: 'active'
      }
    ];

    res.status(200).json(activeDeliverers);

  } catch (error) {
    console.error('Error fetching active deliverers:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des livreurs actifs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};