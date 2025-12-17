const User = require('../models/User');
const OTP = require('../models/OTP');
const City = require('../models/City');
const Session = require('../models/Session');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const OTPService = require('../services/otpService');

// Fonction pour générer un JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '1d' });
};

// Fonction pour générer un code OTP
const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// @desc    Test de connexion
// @route   GET /api/auth/test
// @access  Public
exports.testConnection = async (req, res) => {
  try {
    // Test de la base de données
    const userCount = await User.countDocuments();
    
    // Test de Twilio SMS
    const otpServiceTest = await OTPService.testConnection();
    
    res.status(200).json({ 
      message: 'Serveur connecté avec succès',
      database: { connected: true, users: userCount },
      twilio: otpServiceTest
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Erreur de connexion serveur',
      error: error.message 
    });
  }
};

// @desc    Se connecter ou créer un utilisateur
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res) => {
  const { phoneNumber } = req.body;

  try {
    console.log('=== DEBUT LOGIN ===');
    console.log('Tentative de connexion pour:', phoneNumber);

    // Validation du numéro de téléphone
    if (!phoneNumber || !phoneNumber.startsWith('+216')) {
      console.log('Numéro invalide:', phoneNumber);
      return res.status(400).json({ message: 'Numéro de téléphone invalide' });
    }

    // Vérifier si l'utilisateur existe
    let user = await User.findOne({ phoneNumber });
    console.log('Utilisateur trouvé:', user ? 'Oui' : 'Non');

    if (!user) {
      // Créer un nouvel utilisateur s'il n'existe pas
      console.log('Création d\'un nouveau utilisateur pour:', phoneNumber);
      try {
        user = await User.create({
          phoneNumber,
          firstName: '', // Sera rempli plus tard lors de la création du profil
          isVerified: false,
          status: 'pending',
          location: {
            latitude: 36.8065, // Tunis par défaut
            longitude: 10.1815,
            address: 'Tunis, Tunisia'
          }
        });
        console.log('Nouvel utilisateur créé avec ID:', user._id);
      } catch (createError) {
        console.error('Erreur création utilisateur:', createError);
        return res.status(500).json({ message: 'Erreur lors de la création du compte' });
      }
    }

    // Vérifier le statut de vérification
    console.log('Statut de vérification:', user.isVerified);

    if (user.isVerified) {
      // Si l'utilisateur est déjà vérifié, connexion directe
      console.log('Utilisateur déjà vérifié, connexion directe');
      return res.status(200).json({
        _id: user._id,
        firstName: user.firstName,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isVerified: true,
        token: generateToken(user._id),
        message: 'Connexion réussie'
      });
    } else {
      // Si l'utilisateur n'est pas vérifié, envoyer un code OTP
      console.log('Utilisateur non vérifié, génération OTP');
      const otp = generateOTP();
      console.log('Code OTP généré:', otp);
      
      try {
        // Supprimer les anciens OTP pour ce numéro
        await OTP.deleteMany({ phone: phoneNumber });
        console.log('Anciens OTP supprimés');
        
        // Sauvegarder le nouvel OTP
        await OTP.create({
          phone: phoneNumber,
          code: otp
        });
        console.log('Nouveau OTP sauvegardé');

        // Essayer d'envoyer l'OTP via SMS et/ou WhatsApp
        let channelsSent = [];
        let errorMessage = '';
        let success = false;
        let actualDelivery = false;
        let deliveryStatus = 'pending';

        try {
          const result = await OTPService.sendOTP(phoneNumber, otp);
          console.log('OTP envoyé avec succès via:', result.channels);
          console.log('Réponses:', result.responses);
          channelsSent = result.channels || [];
          success = result.success || false;
          
          // Vérifier si l'OTP a été réellement envoyé
          if (result.responses && result.responses.length > 0) {
            const sentResponses = result.responses.filter(r => r.status && r.status !== 'failed');
            actualDelivery = sentResponses.length > 0;
          }
          
          // Vérifier si c'est une erreur d'authentification
          if (result.responses && result.responses.some(r => r.errorMessage === 'Authentication failed')) {
            deliveryStatus = 'auth_error';
            errorMessage = 'Erreur d\'authentification Twilio';
          } else if (!actualDelivery && !success) {
            deliveryStatus = 'failed';
            errorMessage = 'Échec de l\'envoi de l\'OTP';
          } else {
            deliveryStatus = 'sent';
          }
        } catch (smsError) {
          console.error('Erreur envoi OTP:', smsError.message);
          errorMessage = smsError.message;
          deliveryStatus = 'failed';
          // On continue même si l'envoi échoue
        }

        // Déterminer le message en fonction des canaux utilisés et du statut de livraison
        let message = 'Code de vérification généré';
        if (deliveryStatus === 'auth_error') {
          message = 'Code généré (erreur d\'authentification Twilio)';
        } else if (deliveryStatus === 'sent') {
          if (channelsSent.includes('whatsapp') && channelsSent.includes('sms')) {
            message = 'Code de vérification envoyé par WhatsApp et SMS';
          } else if (channelsSent.includes('whatsapp')) {
            message = 'Code de vérification envoyé par WhatsApp';
          } else if (channelsSent.includes('sms')) {
            message = 'Code de vérification envoyé par SMS';
          }
        } else {
          message = 'Code généré mais non envoyé';
        }

        // Réponse adaptée selon le succès de l'envoi
        const response = {
          _id: user._id,
          phoneNumber: user.phoneNumber,
          isVerified: false,
          channelsSent,
          otpSent: success || channelsSent.length > 0,
          deliveryStatus,
        };

        if (success || channelsSent.length > 0) {
          response.message = message;
          
          // Si c'est une erreur d'authentification, inclure le code pour permettre la vérification
          if (deliveryStatus === 'auth_error') {
            response.debugOtp = otp;
            response.message += ` - Code: ${otp}`;
          }
          
          // En développement, inclure le code pour tester facilement
          // if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
          //   response.debugOtp = otp;
          //   response.devMessage = `Code pour tester: ${otp}`;
          // }
        } else {
          response.message = message;
          response.error = errorMessage;
          
          // En cas d'échec total, retourner le code en mode développement
          // if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
          //   response.debugOtp = otp;
          //   response.message += ` - Code de debug: ${otp}`;
          // }
        }

        return res.status(200).json(response);

      } catch (otpError) {
        console.error('Erreur lors de la gestion OTP:', otpError);
        return res.status(500).json({ message: 'Erreur lors de la génération du code' });
      }
    }

  } catch (error) {
    console.error('=== ERREUR LOGIN ===');
    console.error('Erreur complète:', error);
    res.status(500).json({ 
      message: 'Erreur serveur',
      error:   error.message
    });
  }
};

// @desc    Vérifier le code OTP
// @route   POST /api/auth/verify
// @access  Public
exports.verifyOTP = async (req, res) => {
  const { phoneNumber, otp } = req.body;

  try {
    console.log('=== DEBUT VERIFICATION ===');
    console.log('Vérification OTP pour:', phoneNumber, 'Code:', otp);

    // Validation des paramètres
    if (!phoneNumber || !otp) {
      return res.status(400).json({ message: 'Numéro de téléphone et code requis' });
    }

    // Vérifier si le code OTP est valide
    const otpRecord = await OTP.findOne({ 
      phone: phoneNumber, 
      code: otp 
    });

    console.log('OTP trouvé en base:', otpRecord ? 'Oui' : 'Non');

    if (!otpRecord) {
      console.log('Code OTP invalide ou expiré');
      return res.status(400).json({ message: 'Code invalide ou expiré' });
    }

    // Mettre à jour le statut de vérification de l'utilisateur
    const user = await User.findOneAndUpdate(
      { phoneNumber },
      { 
        isVerified: true,
        status: 'active' 
      },
      { new: true }
    );

    if (!user) {
      console.log('Utilisateur non trouvé lors de la vérification');
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Supprimer l'OTP utilisé
    await OTP.deleteMany({ phone: phoneNumber });
    console.log('OTP supprimé après vérification');

    console.log('Vérification réussie pour:', phoneNumber);

    res.status(200).json({
      _id: user._id,
      firstName: user.firstName,
      phoneNumber: user.phoneNumber,
      role: user.role,
      isVerified: true,
      token: generateToken(user._id),
      message: 'Vérification réussie'
    });

  } catch (error) {
    console.error('=== ERREUR VERIFICATION ===');
    console.error('Erreur complète:', error);
    res.status(500).json({ 
      message: 'Erreur serveur',
      error:   error.message
    });
  }
};

// @desc    Déconnecter un utilisateur
// @route   POST /api/auth/logout
// @access  Private (requires token)
exports.logoutUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Token manquant' });
    }

    // Ici, vous pouvez ajouter une logique pour invalider le token côté serveur
    // Par exemple, ajouter le token à une liste noire (blacklist)
    // Pour l'instant, on considère que le frontend gère la déconnexion locale

    console.log('Déconnexion réussie pour le token:', token.substring(0, 10) + '...');

    res.status(200).json({
      message: 'Déconnexion réussie'
    });
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
    res.status(500).json({
      message: 'Erreur serveur lors de la déconnexion',
      error:   error.message
    });
  }
};

// @desc    Enregistrer un nouvel utilisateur (endpoint séparé si nécessaire)
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res) => {
  const { phoneNumber, firstName } = req.body;

  try {
    console.log('=== DEBUT REGISTER ===');
    console.log('Création compte pour:', phoneNumber, firstName);

    // Vérifier si l'utilisateur existe déjà  
    const userExists = await User.findOne({ phoneNumber });
    if (userExists) {
      return res.status(400).json({ message: 'Un compte existe déjà avec ce numéro' });
    }

    // Créer un nouvel utilisateur
    const user = await User.create({
      phoneNumber,
      firstName,
      isVerified: false,
      status: 'pending'
    });

    console.log('Nouvel utilisateur créé:', user._id);

    if (user) {
      res.status(201).json({
        _id: user._id,
        firstName: user.firstName,
        phoneNumber: user.phoneNumber,
        isVerified: user.isVerified,
        token: generateToken(user._id),
        message: 'Compte créé avec succès'
      });
    } else {
      res.status(400).json({ message: 'Données utilisateur invalides' });
    }
  } catch (error) {
    console.error('=== ERREUR REGISTER ===');
    console.error('Erreur complète:', error);
    res.status(500).json({
      message: 'Erreur serveur',
      error:   error.message
    });
  }
};

// @desc    Enregistrer un nouvel administrateur super
// @route   POST /api/auth/register-super-admin
// @access  Public (mais devrait être sécurisé en production)
exports.registerSuperAdmin = async (req, res) => {
  const { email, password, firstName, lastName } = req.body;

  try {
    console.log('=== DEBUT REGISTER SUPER ADMIN ===');
    console.log('Création super admin pour:', email);

    // Validation des paramètres requis
    if (!email || !password) {
      return res.status(400).json({
        message: 'Email et mot de passe sont requis pour le super admin'
      });
    }

    // Validation du format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Format d\'email invalide' });
    }

   // Normaliser l'email en lowercase
   const normalizedEmail = email.toLowerCase();


    // Validation de la longueur du mot de passe
    if (password.length < 6) {
      return res.status(400).json({
        message: 'Le mot de passe doit contenir au moins 6 caractères'
      });
    }

    // Vérifier si un super admin existe déjà
    // const existingSuperAdmin = await User.findOne({ role: 'superAdmin' });
    // if (existingSuperAdmin) {
    //   return res.status(400).json({
    //     message: 'Un super administrateur existe déjà'
    //   });
    // }

    // Vérifier si l'email existe déjà
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'Un compte existe déjà avec cet email' });
    }

    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log('Mot de passe hashé avec succès');

    // Créer le super administrateur
    const superAdmin = await User.create({
      email: normalizedEmail,
      password: hashedPassword,
      firstName: firstName || '',
      lastName: lastName || '',
      role: 'superAdmin',
      isVerified: true, // Le super admin est automatiquement vérifié
      status: 'active'
    });

    console.log('Super administrateur créé:', superAdmin._id);

    if (superAdmin) {
      res.status(201).json({
        _id: superAdmin._id,
        firstName: superAdmin.firstName,
        lastName: superAdmin.lastName,
        email: superAdmin.email,
        role: superAdmin.role,
        isVerified: superAdmin.isVerified,
        token: generateToken(superAdmin._id),
        message: 'Super administrateur créé avec succès'
      });
    } else {
      res.status(400).json({ message: 'Données super administrateur invalides' });
    }
  } catch (error) {
    console.error('=== ERREUR REGISTER SUPER ADMIN ===');
    console.error('Erreur complète:', error);
    res.status(500).json({
      message: 'Erreur serveur lors de la création du super administrateur',
      error:   error.message
    });
  }
};

