const User = require('../models/User');
const Zone = require('../models/Zone');
const { calculateDistance } = require('../utils/distanceCalculator');

const assignZoneForUser = async (userId, latitude, longitude) => {
  try {
    // Point de référence (centre-ville Tunis ou votre point de départ)
    const ORIGIN_LAT = 33.805654;
    const ORIGIN_LON = 10.990039;

    // Calculer la distance entre l'utilisateur et le point d'origine
    const distance = calculateDistance(ORIGIN_LAT, ORIGIN_LON, latitude, longitude);
    
    console.log(`Distance calculée pour l'utilisateur ${userId}: ${distance.toFixed(2)} km`);

    // Trouver la zone appropriée basée sur la distance
    const zone = await Zone.findOne({
      minDistance: { $lte: distance },
      maxDistance: { $gte: distance }
    }).sort({ number: 1 });

    if (zone) {
      console.log(`Zone trouvée: Zone ${zone.number} (${zone.minDistance}-${zone.maxDistance} km) - Prix: ${zone.price} TND`);
      
      // Mettre à jour l'utilisateur avec la zone trouvée
      await User.findByIdAndUpdate(userId, {
        'location.zone': zone._id,
        'location.zoneName': `Zone ${zone.number}`,
        'location.deliveryPrice': zone.price,
        'location.distance': parseFloat(distance.toFixed(2))
      });

      return {
        zoneId: zone._id,
        zoneNumber: zone.number,
        zoneName: `Zone ${zone.number}`,
        deliveryPrice: zone.price,
        distance: parseFloat(distance.toFixed(2))
      };
    } else {
      console.log('Aucune zone trouvée pour cette distance');
      return null;
    }
  } catch (error) {
    console.error('Erreur lors de l\'attribution de la zone:', error);
    return null;
  }
};

// @desc Get current user profile
// @route GET /api/settings/profile
// @access Private
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;

    if (!userId) {
      return res.status(400).json({ message: 'ID utilisateur requis' });
    }

    const user = await User.findById(userId)
      .select('firstName lastName email phoneNumber role status location')
      .populate('location.zone', 'number minDistance maxDistance price');

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    res.status(200).json({
      profile: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        status: user.status,
        location: user.location
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération du profil',
      error:   error.message
    });
  }
};

// @desc Update user profile
// @route PUT /api/settings/profile
// @access Private
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber } = req.body;
    const userId = req.user?.id || req.body.userId;

    if (!userId) {
      return res.status(400).json({ message: 'ID utilisateur requis' });
    }

    // Check if email is already taken by another user
    if (email) {
      const existingUser = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: userId }
      });

      if (existingUser) {
        return res.status(400).json({ message: 'Cet email est déjà utilisé' });
      }
    }

    // Check if phone is already taken by another user
    if (phoneNumber) {
      const existingUser = await User.findOne({
        phoneNumber,
        _id: { $ne: userId }
      });

      if (existingUser) {
        return res.status(400).json({ message: 'Ce numéro de téléphone est déjà utilisé' });
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(email && { email: email.toLowerCase() }),
        ...(phoneNumber && { phoneNumber })
      },
      { new: true }
    ).select('firstName lastName email phoneNumber role status');

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    res.status(200).json({
      message: 'Profil mis à jour avec succès',
      profile: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      message: 'Erreur lors de la mise à jour du profil',
      error:   error.message
    });
  }
};

// @desc Update user location
// @route PUT /api/settings/location
// @access Private
exports.updateLocation = async (req, res) => {
  try {
    const { location } = req.body;
    const userId = req.user?.id || req.body.userId;

    if (!userId) {
      return res.status(400).json({ message: 'ID utilisateur requis' });
    }

    if (!location || typeof location !== 'object') {
      return res.status(400).json({ message: 'Données de localisation invalides' });
    }

    const { latitude, longitude, address } = location;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: 'Latitude et longitude requises' });
    }

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ message: 'Latitude et longitude doivent être des nombres' });
    }

    // Mettre à jour la localisation
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'location.latitude': latitude,
          'location.longitude': longitude,
          ...(address && { 'location.address': address })
        }
      },
      { new: true }
    ).select('firstName lastName email phoneNumber role status location');

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Attribuer la zone automatiquement
    const zoneInfo = await assignZoneForUser(userId, latitude, longitude);

    // Récupérer l'utilisateur mis à jour avec la zone
    const updatedUser = await User.findById(userId)
      .select('location')
      .populate('location.zone', 'number minDistance maxDistance price');

    res.status(200).json({
      message: 'Localisation mise à jour avec succès',
      location: updatedUser.location,
      zoneInfo: zoneInfo
    });
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({
      message: 'Erreur lors de la mise à jour de la localisation',
      error:   error.message
    });
  }
};

// @desc Change user password
// @route PUT /api/settings/password
// @access Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id || req.body.userId;

    if (!userId) {
      return res.status(400).json({ message: 'ID utilisateur requis' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: 'Mot de passe actuel et nouveau mot de passe requis'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: 'Le nouveau mot de passe doit contenir au moins 6 caractères'
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // TODO: Implémenter la vérification du mot de passe actuel avec bcrypt
    // const isMatch = await bcrypt.compare(currentPassword, user.password);
    // if (!isMatch) {
    //   return res.status(400).json({ message: 'Mot de passe actuel incorrect' });
    // }

    // Hash the new password (vous devriez utiliser bcrypt ici)
    // const hashedPassword = await bcrypt.hash(newPassword, 10);
    const hashedPassword = newPassword; // Temporaire - à remplacer

    await User.findByIdAndUpdate(userId, {
      password: hashedPassword
    });

    res.status(200).json({
      message: 'Mot de passe changé avec succès'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({
      message: 'Erreur lors du changement de mot de passe',
      error:   error.message
    });
  }
};

// @desc Get application settings
// @route GET /api/settings/app
// @access Private
exports.getAppSettings = async (req, res) => {
  try {
    const appSettings = {
      businessName: 'AMIGOS Delivery',
      businessDescription: 'Plateforme de livraison tout-en-un',
      contactEmail: 'contact@amigos-delivery.tn',
      contactPhone: '+216 71 123 456',
      address: '15 Avenue Habib Bourguiba, Tunis, Tunisie',
      workingHours: 'Lun-Dim: 8h00 - 22h00',
      currency: 'TND',
      language: 'fr',
      timezone: 'Africa/Tunis'
    };

    res.status(200).json({ settings: appSettings });
  } catch (error) {
    console.error('Error fetching app settings:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des paramètres',
      error:   error.message
    });
  }
};

// @desc Update application settings
// @route PUT /api/settings/app
// @access Private
exports.updateAppSettings = async (req, res) => {
  try {
    const {
      businessName,
      businessDescription,
      contactEmail,
      contactPhone,
      address,
      workingHours,
      currency,
      language,
      timezone
    } = req.body;

    const updatedSettings = {
      businessName: businessName || 'AMIGOS Delivery',
      businessDescription: businessDescription || 'Plateforme de livraison tout-en-un',
      contactEmail: contactEmail || 'contact@amigos-delivery.tn',
      contactPhone: contactPhone || '+216 71 123 456',
      address: address || '15 Avenue Habib Bourguiba, Tunis, Tunisie',
      workingHours: workingHours || 'Lun-Dim: 8h00 - 22h00',
      currency: currency || 'TND',
      language: language || 'fr',
      timezone: timezone || 'Africa/Tunis'
    };

    res.status(200).json({
      message: 'Paramètres de l\'application mis à jour avec succès',
      settings: updatedSettings
    });
  } catch (error) {
    console.error('Error updating app settings:', error);
    res.status(500).json({
      message: 'Erreur lors de la mise à jour des paramètres',
      error:   error.message
    });
  }
};

// @desc Get notification settings
// @route GET /api/settings/notifications
// @access Private
exports.getNotificationSettings = async (req, res) => {
  try {
    const notificationSettings = {
      emailNotifications: true,
      pushNotifications: true,
      orderNotifications: true,
      systemAlerts: true,
      smsNotifications: false,
      marketingEmails: false
    };

    res.status(200).json({ settings: notificationSettings });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des paramètres de notification',
      error:   error.message
    });
  }
};

