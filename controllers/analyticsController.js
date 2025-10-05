const User = require('../models/User');
const Provider = require('../models/Provider');
const Product = require('../models/Product');
const Order = require('../models/Order');

// @desc    Get comprehensive analytics data
// @route   GET /api/analytics/overview
// @access  Private (Super Admin only)
exports.getAnalyticsOverview = async (req, res) => {
  try {
    const { period = '30' } = req.query; // Default to 30 days
    const days = parseInt(period);
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

    // Basic counts
    const totalClients = await User.countDocuments({ role: 'client' });
    const totalProviders = await Provider.countDocuments({});
    const totalProducts = await Product.countDocuments({});
    const totalDeliverers = await User.countDocuments({ role: 'deliverer' });

    // Active users (last 30 days)
    const activeClients = await User.countDocuments({
      role: 'client',
      lastLogin: { $gte: startDate }
    });

    // Revenue and orders data
    const ordersData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Top performing providers
    const topProviders = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $in: ['delivered', 'completed'] }
        }
      },
      {
        $group: {
          _id: '$providerId',
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' }
        }
      },
      {
        $lookup: {
          from: 'providers',
          localField: '_id',
          foreignField: '_id',
          as: 'provider'
        }
      },
      {
        $unwind: '$provider'
      },
      {
        $project: {
          name: '$provider.name',
          type: '$provider.type',
          totalOrders: 1,
          totalRevenue: 1
        }
      },
      {
        $sort: { totalRevenue: -1 }
      },
      {
        $limit: 10
      }
    ]);

    // Popular products
    const popularProducts = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $unwind: '$items'
      },
      {
        $group: {
          _id: '$items.productId',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      {
        $unwind: '$product'
      },
      {
        $project: {
          name: '$product.name',
          category: '$product.category',
          totalQuantity: 1,
          totalRevenue: 1
        }
      },
      {
        $sort: { totalQuantity: -1 }
      },
      {
        $limit: 10
      }
    ]);

    // Client growth over time
    const clientGrowth = await User.aggregate([
      {
        $match: {
          role: 'client',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Provider type distribution
    const providerTypes = await Provider.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    // Product category distribution
    const productCategories = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    // Daily revenue for the period
    const dailyRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $in: ['delivered', 'completed'] }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Add cache-busting headers
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    res.status(200).json({
      overview: {
        totalClients,
        totalProviders,
        totalProducts,
        totalDeliverers,
        activeClients,
        period: `${days} days`
      },
      charts: {
        ordersData,
        clientGrowth,
        dailyRevenue
      },
      insights: {
        topProviders,
        popularProducts,
        providerTypes,
        productCategories
      }
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des analyses',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get revenue analytics
// @route   GET /api/analytics/revenue
// @access  Private (Super Admin only)
exports.getRevenueAnalytics = async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

    // Total revenue
    const totalRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $in: ['delivered', 'completed'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' },
          average: { $avg: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Revenue by provider type
    const revenueByProviderType = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $in: ['delivered', 'completed'] }
        }
      },
      {
        $lookup: {
          from: 'providers',
          localField: 'providerId',
          foreignField: '_id',
          as: 'provider'
        }
      },
      {
        $unwind: '$provider'
      },
      {
        $group: {
          _id: '$provider.type',
          totalRevenue: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 }
        }
      }
    ]);

    // Monthly revenue comparison (if we have enough data)
    const monthlyRevenue = await Order.aggregate([
      {
        $match: {
          status: { $in: ['delivered', 'completed'] }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      },
      {
        $limit: 12 // Last 12 months
      }
    ]);

    res.status(200).json({
      totalRevenue: totalRevenue[0] || { total: 0, average: 0, count: 0 },
      revenueByProviderType,
      monthlyRevenue,
      period: `${days} days`
    });

  } catch (error) {
    console.error('Error fetching revenue analytics:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des analyses de revenus',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get user analytics
// @route   GET /api/analytics/users
// @access  Private (Super Admin only)
exports.getUserAnalytics = async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

    // User registration trends
    const userRegistrations = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          clients: {
            $sum: { $cond: [{ $eq: ['$role', 'client'] }, 1, 0] }
          },
          deliverers: {
            $sum: { $cond: [{ $eq: ['$role', 'deliverer'] }, 1, 0] }
          },
          providers: {
            $sum: { $cond: [{ $eq: ['$role', 'provider'] }, 1, 0] }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // User status distribution
    const userStatusDistribution = await User.aggregate([
      {
        $group: {
          _id: { role: '$role', status: '$status' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Active vs inactive users
    const userActivity = await User.aggregate([
      {
        $facet: {
          activeClients: [
            { $match: { role: 'client', status: 'active' } },
            { $count: 'count' }
          ],
          inactiveClients: [
            { $match: { role: 'client', status: 'inactive' } },
            { $count: 'count' }
          ],
          activeDeliverers: [
            { $match: { role: 'deliverer', status: 'active' } },
            { $count: 'count' }
          ],
          inactiveDeliverers: [
            { $match: { role: 'deliverer', status: 'inactive' } },
            { $count: 'count' }
          ]
        }
      }
    ]);

    res.status(200).json({
      userRegistrations,
      userStatusDistribution,
      userActivity: userActivity[0] || {},
      period: `${days} days`
    });

  } catch (error) {
    console.error('Error fetching user analytics:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des analyses utilisateurs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get product analytics
// @route   GET /api/analytics/products
// @access  Private (Super Admin only)
exports.getProductAnalytics = async (req, res) => {
  try {
    // Product status distribution
    const productStatusDistribution = await Product.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Products by category
    const productsByCategory = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          averagePrice: { $avg: '$price' }
        }
      }
    ]);

    // Low stock alerts
    const lowStockProducts = await Product.find({
      stock: { $lte: 10, $gt: 0 }
    })
    .populate('provider', 'name')
    .sort({ stock: 1 })
    .limit(20);

    // Out of stock products
    const outOfStockProducts = await Product.find({
      $or: [
        { stock: 0 },
        { status: 'out_of_stock' }
      ]
    })
    .populate('provider', 'name')
    .sort({ updatedAt: -1 })
    .limit(20);

    // Top selling products (based on orders)
    const topSellingProducts = await Order.aggregate([
      {
        $unwind: '$items'
      },
      {
        $group: {
          _id: '$items.productId',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      {
        $unwind: '$product'
      },
      {
        $project: {
          name: '$product.name',
          category: '$product.category',
          totalQuantity: 1,
          totalRevenue: 1
        }
      },
      {
        $sort: { totalQuantity: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.status(200).json({
      productStatusDistribution,
      productsByCategory,
      lowStockProducts: lowStockProducts.map(p => ({
        id: p._id.toString(),
        name: p.name,
        stock: p.stock,
        provider: p.provider ? p.provider.name : 'N/A'
      })),
      outOfStockProducts: outOfStockProducts.map(p => ({
        id: p._id.toString(),
        name: p.name,
        stock: p.stock,
        provider: p.provider ? p.provider.name : 'N/A'
      })),
      topSellingProducts
    });

  } catch (error) {
    console.error('Error fetching product analytics:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des analyses produits',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};