// @desc    Connecter un administrateur super
// @route   POST /api/auth/login-super-admin
// @access  Public
exports.loginSuperAdmin = async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log('=== DEBUT LOGIN SUPER ADMIN ===');
    console.log('Tentative de connexion super admin pour:', email);

    // Validation des paramètres
    if (!email || !password) {
      return res.status(400).json({
        message: 'Email et mot de passe sont requis'
      });
    }

    // Validation du format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Format d\'email invalide' });
    }

    // Rechercher l'utilisateur super admin par email
    const superAdmin = await User.findOne({
      email: email.toLowerCase(),
      role: 'superAdmin'
    });

    if (!superAdmin) {
      console.log('Super admin non trouvé pour:', email);
      return res.status(401).json({
        message: 'Identifiants invalides pour le super administrateur'
      });
    }

    console.log('Super admin trouvé:', superAdmin._id);

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, superAdmin.password);

    if (!isPasswordValid) {
      console.log('Mot de passe invalide pour:', email);
      return res.status(401).json({
        message: 'Identifiants invalides pour le super administrateur'
      });
    }

    // Vérifier le statut du compte
    if (superAdmin.status !== 'active') {
      console.log('Compte super admin inactif:', superAdmin.status);
      return res.status(401).json({
        message: 'Compte super administrateur désactivé'
      });
    }

    console.log('Connexion super admin réussie pour:', email);

    res.status(200).json({
      _id: superAdmin._id,
      firstName: superAdmin.firstName,
      lastName: superAdmin.lastName,
      email: superAdmin.email,
      role: superAdmin.role,
      isVerified: superAdmin.isVerified,
      token: generateToken(superAdmin._id),
      message: 'Connexion super administrateur réussie'
    });

  } catch (error) {
    console.error('=== ERREUR LOGIN SUPER ADMIN ===');
    console.error('Erreur complète:', error);
    res.status(500).json({
      message: 'Erreur serveur lors de la connexion du super administrateur',
      error:   error.message
    });
  }
};

// @desc    Enregistrer un nouveau livreur
// @route   POST /api/auth/register-deliverer
// @access  Public
exports.registerDeliverer = async (req, res) => {
  const { phoneNumber, firstName, lastName, vehicle, email } = req.body;

  try {
    console.log('=== DEBUT REGISTER DELIVERER ===');
    console.log('Création livreur pour:', phoneNumber, firstName, lastName);

    // Validation des paramètres requis
    if (!phoneNumber || !firstName || !lastName) {
      return res.status(400).json({
        message: 'Numéro de téléphone, prénom et nom sont requis pour le livreur'
      });
    }
    // Vérifier si un livreur existe déjà avec ce numéro
    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
      return res.status(400).json({ message: 'Un compte existe déjà avec ce numéro de téléphone' });
    }

    // Créer le livreur
    const deliverer = await User.create({
      phoneNumber,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email || null,
      vehicle: vehicle || '',
      role: 'deliverer',
      isVerified: true, // Le livreur est automatiquement vérifié
      status: 'active'
    });

    console.log('Livreur créé:', deliverer._id);

    if (deliverer) {
      res.status(201).json({
        _id: deliverer._id,
        firstName: deliverer.firstName,
        lastName: deliverer.lastName,
        phoneNumber: deliverer.phoneNumber,
        email: deliverer.email,
        vehicle: deliverer.vehicle,
        role: deliverer.role,
        isVerified: deliverer.isVerified,
        status: deliverer.status,
        token: generateToken(deliverer._id),
        message: 'Compte livreur créé avec succès'
      });
    } else {
      res.status(400).json({ message: 'Données livreur invalides' });
    }
  } catch (error) {
    console.error('=== ERREUR REGISTER DELIVERER ===');
    console.error('Erreur complète:', error);
    res.status(500).json({
      message: 'Erreur serveur lors de la création du livreur',
      error:   error.message
    });
  }
};

// @desc    Connecter un livreur
// @route   POST /api/auth/login-deliverer
// @access  Public
exports.loginDeliverer = async (req, res) => {
  const { phoneNumber } = req.body;

  // Normaliser le numéro fourni : si l'utilisateur envoie 8 chiffres, ajouter le préfixe +216
  const rawPhone = phoneNumber;
  let normalizedPhone = phoneNumber;
  try {
    if (phoneNumber && /^\d{8}$/.test(phoneNumber)) {
      normalizedPhone = `+216${phoneNumber}`;
      console.log('Numéro normalisé vers:', normalizedPhone);
    }
  } catch (e) {
    // ignore
  }

  try {
    console.log('=== DEBUT LOGIN DELIVERER ===');
    console.log('Tentative de connexion livreur pour:', phoneNumber);

    // Vérifier si le livreur existe
    // Chercher le livreur soit par le numéro tel quel, soit par la version normalisée
    let deliverer = await User.findOne({ role: 'deliverer', $or: [{ phoneNumber: rawPhone }, { phoneNumber: normalizedPhone }] });
    console.log('Livreur trouvé:', deliverer ? 'Oui' : 'Non');

    if (!deliverer) {
      // Créer un nouveau livreur s'il n'existe pas
      console.log('Création d\'un nouveau livreur pour:', phoneNumber);
      try {
        deliverer = await User.create({
          phoneNumber: normalizedPhone,
          firstName: '', // Sera rempli plus tard
          lastName: '',
          role: 'deliverer',
          isVerified: true,
          status: 'pending'
        });
        console.log('Nouveau livreur créé avec ID:', deliverer._id);
      } catch (createError) {
        console.error('Erreur création livreur:', createError);
        return res.status(500).json({ message: 'Erreur lors de la création du compte livreur' });
      }
    }

    // Vérifier le statut de vérification
    console.log('Statut de vérification:', deliverer.isVerified);

    // Mettre à jour le statut du livreur s'il est inactif
    if (deliverer.status !== 'active') {
      deliverer.status = 'active';
      await deliverer.save({ validateBeforeSave: false });
      console.log('Statut du livreur mis à jour vers actif');
    }

    // After activation, ensure there's a daily session: reuse if exists for today, otherwise create
    try {
      const today = new Date();
      const startOfToday = new Date(today);
      startOfToday.setHours(0,0,0,0);
      const startOfTomorrow = new Date(startOfToday);
      startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

      let session = null;

      // If user has currentSession, try to load and validate it
      if (deliverer.currentSession) {
        session = await Session.findById(deliverer.currentSession);
        if (session && session.active) {
          const s = new Date(session.startTime);
          if (!(s >= startOfToday && s < startOfTomorrow)) {
            // session exists but not for today -> ignore
            session = null;
          }
        } else {
          session = null;
        }
      }

      // If no valid currentSession, look up an active session for today
      if (!session) {
        session = await Session.findOne({
          deliverer: deliverer._id,
          active: true,
          startTime: { $gte: startOfToday, $lt: startOfTomorrow }
        });
      }

      // If still none, create one for today
      if (!session) {
        session = await Session.create({ deliverer: deliverer._id });
        // attach to user
        deliverer.currentSession = session._id;
        deliverer.sessionDate = startOfToday;
        deliverer.sessionActive = true;
        await deliverer.save({ validateBeforeSave: false });
        console.log('Nouvelle session journalière créée pour le livreur:', deliverer._id);
      } else {
        // Ensure user fields are in sync
        deliverer.currentSession = session._id;
        const sDate = new Date(session.startTime);
        sDate.setHours(0,0,0,0);
        deliverer.sessionDate = sDate;
        deliverer.sessionActive = !!session.active;
        await deliverer.save({ validateBeforeSave: false });
        console.log('Session journalière réutilisée pour le livreur:', deliverer._id);
      }
    } catch (sessErr) {
      console.error('Erreur lors de la gestion de la session journalière au login:', sessErr);
      // don't block login on session creation failure
    }

    // Return deliverer info including session metadata so middleware can rely on it immediately
    console.log('Connexion livreur réussie');
    return res.status(200).json({
      _id: deliverer._id,
      firstName: deliverer.firstName,
      lastName: deliverer.lastName,
      phoneNumber: deliverer.phoneNumber,
      email: deliverer.email,
      vehicle: deliverer.vehicle,
      role: deliverer.role,
      isVerified: true,
      status: 'active',
      sessionDate: deliverer.sessionDate,
      sessionActive: deliverer.sessionActive,
      currentSession: deliverer.currentSession,
      token: generateToken(deliverer._id),
      message: 'Connexion livreur réussie'
    });

  } catch (error) {
    console.error('=== ERREUR LOGIN DELIVERER ===');
    console.error('Erreur complète:', error);
    res.status(500).json({
      message: 'Erreur serveur',
      error:   error.message
    });
  }
};

