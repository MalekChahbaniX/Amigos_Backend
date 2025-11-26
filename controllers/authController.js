const User = require('../models/User');
const OTP = require('../models/OTP');
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
          status: 'pending'
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

        // Essayer d'envoyer l'OTP via SMS
        let smsSent = false;
        let errorMessage = '';

        try {
          const result = await OTPService.sendOTP(phoneNumber, otp);
          console.log('OTP envoyé par SMS avec succès:', result.sid);
          smsSent = result.success || true;
        } catch (smsError) {
          console.error('Erreur envoi SMS:', smsError.message);
          errorMessage = smsError.message;
          // On continue même si l'envoi SMS échoue
        }

        // Réponse adaptée selon le succès de l'envoi
        const response = {
          _id: user._id,
          phoneNumber: user.phoneNumber,
          isVerified: false,
          otpSent: smsSent,
        };

        if (smsSent) {
          response.message = 'Code de vérification envoyé par SMS';
          
          // En développement, inclure le code pour tester facilement
          if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
            response.debugOtp = otp;
            response.devMessage = `Code pour tester: ${otp}`;
          }
        } else {
          response.message = 'Code de vérification généré (erreur envoi SMS)';
          response.error = `Erreur SMS: ${errorMessage}`;
          
          // En cas d'échec SMS, retourner le code en mode développement
          if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
            response.debugOtp = otp;
            response.message += ` - Code de debug: ${otp}`;
          }
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Un compte existe déjà avec cet email' });
    }

    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log('Mot de passe hashé avec succès');

    // Créer le super administrateur
    const superAdmin = await User.create({
      email,
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};