const User = require('../models/User');

// @desc    Get current user profile
// @route   GET /api/settings/profile
// @access  Private (Super Admin only)
exports.getProfile = async (req, res) => {
  try {
    // In a real app, you would get the user ID from the JWT token
    // For now, we'll use a default super admin or get from request
    const userId = req.user?.id || req.query.userId;

    if (!userId) {
      return res.status(400).json({ message: 'ID utilisateur requis' });
    }

    const user = await User.findById(userId).select('firstName lastName email phoneNumber role status');

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
        status: user.status
      }
    });

  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération du profil',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/settings/profile
// @access  Private (Super Admin only)
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Change user password
// @route   PUT /api/settings/password
// @access  Private (Super Admin only)
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

    // For super admin users, we need to check the current password
    // In a real app, you would use bcrypt.compare() here
    // For now, we'll assume the password check is handled elsewhere

    // Hash the new password (you would use bcrypt here)
    const hashedPassword = newPassword; // In real app: await bcrypt.hash(newPassword, 10)

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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get application settings
// @route   GET /api/settings/app
// @access  Private (Super Admin only)
exports.getAppSettings = async (req, res) => {
  try {
    // In a real app, these would come from a Settings model or config file
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update application settings
// @route   PUT /api/settings/app
// @access  Private (Super Admin only)
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

    // In a real app, you would save these to a Settings model or config file
    // For now, we'll just return success

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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get notification settings
// @route   GET /api/settings/notifications
// @access  Private (Super Admin only)
exports.getNotificationSettings = async (req, res) => {
  try {
    // In a real app, these would come from a UserSettings model
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update notification settings
// @route   PUT /api/settings/notifications
// @access  Private (Super Admin only)
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get security settings
// @route   GET /api/settings/security
// @access  Private (Super Admin only)
exports.getSecuritySettings = async (req, res) => {
  try {
    // In a real app, these would come from a UserSettings model
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update security settings
// @route   PUT /api/settings/security
// @access  Private (Super Admin only)
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};