// @desc    Vérifier le livreur (maintenu pour compatibilité mais sans OTP)
// @route   POST /api/auth/verify-deliverer
// @access  Public
exports.verifyDelivererOTP = async (req, res) => {
  const { phoneNumber } = req.body;

  try {
    console.log('=== DEBUT VERIFICATION DELIVERER ===');
    console.log('Vérification livreur pour:', phoneNumber);

    // Validation du numéro de téléphone
    if (!phoneNumber) {
      return res.status(400).json({ message: 'Numéro de téléphone requis' });
    }

    // Trouver le livreur
    const deliverer = await User.findOne({
      phoneNumber,
      role: 'deliverer'
    });

    if (!deliverer) {
      return res.status(404).json({ message: 'Livreur non trouvé' });
    }

    // Mettre à jour le statut si nécessaire
    if (deliverer.status !== 'active') {
      deliverer.status = 'active';
      await deliverer.save();
      console.log('Statut du livreur mis à jour vers actif');
    }

    console.log('Vérification livreur réussie pour:', phoneNumber);

    res.status(200).json({
      _id: deliverer._id,
      firstName: deliverer.firstName,
      lastName: deliverer.lastName,
      phoneNumber: deliverer.phoneNumber,
      email: deliverer.email,
      vehicle: deliverer.vehicle,
      role: deliverer.role,
      isVerified: true,
      status: 'active',
      token: generateToken(deliverer._id),
      message: 'Vérification livreur réussie'
    });

  } catch (error) {
    console.error('=== ERREUR VERIFICATION DELIVERER ===');
    console.error('Erreur complète:', error);
    res.status(500).json({
      message: 'Erreur serveur',
      error:   error.message
    });
  }
};

// @desc    Enregistrer un nouvel administrateur
// @route   POST /api/auth/register-admin
// @access  Public (mais devrait être sécurisé en production)
exports.registerAdmin = async (req, res) => {
  const { email, password, firstName, lastName, cityId } = req.body;

  try {
    console.log('=== DEBUT REGISTER ADMIN ===');
    console.log('Création admin pour:', email);

    // Validation des paramètres requis
    if (!email || !password) {
      return res.status(400).json({
        message: 'Email et mot de passe sont requis pour l\'admin'
      });
    }

    // Validation du format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Format d\'email invalide' });
    }

    // Normaliser l'email en lowercase
    const normalizedEmail = email.toLowerCase();

    // Vérifier la présence et l'existence de la ville pour un admin
    if (!cityId) {
      return res.status(400).json({ message: 'cityId est requis pour un administrateur' });
    }

    const city = await City.findById(cityId);
    if (!city) {
      return res.status(404).json({ message: 'Ville non trouvée pour cityId fourni' });
    }

    // Validation de la longueur du mot de passe
    if (password.length < 6) {
      return res.status(400).json({
        message: 'Le mot de passe doit contenir au moins 6 caractères'
      });
    }

    // Vérifier si l'email existe déjà
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'Un compte existe déjà avec cet email' });
    }

    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log('Mot de passe hashé avec succès');

    // Créer l'administrateur
    const admin = await User.create({
      email: normalizedEmail,
      password: hashedPassword,
      firstName: firstName || '',
      lastName: lastName || '',
      role: 'admin',
      city: city._id,
      isVerified: true, // L'admin est automatiquement vérifié
      status: 'active'
    });

    console.log('Administrateur créé:', admin._id);

    if (admin) {
      res.status(201).json({
        _id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        role: admin.role,
        isVerified: admin.isVerified,
        token: generateToken(admin._id),
        message: 'Administrateur créé avec succès'
      });
    } else {
      res.status(400).json({ message: 'Données administrateur invalides' });
    }
  } catch (error) {
    console.error('=== ERREUR REGISTER ADMIN ===');
    console.error('Erreur complète:', error);
    res.status(500).json({
      message: 'Erreur serveur lors de la création de l\'administrateur',
      error:   error.message
    });
  }
};

// @desc    Connecter un administrateur
// @route   POST /api/auth/login-admin
// @access  Public
exports.loginAdmin = async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log('=== DEBUT LOGIN ADMIN ===');
    console.log('Tentative de connexion admin pour:', email);

    // Validation des paramètres
    if (!email || !password) {
      return res.status(400).json({
        message: 'Email et mot de passe sont requis'
      });
    }

    // Validation du format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Format d\'email invalide' });
    }

    // Rechercher l'utilisateur admin par email
    const admin = await User.findOne({
      email: email.toLowerCase(),
      role: 'admin'
    });

    if (!admin) {
      console.log('Admin non trouvé pour:', email);
      return res.status(401).json({
        message: 'Identifiants invalides pour l\'administrateur'
      });
    }

    console.log('Admin trouvé:', admin._id);

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      console.log('Mot de passe invalide pour:', email);
      return res.status(401).json({
        message: 'Identifiants invalides pour l\'administrateur'
      });
    }

    // Vérifier le statut du compte
    if (admin.status !== 'active') {
      console.log('Compte admin inactif:', admin.status);
      return res.status(401).json({
        message: 'Compte administrateur désactivé'
      });
    }

    console.log('Connexion admin réussie pour:', email);

    res.status(200).json({
      _id: admin._id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      role: admin.role,
      isVerified: admin.isVerified,
      token: generateToken(admin._id),
      message: 'Connexion administrateur réussie'
    });

  } catch (error) {
    console.error('=== ERREUR LOGIN ADMIN ===');
    console.error('Erreur complète:', error);
    res.status(500).json({
      message: 'Erreur serveur lors de la connexion de l\'administrateur',
      error:   error.message
    });
  }
};