// @desc Update notification settings
// @route PUT /api/settings/notifications
// @access Private
exports.updateNotificationSettings = async (req, res) => {
  try {
    const {
      emailNotifications,
      pushNotifications,
      orderNotifications,
      systemAlerts,
      smsNotifications,
      marketingEmails
    } = req.body;

    const updatedSettings = {
      emailNotifications: emailNotifications ?? true,
      pushNotifications: pushNotifications ?? true,
      orderNotifications: orderNotifications ?? true,
      systemAlerts: systemAlerts ?? true,
      smsNotifications: smsNotifications ?? false,
      marketingEmails: marketingEmails ?? false
    };

    res.status(200).json({
      message: 'Paramètres de notification mis à jour avec succès',
      settings: updatedSettings
    });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({
      message: 'Erreur lors de la mise à jour des paramètres de notification',
      error:   error.message
    });
  }
};

// @desc Get security settings
// @route GET /api/settings/security
// @access Private
exports.getSecuritySettings = async (req, res) => {
  try {
    const securitySettings = {
      twoFactorEnabled: false,
      sessionTimeout: 30,
      passwordExpiry: 90,
      loginAlerts: true,
      suspiciousActivityAlerts: true
    };

    res.status(200).json({ settings: securitySettings });
  } catch (error) {
    console.error('Error fetching security settings:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des paramètres de sécurité',
      error:   error.message
    });
  }
};

// @desc Update security settings
// @route PUT /api/settings/security
// @access Private
exports.updateSecuritySettings = async (req, res) => {
  try {
    const {
      twoFactorEnabled,
      sessionTimeout,
      passwordExpiry,
      loginAlerts,
      suspiciousActivityAlerts
    } = req.body;

    const updatedSettings = {
      twoFactorEnabled: twoFactorEnabled ?? false,
      sessionTimeout: sessionTimeout ?? 30,
      passwordExpiry: passwordExpiry ?? 90,
      loginAlerts: loginAlerts ?? true,
      suspiciousActivityAlerts: suspiciousActivityAlerts ?? true
    };

    res.status(200).json({
      message: 'Paramètres de sécurité mis à jour avec succès',
      settings: updatedSettings
    });
  } catch (error) {
    console.error('Error updating security settings:', error);
    res.status(500).json({
      message: 'Erreur lors de la mise à jour des paramètres de sécurité',
      error:   error.message
    });
  }
};

// @desc Get user addresses
// @route GET /api/settings/addresses/:userId
// @access Private
exports.getUserAddresses = async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!userId) {
      return res.status(400).json({ message: 'ID utilisateur requis' });
    }

    const user = await User.findById(userId)
      .select('location')
      .populate('location.zone', 'number minDistance maxDistance price');

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Retourner la localisation comme adresse principale
    const addresses = [];

    if (user.location && user.location.latitude && user.location.longitude) {
      addresses.push({
        id: 'current-location',
        label: 'Current Location',
        address: user.location.address || `Latitude: ${user.location.latitude}, Longitude: ${user.location.longitude}`,
        city: 'Tunis',
        latitude: user.location.latitude,
        longitude: user.location.longitude,
        zone: user.location.zone,
        zoneName: user.location.zoneName,
        deliveryPrice: user.location.deliveryPrice,
        distance: user.location.distance,
        isDefault: true
      });
    }

    res.status(200).json({
      addresses: addresses
    });
  } catch (error) {
    console.error('Error fetching addresses:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des adresses',
      error:   error.message
    });
  }
};

