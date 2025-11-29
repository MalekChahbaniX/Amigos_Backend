const User = require('../models/User');

// @desc    Get all deliverers with optional search and pagination
// @route   GET /api/deliverers
// @access  Private (Super Admin only)
exports.getDeliverers = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 10 } = req.query;

    // Build search query
    const searchQuery = {};
    if (search) {
      searchQuery.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // Add role filter for deliverers only
    searchQuery.role = 'deliverer';

    // Get total count for pagination
    const totalDeliverers = await User.countDocuments(searchQuery);

    // Get deliverers with pagination
    const deliverers = await User.find(searchQuery)
      .select('firstName lastName phoneNumber status createdAt')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Format deliverers data for frontend
    const formattedDeliverers = deliverers.map(deliverer => ({
      id: deliverer._id.toString(),
      name: `${deliverer.firstName} ${deliverer.lastName}`.trim(),
      phone: deliverer.phoneNumber || '',
      vehicle: 'Moto', // TODO: Add vehicle field to User model when needed
      currentOrders: 0, // TODO: Get from active orders when implemented
      totalDeliveries: 0, // TODO: Calculate from completed orders when implemented
      totalSolde: 0, // TODO: Calculate sum of platformSolde from delivered orders
      rating: 4.5, // TODO: Calculate from order ratings when implemented
      isActive: deliverer.status === 'active',
      location: 'Centre Ville' // TODO: Add location field to User model when needed
    }));

    // Add cache-busting headers
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    res.status(200).json({
      deliverers: formattedDeliverers,
      total: totalDeliverers,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalDeliverers / limit)
    });

  } catch (error) {
    console.error('Error fetching deliverers:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des livreurs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get deliverer by ID
// @route   GET /api/deliverers/:id
// @access  Private (Super Admin only)
exports.getDelivererById = async (req, res) => {
  try {
    const deliverer = await User.findOne({
      _id: req.params.id,
      role: 'deliverer'
    }).select('firstName lastName phoneNumber status createdAt location');

    if (!deliverer) {
      return res.status(404).json({ message: 'Livreur non trouvé' });
    }

    const formattedDeliverer = {
      id: deliverer._id.toString(),
      name: `${deliverer.firstName} ${deliverer.lastName}`.trim(),
      phone: deliverer.phoneNumber || '',
      vehicle: 'Moto', // TODO: Add vehicle field when needed
      currentOrders: 0,
      totalDeliveries: 0,
      totalSolde: 0,
      rating: 4.5,
      isActive: deliverer.status === 'active',
      location: deliverer.location?.address || 'Centre Ville'
    };

    res.status(200).json(formattedDeliverer);

  } catch (error) {
    console.error('Error fetching deliverer:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération du livreur',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Create new deliverer
// @route   POST /api/deliverers
// @access  Private (Super Admin only)
exports.createDeliverer = async (req, res) => {
  try {
    const { name, phone, vehicle, location } = req.body;

    // Validation
    if (!name || !phone) {
      return res.status(400).json({
        message: 'Nom et téléphone sont requis'
      });
    }

    // Split name into firstName and lastName
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Check if deliverer already exists
    const existingDeliverer = await User.findOne({
      phoneNumber: phone,
      role: 'deliverer'
    });

    if (existingDeliverer) {
      return res.status(400).json({
        message: 'Un livreur avec ce téléphone existe déjà'
      });
    }

    // Create new deliverer
    const deliverer = await User.create({
      firstName,
      lastName,
      phoneNumber: phone,
      role: 'deliverer',
      status: 'active',
      isVerified: true // Auto-verify deliverers created by admin
    });

    const formattedDeliverer = {
      id: deliverer._id.toString(),
      name: `${deliverer.firstName} ${deliverer.lastName}`.trim(),
      phone: deliverer.phoneNumber,
      vehicle: vehicle || 'Moto',
      currentOrders: 0,
      totalDeliveries: 0,
      rating: 4.5,
      isActive: deliverer.status === 'active',
      location: location || 'Centre Ville'
    };

    res.status(201).json({
      message: 'Livreur créé avec succès',
      deliverer: formattedDeliverer
    });

  } catch (error) {
    console.error('Error creating deliverer:', error);
    res.status(500).json({
      message: 'Erreur lors de la création du livreur',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update deliverer status (active/inactive)
// @route   PUT /api/deliverers/:id/status
// @access  Private (Super Admin only)
exports.updateDelivererStatus = async (req, res) => {
  try {
    const { isAvailable } = req.body;

    if (typeof isAvailable !== 'boolean') {
      return res.status(400).json({
        message: 'Statut isAvailable doit être un booléen'
      });
    }

    const status = isAvailable ? 'active' : 'inactive';

    const deliverer = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'deliverer' },
      { status },
      { new: true }
    );

    if (!deliverer) {
      return res.status(404).json({ message: 'Livreur non trouvé' });
    }

    res.status(200).json({
      message: 'Statut du livreur mis à jour avec succès',
      deliverer: {
        id: deliverer._id.toString(),
        isActive: deliverer.status === 'active'
      }
    });

  } catch (error) {
    console.error('Error updating deliverer status:', error);
    res.status(500).json({
      message: 'Erreur lors de la mise à jour du statut',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Delete deliverer
// @route   DELETE /api/deliverers/:id
// @access  Private (Super Admin only)
exports.deleteDeliverer = async (req, res) => {
  try {
    const deliverer = await User.findOneAndDelete({
      _id: req.params.id,
      role: 'deliverer'
    });

    if (!deliverer) {
      return res.status(404).json({ message: 'Livreur non trouvé' });
    }

    res.status(200).json({
      message: 'Livreur supprimé avec succès'
    });

  } catch (error) {
    console.error('Error deleting deliverer:', error);
    res.status(500).json({
      message: 'Erreur lors de la suppression du livreur',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
// @desc    Get deliverer earnings (total solde from delivered orders)
// @route   GET /api/deliverers/:id/earnings
// @access  Private (Super Admin only)
exports.getDelivererEarnings = async (req, res) => {
  try {
    const delivererId = req.params.id;
    
    // Validate deliverer exists
    const deliverer = await User.findOne({
      _id: delivererId,
      role: 'deliverer'
    });
    
    if (!deliverer) {
      return res.status(404).json({ message: 'Livreur non trouvé' });
    }

    // Calculate total solde from delivered orders
    const earningsResult = await Order.aggregate([
      {
        $match: {
          deliveryDriver: delivererId,
          status: { $in: ['delivered', 'completed'] }
        }
      },
      {
        $group: {
          _id: null,
          totalSolde: { $sum: '$platformSolde' },
          orderCount: { $sum: 1 }
        }
      }
    ]);

    const totalSolde = earningsResult.length > 0 ? earningsResult[0].totalSolde : 0;
    const orderCount = earningsResult.length > 0 ? earningsResult[0].orderCount : 0;

    res.status(200).json({
      delivererId,
      totalSolde: totalSolde.toFixed(3),
      orderCount,
      averageSolde: orderCount > 0 ? (totalSolde / orderCount).toFixed(3) : '0.000'
    });

  } catch (error) {
    console.error('Error fetching deliverer earnings:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des gains du livreur',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get deliverer detailed statistics
// @route   GET /api/deliverers/:id/stats
// @access  Private (Super Admin only)
exports.getDelivererStats = async (req, res) => {
  try {
    const delivererId = req.params.id;
    
    // Validate deliverer exists
    const deliverer = await User.findOne({
      _id: delivererId,
      role: 'deliverer'
    });
    
    if (!deliverer) {
      return res.status(404).json({ message: 'Livreur non trouvé' });
    }

    // Get deliverer stats
    const statsResult = await Order.aggregate([
      {
        $match: {
          deliveryDriver: delivererId
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Convert to stats object
    const stats = statsResult.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const totalOrders = statsResult.reduce((sum, item) => sum + item.count, 0);

    res.status(200).json({
      delivererId,
      totalOrders,
      stats,
      pending: stats.pending || 0,
      inDelivery: stats.in_delivery || 0,
      delivered: stats.delivered || 0,
      cancelled: stats.cancelled || 0
    });

  } catch (error) {
    console.error('Error fetching deliverer stats:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des statistiques du livreur',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }};