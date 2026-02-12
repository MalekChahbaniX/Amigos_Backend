const User = require('../models/User');
const Session = require('../models/Session');
const Order = require('../models/Order');
const City = require('../models/City');
const { generateUniqueSecurityCode } = require('../utils/securityCodeGenerator');

// Helper function to get admin city name
const getAdminCityName = async (adminUser) => {
  if (!adminUser.city) return null;
  
  try {
    const city = await City.findById(adminUser.city);
    return city ? city.name : null;
  } catch (error) {
    console.error('Error fetching city:', error);
    return null;
  }
};

/**
 * Normalise un numéro de téléphone tunisien
 * @param {string} phone - Le numéro de téléphone à normaliser
 * @returns {string|null} - Le numéro normalisé au format +216XXXXXXXX ou null si invalide
 */
function normalizePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    return null;
  }

  // Supprimer tous les caractères non numériques sauf le +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // Si le numéro commence déjà par +216, valider le format
  if (cleaned.startsWith('+216')) {
    // Vérifier que le reste fait 8 chiffres
    const rest = cleaned.substring(4);
    if (/^\d{8}$/.test(rest)) {
      return cleaned;
    }
    return null;
  }

  // Si le numéro commence par 216, ajouter le +
  if (cleaned.startsWith('216') && cleaned.length === 11) {
    return '+' + cleaned;
  }

  // Si le numéro fait 8 chiffres, ajouter +216
  if (/^\d{8}$/.test(cleaned)) {
    return '+216' + cleaned;
  }

  return null;
}

// @desc    Get all deliverers with optional search and pagination
// @route   GET /api/deliverers
// @access  Private (Super Admin only)
exports.getDeliverers = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 10 } = req.query;

    console.log('🔍 [DEBUG] getDeliverers called by:', req.user.role, 'with city:', req.user.city);
    console.log('🔍 [DEBUG] Search params:', { search, page, limit });

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
    // If the requester is a city admin, limit deliverers to their city
    if (req.user && req.user.role === 'admin') {
      if (!req.user.city) {
        return res.status(403).json({ message: 'Admin sans ville assignée' });
      }
      const adminCityName = await getAdminCityName(req.user);
      console.log('🔍 [DEBUG] Admin city name resolved to:', adminCityName);
      if (adminCityName) {
        searchQuery['location.city'] = adminCityName;
      }
    }

    console.log('🔍 [DEBUG] Final search query:', JSON.stringify(searchQuery, null, 2));

    // First, let's check what deliverers exist in total
    const allDeliverers = await User.find({ role: 'deliverer' }).select('firstName lastName location.city');
    console.log('🔍 [DEBUG] All deliverers in DB:', allDeliverers.map(d => ({ name: d.firstName + ' ' + d.lastName, city: d.location?.city })));

    const totalDeliverers = await User.countDocuments(searchQuery);
    console.log('🔍 [DEBUG] Total deliverers matching query:', totalDeliverers);

    // Get deliverers with pagination
    const deliverers = await User.find(searchQuery)
      .select('firstName lastName phoneNumber status createdAt securityCode location')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Format deliverers data for frontend
    const formattedDeliverers = deliverers.map(deliverer => ({
      id: deliverer._id.toString(),
      name: `${deliverer.firstName} ${deliverer.lastName}`.trim(),
      phone: deliverer.phoneNumber || '',
      securityCode: deliverer.securityCode || '',
      vehicle: 'Moto', // TODO: Add vehicle field to User model when needed
      currentOrders: 0, // TODO: Get from active orders when implemented
      totalDeliveries: 0, // TODO: Calculate from completed orders when implemented
      totalSolde: 0, // TODO: Calculate sum of platformSolde from delivered orders
      rating: 4.5, // TODO: Calculate from order ratings when implemented
      isActive: deliverer.status === 'active',
      location: deliverer.location?.address || deliverer.location?.city || 'Centre Ville'
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
      error:   error.message
    });
  }
};

// @desc    Get deliverer by ID
// @route   GET /api/deliverers/:id
// @access  Private (Super Admin only)
exports.getDelivererById = async (req, res) => {
  try {
    const query = { _id: req.params.id, role: 'deliverer' };
    if (req.user && req.user.role === 'admin') {
      if (!req.user.city) return res.status(403).json({ message: 'Admin sans ville assignée' });
      const adminCityName = await getAdminCityName(req.user);
      if (adminCityName) {
        query['location.city'] = adminCityName;
      }
    }

    const deliverer = await User.findOne(query).select('firstName lastName phoneNumber status createdAt location securityCode');

    if (!deliverer) {
      return res.status(404).json({ message: 'Livreur non trouvé' });
    }

    const formattedDeliverer = {
      id: deliverer._id.toString(),
      name: `${deliverer.firstName} ${deliverer.lastName}`.trim(),
      phone: deliverer.phoneNumber || '',
      securityCode: deliverer.securityCode || '',
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
      error:   error.message
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

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      return res.status(400).json({
        message: 'Numéro de téléphone invalide. Format requis: +216XXXXXXXX ou 28653000'
      });
    }

    // Split name into firstName and lastName
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Check if any user already exists with this phone number
    const existingUser = await User.findOne({
      phoneNumber: normalizedPhone
    });

    if (existingUser) {
      return res.status(400).json({
        message: `Ce numéro de téléphone est déjà utilisé pour un compte de type ${existingUser.role || 'utilisateur'}`
      });
    }

    // Generate unique security code with retry logic
    let securityCode;
    try {
      securityCode = await generateUniqueSecurityCode('deliverer', 5);
      console.log(`🔐 [Deliverer] Generated security code for new deliverer: ${securityCode}`);
    } catch (codeError) {
      console.error('Erreur génération code de sécurité:', codeError.message);
      return res.status(500).json({
        message: 'Impossible de générer un code de sécurité unique. Veuillez réessayer.'
      });
    }

    // Create new deliverer
    const newDelivererData = {
      firstName,
      lastName,
      phoneNumber: normalizedPhone,
      securityCode: securityCode,
      role: 'deliverer',
      status: 'active',
      isVerified: true // Auto-verify deliverers created by admin
    };

    // If creator is an admin, associate deliverer to the same city
    if (req.user && req.user.role === 'admin') {
      if (!req.user.city) return res.status(403).json({ message: 'Admin sans ville assignée' });
      const adminCityName = await getAdminCityName(req.user);
      if (adminCityName) {
        newDelivererData['location.city'] = adminCityName;
      }
    }

    const deliverer = await User.create(newDelivererData);

    const formattedDeliverer = {
      id: deliverer._id.toString(),
      name: `${deliverer.firstName} ${deliverer.lastName}`.trim(),
      phone: deliverer.phoneNumber,
      securityCode: deliverer.securityCode,
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
      error:   error.message
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

    const query = { _id: req.params.id, role: 'deliverer' };
    if (req.user && req.user.role === 'admin') {
      if (!req.user.city) return res.status(403).json({ message: 'Admin sans ville assignée' });
      const adminCityName = await getAdminCityName(req.user);
      if (adminCityName) {
        query['location.city'] = adminCityName;
      }
    }

    const deliverer = await User.findOneAndUpdate(query, { status }, { new: true });

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
      error:   error.message
    });
  }
};

// @desc    Delete deliverer
// @route   DELETE /api/deliverers/:id
// @access  Private (Super Admin only)
exports.deleteDeliverer = async (req, res) => {
  try {
    const query = { _id: req.params.id, role: 'deliverer' };
    if (req.user && req.user.role === 'admin') {
      if (!req.user.city) return res.status(403).json({ message: 'Admin sans ville assignée' });
      const adminCityName = await getAdminCityName(req.user);
      if (adminCityName) {
        query['location.city'] = adminCityName;
      }
    }

    const deliverer = await User.findOneAndDelete(query);

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
      error:   error.message
    });
  }
}

// @desc    Regenerate security code for a deliverer
// @route   PUT /api/deliverers/:id/regenerate-security-code
// @access  Private (Super Admin and Admin only)
exports.regenerateSecurityCode = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    const adminRole = req.user.role;

    // Find the deliverer
    let deliverer = await User.findOne({
      _id: id,
      role: 'deliverer'
    });

    if (!deliverer) {
      return res.status(404).json({ message: 'Livreur non trouvé' });
    }

    // If admin (not superAdmin), verify the deliverer belongs to the admin's city
    if (adminRole === 'admin') {
      const adminCityName = await getAdminCityName(req.user);
      const delivererCityName = deliverer.location?.city;
      if (!delivererCityName || delivererCityName !== adminCityName) {
        return res.status(403).json({ message: 'Accès non autorisé à ce livreur' });
      }
    }

    // Store old code (masked) for logging
    const oldCodeMasked = deliverer.securityCode ? deliverer.securityCode.substring(0, 2) + '****' : 'N/A';

    // Generate new unique security code
    const { generateUniqueSecurityCode } = require('../utils/securityCodeGenerator');
    const newSecurityCode = await generateUniqueSecurityCode('deliverer', 5);

    // Mask new code for logging (first 2 chars + ****)
    const newCodeMasked = newSecurityCode.substring(0, 2) + '****';

    // Update the deliverer with new security code
    deliverer = await User.findOneAndUpdate(
      { _id: id, role: 'deliverer' },
      { securityCode: newSecurityCode },
      { new: true }
    );

    // Log the regeneration event for audit (without exposing the new code in plaintext)
    console.log(`🔐 [Security] Deliverer security code regenerated - Deliverer: ${id}, Old: ${oldCodeMasked}, New: ${newCodeMasked}, Admin: ${adminId}`);

    res.status(200).json({
      message: 'Code de sécurité régénéré avec succès',
      securityCode: newSecurityCode
    });

  } catch (error) {
    console.error('Error regenerating security code:', error);
    res.status(500).json({
      message: 'Erreur lors de la régénération du code de sécurité',
      error: error.message
    });
  }
}

// @desc    Get all deliverer sessions (admin only)
// @route   GET /api/deliverers/sessions
// @access  Private (Super Admin and Admin only)
exports.getDelivererSessions = async (req, res) => {
  try {
    const { page = 1, limit = 50, active } = req.query;
    
    // Build query
    const query = {};
    
    // Filter by active status if provided
    if (active !== undefined) {
      query.active = active === '1' || active === 'true';
    }
    
    // If the requester is a city admin, limit sessions to deliverers in their city
    if (req.user && req.user.role === 'admin') {
      if (!req.user.city) {
        return res.status(403).json({ message: 'Admin sans ville assignée' });
      }
      const adminCityName = await getAdminCityName(req.user);
      if (adminCityName) {
        // Find deliverers in the admin's city
        const delivererIds = await User.find({
          role: 'deliverer',
          'location.city': adminCityName
        }).select('_id');
        
        if (delivererIds.length === 0) {
          return res.status(200).json({
            sessions: [],
            total: 0,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: 0
          });
        }
        
        query.deliverer = { $in: delivererIds.map(d => d._id) };
      } else {
        // If no city name found, return empty
        return res.status(200).json({
          sessions: [],
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0
        });
      }
    }
    
    // Get total count
    const totalSessions = await Session.countDocuments(query);
    
    // Get sessions with pagination
    const sessions = await Session.find(query)
      .populate('deliverer', 'firstName lastName phoneNumber')
      .sort({ startTime: -1 })
      .limit(parseInt(limit) * 1)
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    // Format sessions for frontend
    const formattedSessions = sessions.map(session => ({
      id: session._id.toString(),
      deliverer: session.deliverer ? {
        id: session.deliverer._id.toString(),
        name: `${session.deliverer.firstName} ${session.deliverer.lastName}`.trim(),
        phone: session.deliverer.phoneNumber || ''
      } : null,
      startTime: session.startTime,
      endTime: session.endTime,
      active: session.active
    }));
    
    res.status(200).json({
      sessions: formattedSessions,
      total: totalSessions,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalSessions / limit)
    });
    
  } catch (error) {
    console.error('Error fetching deliverer sessions:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des sessions',
      error: error.message
    });
  }
};

// @desc    Get deliverer earnings (total solde from delivered orders)
// @route   GET /api/deliverers/:id/earnings
// @access  Private (Super Admin only)
exports.getDelivererEarnings = async (req, res) => {
  try {
    const delivererId = req.params.id;
    
    // Validate deliverer exists
    const query = { _id: delivererId, role: 'deliverer' };
    if (req.user && req.user.role === 'admin') {
      if (!req.user.city) return res.status(403).json({ message: 'Admin sans ville assignée' });
      const adminCityName = await getAdminCityName(req.user);
      if (adminCityName) {
        query['location.city'] = adminCityName;
      }
    }

    const deliverer = await User.findOne(query);
    
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
      error:   error.message
    });
  }
};
// @desc    Get deliverer daily balance (admin access)
// @route   GET /api/deliverers/:id/balance
// @access  Private (Admin/SuperAdmin)
exports.getDelivererBalance = async (req, res) => {
  try {
    const delivererId = req.params.id;
    const { date } = req.query; // Optional YYYY-MM-DD format
    
    // Build query with role check
    const query = { _id: delivererId, role: 'deliverer' };
    if (req.user && req.user.role === 'admin') {
      if (!req.user.city) return res.status(403).json({ message: 'Admin sans ville assignée' });
      const adminCityName = await getAdminCityName(req.user);
      if (adminCityName) {
        query['location.city'] = adminCityName;
      }
    }
    
    // Fetch deliverer with dailyBalance populated
    const deliverer = await User.findOne(query)
      .select('firstName lastName phoneNumber dailyBalance')
      .populate('dailyBalance.orders', 'orderNumber totalPrice status');
    
    if (!deliverer) {
      return res.status(404).json({ message: 'Livreur non trouvé' });
    }
    
    // If date specified, filter to that date
    let balanceData = deliverer.dailyBalance || [];
    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      balanceData = balanceData.filter(entry => {
        const entryDate = new Date(entry.date);
        entryDate.setHours(0, 0, 0, 0);
        return entryDate.getTime() === targetDate.getTime();
      });
    }
    
    // Calculate totals
    const totalSoldeAmigos = balanceData.reduce((sum, entry) => sum + (entry.soldeAmigos || 0), 0);
    const totalSoldeAnnulation = balanceData.reduce((sum, entry) => sum + (entry.soldeAnnulation || 0), 0);
    const netBalance = totalSoldeAmigos - totalSoldeAnnulation;
    const totalOrders = balanceData.reduce((sum, entry) => sum + (entry.orders?.length || 0), 0);
    
    res.status(200).json({
      deliverer: {
        id: deliverer._id.toString(),
        name: `${deliverer.firstName} ${deliverer.lastName}`.trim(),
        phone: deliverer.phoneNumber
      },
      balance: {
        cashIn: totalSoldeAmigos.toFixed(3),
        cashOut: totalSoldeAnnulation.toFixed(3),
        netBalance: netBalance.toFixed(3),
        totalOrders,
        entries: balanceData.map(entry => ({
          date: entry.date,
          soldeAmigos: entry.soldeAmigos,
          soldeAnnulation: entry.soldeAnnulation,
          paid: entry.paid,
          paidAt: entry.paidAt,
          ordersCount: entry.orders?.length || 0
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching deliverer balance:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération de la balance',
      error: error.message
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
    const query = { _id: delivererId, role: 'deliverer' };
    if (req.user && req.user.role === 'admin') {
      if (!req.user.city) return res.status(403).json({ message: 'Admin sans ville assignée' });
      const adminCityName = await getAdminCityName(req.user);
      if (adminCityName) {
        query['location.city'] = adminCityName;
      }
    }

    const deliverer = await User.findOne(query);
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
      error:   error.message
    });
  }};