// @desc Add new address
// @route POST /api/settings/addresses
// @access Private
exports.addAddress = async (req, res) => {
  try {
    const { address } = req.body;
    const userId = req.user?.id || req.body.userId;

    if (!userId) {
      return res.status(400).json({ message: 'ID utilisateur requis' });
    }

    if (!address || typeof address !== 'object') {
      return res.status(400).json({ message: 'Données d\'adresse invalides' });
    }

    const { label, address: addressStr, city, postalCode, phoneNumber, instructions, isDefault, latitude, longitude } = address;

    // Créer une nouvelle localisation
    const location = {
      latitude: latitude || 36.8065,
      longitude: longitude || 10.1815,
      address: addressStr || `${label || 'Address'}, ${city || ''}`
    };

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'location.latitude': location.latitude,
          'location.longitude': location.longitude,
          'location.address': location.address
        }
      },
      { new: true }
    ).select('firstName lastName email phoneNumber role status location');

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Attribuer la zone automatiquement
    const zoneInfo = await assignZoneForUser(userId, location.latitude, location.longitude);

    // Récupérer l'utilisateur mis à jour avec la zone
    const updatedUser = await User.findById(userId)
      .select('location')
      .populate('location.zone', 'number minDistance maxDistance price');

    res.status(200).json({
      message: 'Adresse ajoutée avec succès',
      address: {
        id: 'current-location',
        label: label || 'New Address',
        address: location.address,
        city: city || 'Tunis',
        latitude: location.latitude,
        longitude: location.longitude,
        zone: updatedUser.location.zone,
        zoneName: updatedUser.location.zoneName,
        deliveryPrice: updatedUser.location.deliveryPrice,
        distance: updatedUser.location.distance,
        isDefault: isDefault || false
      },
      zoneInfo: zoneInfo
    });
  } catch (error) {
    console.error('Error adding address:', error);
    res.status(500).json({
      message: 'Erreur lors de l\'ajout de l\'adresse',
      error:   error.message
    });
  }
};

// @desc Update address
// @route PUT /api/settings/addresses/:addressId
// @access Private
exports.updateAddress = async (req, res) => {
  try {
    const { address } = req.body;
    const userId = req.user?.id || req.body.userId;

    if (!userId) {
      return res.status(400).json({ message: 'ID utilisateur requis' });
    }

    if (!address || typeof address !== 'object') {
      return res.status(400).json({ message: 'Données d\'adresse invalides' });
    }

    const { label, address: addressStr, city, postalCode, phoneNumber, instructions, isDefault, latitude, longitude } = address;

    // Mettre à jour la localisation
    const location = {
      latitude: latitude || 36.8065,
      longitude: longitude || 10.1815,
      address: addressStr || `${label || 'Address'}, ${city || ''}`
    };

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'location.latitude': location.latitude,
          'location.longitude': location.longitude,
          'location.address': location.address
        }
      },
      { new: true }
    ).select('firstName lastName email phoneNumber role status location');

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Attribuer la zone automatiquement
    const zoneInfo = await assignZoneForUser(userId, location.latitude, location.longitude);

    // Récupérer l'utilisateur mis à jour avec la zone
    const updatedUser = await User.findById(userId)
      .select('location')
      .populate('location.zone', 'number minDistance maxDistance price');

    res.status(200).json({
      message: 'Adresse mise à jour avec succès',
      address: {
        id: 'current-location',
        label: label || 'Updated Address',
        address: location.address,
        city: city || 'Tunis',
        latitude: location.latitude,
        longitude: location.longitude,
        zone: updatedUser.location.zone,
        zoneName: updatedUser.location.zoneName,
        deliveryPrice: updatedUser.location.deliveryPrice,
        distance: updatedUser.location.distance,
        isDefault: isDefault || false
      },
      zoneInfo: zoneInfo
    });
  } catch (error) {
    console.error('Error updating address:', error);
    res.status(500).json({
      message: 'Erreur lors de la mise à jour de l\'adresse',
      error: error.message ,
    });
  }
};

// @desc Delete address
// @route DELETE /api/settings/addresses/:addressId
// @access Private
exports.deleteAddress = async (req, res) => {
  try {
    const userId = req.user?.id || req.params.userId;

    if (!userId) {
      return res.status(400).json({ message: 'ID utilisateur requis' });
    }

    // Pour simplifier, on remet à zéro la localisation
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'location.latitude': 36.8065,
          'location.longitude': 10.1815,
          'location.address': 'Tunis, Tunisia'
        }
      },
      { new: true }
    ).select('firstName lastName email phoneNumber role status location');

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    res.status(200).json({
      message: 'Adresse supprimée avec succès'
    });
  } catch (error) {
    console.error('Error deleting address:', error);
    res.status(500).json({
      message: 'Erreur lors de la suppression de l\'adresse',
      error: error.message,
    });
  }
};

module.exports = exports;