// @desc    Enregistrer un nouveau prestataire (provider)
// @route   POST /api/auth/register-provider
// @access  Public
exports.registerProvider = async (req, res) => {
  const { email, password, firstName, lastName, providerId } = req.body;
  const Provider = require('../models/Provider');

  try {
    console.log('=== DEBUT REGISTER PROVIDER ===');
    console.log('Création prestataire pour:', email, providerId);

    // Validation des paramètres requis
    if (!email || !password || !providerId) {
      return res.status(400).json({
        message: 'Email, mot de passe et providerId sont requis pour le prestataire'
      });
    }

    // Validation du format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Format d\'email invalide' });
    }

    // Normaliser l'email en lowercase
    const normalizedEmail = email.toLowerCase();

    // Validation de la longueur du mot de passe
    if (password.length < 6) {
      return res.status(400).json({
        message: 'Le mot de passe doit contenir au moins 6 caractères'
      });
    }

    // Vérifier si un utilisateur existe déjà avec cet email
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'Un compte existe déjà avec cet email' });
    }

    // Vérifier si le provider existe et n'a pas déjà un utilisateur
    const provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({ message: 'Prestataire non trouvé' });
    }

    // Vérifier si ce provider a déjà un utilisateur associé
    const existingProvider = await User.findOne({ role: 'provider', providerId });
    if (existingProvider) {
      return res.status(400).json({ message: 'Un compte utilisateur existe déjà pour ce prestataire' });
    }

    // Hacher le mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Créer le prestataire
    const providerUser = await User.create({
      email: normalizedEmail,
      password: hashedPassword,
      firstName: firstName || provider.name || '',
      lastName: lastName || '',
      role: 'provider',
      providerId: providerId,
      isVerified: true, // Le prestataire est automatiquement vérifié
      status: 'active'
    });

    console.log('Prestataire créé:', providerUser._id);

    if (providerUser) {
      res.status(201).json({
        _id: providerUser._id,
        firstName: providerUser.firstName,
        lastName: providerUser.lastName,
        email: providerUser.email,
        role: providerUser.role,
        providerId: providerUser.providerId,
        isVerified: providerUser.isVerified,
        status: providerUser.status,
        token: generateToken(providerUser._id),
        message: 'Compte prestataire créé avec succès'
      });
    } else {
      res.status(400).json({ message: 'Données prestataire invalides' });
    }
  } catch (error) {
    console.error('=== ERREUR REGISTER PROVIDER ===');
    console.error('Erreur complète:', error);
    res.status(500).json({
      message: 'Erreur serveur lors de la création du prestataire',
      error:   error.message
    });
  }
};

// @desc    Connecter un prestataire (provider)
// @route   POST /api/auth/login-provider
// @access  Public
exports.loginProvider = async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log('=== DEBUT LOGIN PROVIDER ===');
    console.log('Tentative de connexion prestataire pour:', email);

    // Validation des paramètres requis
    if (!email || !password) {
      return res.status(400).json({
        message: 'Email et mot de passe sont requis'
      });
    }

    // Normaliser l'email en lowercase
    const normalizedEmail = email.toLowerCase();

    // Chercher le prestataire par email dans la collection Provider
    const Provider = require('../models/Provider');
    let provider = await Provider.findOne({ email: normalizedEmail });

    if (!provider) {
      console.log('Prestataire non trouvé pour:', normalizedEmail);
      return res.status(401).json({ 
        message: 'Email ou mot de passe incorrect' 
      });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, provider.password);
    
    if (!isPasswordValid) {
      console.log('Mot de passe incorrect pour:', normalizedEmail);
      return res.status(401).json({ 
        message: 'Email ou mot de passe incorrect' 
      });
    }

    console.log('Connexion prestataire réussie pour:', normalizedEmail);

    // Générer le token JWT avec providerId
    const token = generateToken(provider._id);

    res.status(200).json({
      _id: provider._id,
      name: provider.name,
      email: provider.email,
      type: provider.type,
      phone: provider.phone,
      address: provider.address,
      role: 'provider',
      isVerified: true,
      status: provider.status,
      token: token,
      message: 'Connexion prestataire réussie'
    });

  } catch (error) {
    console.error('=== ERREUR LOGIN PROVIDER ===');
    console.error('Erreur complète:', error);
    res.status(500).json({
      message: 'Erreur serveur lors de la connexion du prestataire',
      error:   error.message
    });
  }
};