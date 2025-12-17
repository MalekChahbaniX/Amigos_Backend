const User = require('../models/User');

// @desc    Get all clients with optional search
// @route   GET /api/clients
// @access  Private (Super Admin only)
exports.getClients = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 10 } = req.query;

    // Build search query
    const searchQuery = {};
    if (search) {
      searchQuery.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Add role filter for clients only
    searchQuery.role = 'client';

    // Get total count for pagination
    const totalClients = await User.countDocuments(searchQuery);

    // Get clients with pagination
    const clients = await User.find(searchQuery)
      .select('firstName lastName phoneNumber email status createdAt')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Format clients data for frontend
    const formattedClients = clients.map(client => ({
      id: client._id.toString(),
      name: `${client.firstName} ${client.lastName}`.trim(),
      phone: client.phoneNumber || '',
      email: client.email || '',
      totalOrders: 0, // TODO: Get from orders collection when implemented
      totalSpent: '0.00 DT', // TODO: Calculate from orders when implemented
      status: client.status,
      joinDate: new Date(client.createdAt).toLocaleDateString('fr-FR')
    }));

    // Add cache-busting headers
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    res.status(200).json({
      clients: formattedClients,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalClients / limit),
        totalClients,
        hasNextPage: page < Math.ceil(totalClients / limit),
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des clients',
      error:   error.message
    });
  }
};

// @desc    Get client by ID
// @route   GET /api/clients/:id
// @access  Private (Super Admin only)
exports.getClientById = async (req, res) => {
  try {
    const client = await User.findOne({
      _id: req.params.id,
      role: 'client'
    }).select('firstName lastName phoneNumber email status createdAt location');

    if (!client) {
      return res.status(404).json({ message: 'Client non trouvé' });
    }

    const formattedClient = {
      id: client._id.toString(),
      name: `${client.firstName} ${client.lastName}`.trim(),
      phone: client.phoneNumber || '',
      email: client.email || '',
      status: client.status,
      joinDate: new Date(client.createdAt).toLocaleDateString('fr-FR'),
      address: client.location?.address || '',
      totalOrders: 0, // TODO: Get from orders collection
      totalSpent: '0.00 DT' // TODO: Calculate from orders
    };

    res.status(200).json(formattedClient);

  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération du client',
      error:   error.message
    });
  }
};

// @desc    Create new client
// @route   POST /api/clients
// @access  Private (Super Admin only)
exports.createClient = async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;

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

    // Check if client already exists
    const orConditions = [{ phoneNumber: phone }];
    if (email) {
      orConditions.push({ email: email.toLowerCase() });
    }

    const existingClient = await User.findOne({
      $or: orConditions
    });

    if (existingClient) {
      return res.status(400).json({
        message: 'Un client avec ce téléphone ou email existe déjà'
      });
    }

    // Create new client
    const client = await User.create({
      firstName,
      lastName,
      phoneNumber: phone,
      ...(email && { email: email.toLowerCase() }),
      ...(address && { 'location.address': address }),
      role: 'client',
      status: 'active',
      isVerified: true // Auto-verify clients created by admin
    });

    const formattedClient = {
      id: client._id.toString(),
      name: `${client.firstName} ${client.lastName}`.trim(),
      phone: client.phoneNumber,
      email: client.email || '',
      status: client.status,
      joinDate: new Date(client.createdAt).toLocaleDateString('fr-FR'),
      address: client.location?.address || '',
      totalOrders: 0,
      totalSpent: '0.00 DT'
    };

    res.status(201).json({
      message: 'Client créé avec succès',
      client: formattedClient
    });

  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({
      message: 'Erreur lors de la création du client',
      error:   error.message
    });
  }
};

// @desc    Update client status
// @route   PATCH /api/clients/:id/status
// @access  Private (Super Admin only)
exports.updateClientStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        message: 'Statut invalide. Utilisez "active" ou "inactive"'
      });
    }

    const client = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'client' },
      { status },
      { new: true }
    );

    if (!client) {
      return res.status(404).json({ message: 'Client non trouvé' });
    }

    res.status(200).json({
      message: 'Statut du client mis à jour avec succès',
      client: {
        id: client._id.toString(),
        status: client.status
      }
    });

  } catch (error) {
    console.error('Error updating client status:', error);
    res.status(500).json({
      message: 'Erreur lors de la mise à jour du statut',
      error:   error.message
    });
  }
};

// @desc    Delete client
// @route   DELETE /api/clients/:id
// @access  Private (Super Admin only)
exports.deleteClient = async (req, res) => {
  try {
    const client = await User.findOneAndDelete({
      _id: req.params.id,
      role: 'client'
    });

    if (!client) {
      return res.status(404).json({ message: 'Client non trouvé' });
    }

    res.status(200).json({
      message: 'Client supprimé avec succès'
    });

  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({
      message: 'Erreur lors de la suppression du client',
      error:   error.message
    });
  }
};