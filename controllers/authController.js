const User = require('../models/User');
const OTP = require('../models/OTP');
const City = require('../models/City');
const Session = require('../models/Session');
const OTPLog = require('../models/OTPLog');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const SMSRouterService = require('../services/smsRouterService');
const { generateUniqueSecurityCode } = require('../utils/securityCodeGenerator');

/**
 * Extrait le message d'erreur approprié pour les erreurs de clé dupliquée MongoDB
 * @param {Error} error - L'erreur MongoDB
 * @returns {Object} - { field: string, message: string, statusCode: number }
 */
function getDuplicateKeyErrorMessage(error) {
  const keyPattern = error.keyPattern || {};
  const keyValue = error.keyValue || {};
  
  // Identifier le champ en conflit
  const conflictField = Object.keys(keyPattern)[0];
  const conflictValue = keyValue[conflictField];
  
  console.error('❌ [E11000] Détails du conflit:', {
    field: conflictField,
    value: conflictValue,
    keyPattern,
    keyValue
  });
  
  switch (conflictField) {
    case 'securityCode':
      return {
        field: 'securityCode',
        message: 'Erreur système : code de sécurité en conflit. Veuillez réessayer.',
        statusCode: 500,
        canRetry: true
      };
      
    case 'phoneNumber':
      return {
        field: 'phoneNumber',
        message: 'Ce numéro de téléphone est déjà associé à un compte',
        statusCode: 400,
        canRetry: false
      };
      
    case 'email':
      return {
        field: 'email',
        message: 'Cet email est déjà utilisé',
        statusCode: 400,
        canRetry: false
      };
      
    default:
      return {
        field: conflictField || 'unknown',
        message: 'Une erreur de duplication s\'est produite',
        statusCode: 400,
        canRetry: false
      };
  }
}

// Fonction pour mapper les erreurs SMS (Twilio et WinSMS) en messages utilisateur
const getOTPErrorMessage = (error) => {
    const provider = error.provider || 'unknown';
    const errorMessage = error.message || '';
    
    // Erreurs WinSMS spécifiques
    if (provider === 'winsms') {
        const winSmsErrorMap = {
            'invalid number': {
                message: 'Le numéro de téléphone fourni est invalide',
                statusCode: 400,
                canRetry: false
            },
            'invalid phone': {
                message: 'Le numéro de téléphone fourni est invalide',
                statusCode: 400,
                canRetry: false
            },
            'authentication': {
                message: 'Service d\'envoi SMS temporairement indisponible. Veuillez réessayer dans quelques instants.',
                statusCode: 503,
                canRetry: true
            },
            'unauthorized': {
                message: 'Service d\'envoi SMS non configuré. Contactez l\'administrateur.',
                statusCode: 503,
                canRetry: false
            },
            'insufficient balance': {
                message: 'Service d\'envoi SMS temporairement indisponible. Veuillez réessayer dans quelques instants.',
                statusCode: 503,
                canRetry: true
            },
            'no credit': {
                message: 'Service d\'envoi SMS temporairement indisponible. Veuillez réessayer dans quelques instants.',
                statusCode: 503,
                canRetry: true
            },
            'rate limit': {
                message: 'Trop de tentatives. Veuillez réessayer dans quelques minutes.',
                statusCode: 429,
                canRetry: true
            },
            'network': {
                message: 'Service d\'envoi SMS temporairement indisponible. Veuillez réessayer dans quelques instants.',
                statusCode: 503,
                canRetry: true
            }
        };
        
        // Chercher une correspondance pour WinSMS
        for (const [key, value] of Object.entries(winSmsErrorMap)) {
            if (errorMessage.toLowerCase().includes(key)) {
                return value;
            }
        }
    }
    
    // Erreurs Twilio et par défaut
    const defaultErrorMap = {
        'Authenticate': {
            message: 'Service d\'envoi SMS temporairement indisponible. Veuillez réessayer dans quelques instants.',
            statusCode: 503,
            canRetry: true
        },
        'Authentication': {
            message: 'Service d\'envoi SMS temporairement indisponible. Veuillez réessayer dans quelques instants.',
            statusCode: 503,
            canRetry: true
        },
        'Twilio non disponible': {
            message: 'Service d\'envoi SMS non configuré. Contactez l\'administrateur.',
            statusCode: 503,
            canRetry: false
        },
        'Numéro de téléphone invalide': {
            message: 'Le numéro de téléphone fourni est invalide',
            statusCode: 400,
            canRetry: false
        },
        'Échec de l\'envoi OTP': {
            message: 'Impossible d\'envoyer le code de vérification. Veuillez réessayer.',
            statusCode: 500,
            canRetry: true
        }
    };
    
    // Chercher une correspondance dans le message d'erreur
    for (const [key, value] of Object.entries(defaultErrorMap)) {
        if (errorMessage.includes(key)) {
            return value;
        }
    }
    
    // Erreur par défaut
    return {
        message: 'Une erreur est survenue lors de l\'envoi du code',
        statusCode: 500,
        canRetry: true
    };
};

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
    
    // Test des services SMS (WinSMS et Twilio)
    const smsServicesTest = await SMSRouterService.testConnection();
    
    res.status(200).json({ 
      message: 'Serveur connecté avec succès',
      database: { connected: true, users: userCount },
      smsServices: smsServicesTest
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

    // Validation du numéro de téléphone (format E.164: +[1-3 digits country code][6-14 digits])
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      console.log('Numéro invalide:', phoneNumber);
      return res.status(400).json({ message: 'Numéro de téléphone invalide' });
    }

    // Valider le format E.164 international: +[country code][number]
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (!e164Regex.test(phoneNumber)) {
      console.log('Format E.164 invalide:', phoneNumber);
      return res.status(400).json({ message: 'Numéro de téléphone doit être au format international (ex: +216XXXXXXXX)' });
    }

    // Vérifier si l'utilisateur existe
    let user = await User.findOne({ phoneNumber });
    console.log('Utilisateur trouvé:', user ? 'Oui' : 'Non');

    if (!user) {
      // Créer un nouvel utilisateur s'il n'existe pas
      console.log('Création d\'un nouveau utilisateur pour:', phoneNumber);
      console.log('📋 [loginUser] Tentative création utilisateur:', { 
        phoneNumber, 
        role: 'client',
        timestamp: new Date().toISOString()
      });
      
      // Vérification préventive améliorée
      try {
        const existingUser = await User.findOne({ phoneNumber });
        if (existingUser) {
          console.log('⚠️ [loginUser] Utilisateur existe déjà avec rôle différent:', {
            phoneNumber,
            existingRole: existingUser.role,
            existingId: existingUser._id
          });
          return res.status(400).json({
            message: `Ce numéro est déjà utilisé pour un compte de type ${existingUser.role || 'utilisateur'}`,
            field: 'phoneNumber',
            canRetry: false
          });
        }
      } catch (checkError) {
        console.error('❌ [loginUser] Erreur vérification préventive:', checkError);
        return res.status(500).json({
          message: 'Erreur lors de la vérification du numéro de téléphone',
          canRetry: true
        });
      }
      
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
        console.log('✅ [loginUser] Nouvel utilisateur créé avec ID:', user._id);
      } catch (createError) {
        console.error('❌ [loginUser] Erreur création utilisateur:', {
          error: createError,
          code: createError.code,
          message: createError.message,
          stack: createError.stack,
          phoneNumber,
          timestamp: new Date().toISOString()
        });
        
        // Gestion spécifique des erreurs E11000
        if (createError.code === 11000) {
          const errorInfo = getDuplicateKeyErrorMessage(createError);
          
          // Cas spécial pour securityCode null - indique un problème d'index
          if (errorInfo.field === 'securityCode' && createError.keyValue?.securityCode === null) {
            console.error('🚨 [loginUser] ERREUR CRITIQUE: Index securityCode non-sparse détecté!');
            console.error('🚨 [loginUser] ACTION REQUISE: Relancer le script de migration fixSecurityCodeIndex.js');
          }
          
          return res.status(errorInfo.statusCode).json({
            message: errorInfo.message,
            field: errorInfo.field,
            canRetry: errorInfo.canRetry,
            error: process.env.NODE_ENV === 'development' ? createError.message : undefined
          });
        }
        
        // Autres erreurs MongoDB
        if (createError.name === 'MongoError' || createError.name === 'MongoServerError') {
          console.error('❌ [loginUser] Erreur MongoDB:', {
            name: createError.name,
            code: createError.code,
            errorLabels: createError.errorLabels
          });
          return res.status(500).json({
            message: 'Erreur de base de données lors de la création du compte',
            canRetry: true,
            error: process.env.NODE_ENV === 'development' ? createError.message : undefined
          });
        }
        
        // Erreurs générales
        return res.status(500).json({
          message: 'Erreur lors de la création du compte',
          canRetry: true,
          error: process.env.NODE_ENV === 'development' ? createError.message : undefined
        });
      }
    }

    // Vérifier le statut de vérification
    console.log('Statut de vérification:', user.isVerified);

    if (user.isVerified) {
      // Vérifier si l'utilisateur a un code de sécurité
      if (user.securityCode && user.role === 'client') {
        console.log('Utilisateur vérifié avec code de sécurité, redirection vers SecurityCodeScreen');
        return res.status(200).json({
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          role: user.role,
          isVerified: true,
          hasSecurityCode: true,
          message: 'Code de sécurité requis'
        });
      }
      
      // Si l'utilisateur est déjà vérifié sans code de sécurité, connexion directe
      console.log('Utilisateur déjà vérifié, connexion directe');
      return res.status(200).json({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
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

        // Essayer d'envoyer l'OTP via le service approprié (WinSMS ou Twilio)
        try {
          const result = await SMSRouterService.sendOTP(phoneNumber, otp);
          console.log(`✓ OTP envoyé avec succès via ${result.provider}:`, result.channels);
          console.log('Détails:', result);
          
          // Déterminer le message selon le provider et les canaux utilisés
          let message = 'Code de vérification généré';
          const channels = result.channels || [];
          
          if (result.provider === 'winsms') {
            message = 'Code de vérification envoyé par SMS (WinSMS)';
          } else if (result.provider === 'twilio') {
            if (channels.includes('whatsapp') && channels.includes('sms')) {
              message = 'Code de vérification envoyé par WhatsApp et SMS';
            } else if (channels.includes('whatsapp')) {
              message = 'Code de vérification envoyé par WhatsApp';
            } else if (channels.includes('sms')) {
              message = 'Code de vérification envoyé par SMS';
            }
          }
          
          return res.status(200).json({
            _id: user._id,
            phoneNumber: user.phoneNumber,
            isVerified: false,
            channelsSent: channels,
            provider: result.provider,
            otpSent: true,
            message
          });
          
        } catch (smsError) {
          console.error('❌ Erreur envoi OTP:', smsError.message);
          
          // Supprimer l'OTP de la base de données car il n'a pas été envoyé
          await OTP.deleteMany({ phone: phoneNumber });
          console.log('OTP supprimé car non envoyé');
          
          const errorInfo = getOTPErrorMessage(smsError);
          
          return res.status(errorInfo.statusCode).json({
            message: errorInfo.message,
            error: smsError.message,
            otpSent: false,
            canRetry: errorInfo.canRetry
          });
        }

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

// @desc    Vérifier le code de sécurité client
// @route   POST /api/auth/verify-security-code
// @access  Public
exports.verifySecurityCode = async (req, res) => {
  const { phoneNumber, securityCode } = req.body;

  try {
    console.log('=== DEBUT VERIFICATION CODE SECURITE CLIENT ===');
    console.log('Vérification pour:', phoneNumber);

    // Validation des paramètres
    if (!phoneNumber || !securityCode) {
      return res.status(400).json({ 
        message: 'Numéro de téléphone et code de sécurité requis' 
      });
    }

    // Vérifier si l'utilisateur existe
    const user = await User.findOne({ phoneNumber, role: 'client' });
    
    if (!user) {
      console.log('Utilisateur non trouvé');
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Vérifier si l'utilisateur est vérifié
    if (!user.isVerified) {
      return res.status(400).json({ 
        message: 'Compte non vérifié. Veuillez d\'abord vérifier votre numéro de téléphone.' 
      });
    }

    // Vérifier si l'utilisateur a un code de sécurité
    if (!user.securityCode) {
      return res.status(400).json({ 
        message: 'Aucun code de sécurité configuré pour ce compte' 
      });
    }

    // === SECURITY CODE VALIDATION WITH RATE LIMITING ===
    
    // Vérifier si le compte est verrouillé
    if (user.securityCodeLockedUntil && new Date() < user.securityCodeLockedUntil) {
      const minutesRemaining = Math.ceil(
        (user.securityCodeLockedUntil - new Date()) / (1000 * 60)
      );
      console.warn(`⚠️ [Security] Client ${user._id} verrouillé jusqu'à ${user.securityCodeLockedUntil}`);
      return res.status(429).json({
        message: `Trop de tentatives. Réessayez dans ${minutesRemaining} minutes.`
      });
    }

    // Valider le code de sécurité
    const { validateSecurityCode } = require('../utils/securityCodeGenerator');
    
    if (!validateSecurityCode(securityCode, user.securityCode)) {
      // Incrémenter les tentatives échouées
      user.failedSecurityCodeAttempts = (user.failedSecurityCodeAttempts || 0) + 1;
      console.warn(`⚠️ [Security] Code invalide pour client ${user._id}. Tentatives: ${user.failedSecurityCodeAttempts}`);

      // Verrouiller après 5 tentatives échouées pour 15 minutes
      if (user.failedSecurityCodeAttempts >= 5) {
        user.securityCodeLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        console.warn(`🔒 [Security] Client ${user._id} verrouillé jusqu'à ${user.securityCodeLockedUntil}`);
      }

      await user.save({ validateBeforeSave: false });
      return res.status(401).json({
        message: 'Code de sécurité incorrect',
        attemptsRemaining: Math.max(0, 5 - user.failedSecurityCodeAttempts)
      });
    }

    // Code de sécurité validé avec succès - réinitialiser les compteurs
    console.log(`✅ [Security] Code de sécurité validé pour client ${user._id}`);
    if (user.failedSecurityCodeAttempts > 0) {
      user.failedSecurityCodeAttempts = 0;
    }
    if (user.securityCodeLockedUntil) {
      user.securityCodeLockedUntil = null;
    }
    await user.save({ validateBeforeSave: false });

    // === END SECURITY CODE VALIDATION ===

    // Générer le token JWT
    const token = generateToken(user._id);

    console.log('✅ Connexion réussie avec code de sécurité');
    return res.status(200).json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      role: user.role,
      isVerified: user.isVerified,
      token,
      message: 'Connexion réussie'
    });

  } catch (error) {
    console.error('=== ERREUR VERIFICATION CODE SECURITE ===');
    console.error('Erreur complète:', error);
    res.status(500).json({ 
      message: 'Erreur serveur lors de la vérification',
      error: error.message
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
    console.error('❌ [registerUser] Erreur création utilisateur:', {
      error: error,
      code: error.code,
      message: error.message,
      stack: error.stack,
      phoneNumber,
      firstName,
      timestamp: new Date().toISOString()
    });
    
    // Gestion spécifique des erreurs E11000
    if (error.code === 11000) {
      const errorInfo = getDuplicateKeyErrorMessage(error);
      
      // Cas spécial pour securityCode null - indique un problème d'index
      if (errorInfo.field === 'securityCode' && error.keyValue?.securityCode === null) {
        console.error('🚨 [registerUser] ERREUR CRITIQUE: Index securityCode non-sparse détecté!');
        console.error('🚨 [registerUser] ACTION REQUISE: Relancer le script de migration fixSecurityCodeIndex.js');
      }
      
      return res.status(errorInfo.statusCode).json({
        message: errorInfo.message,
        field: errorInfo.field,
        canRetry: errorInfo.canRetry,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    // Autres erreurs MongoDB
    if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      console.error('❌ [registerUser] Erreur MongoDB:', {
        name: error.name,
        code: error.code,
        errorLabels: error.errorLabels
      });
      return res.status(500).json({
        message: 'Erreur de base de données lors de la création du compte',
        canRetry: true,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    // Erreurs générales
    res.status(500).json({
      message: 'Erreur serveur lors de la création du compte',
      canRetry: true,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Enregistrer un nouvel administrateur super
// @route   POST /api/auth/register-super-admin
// @access  Public (mais devrait être sécurisé en production)
exports.registerSuperAdmin = async (req, res) => {
  const { email, password, firstName, lastName,role } = req.body;

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
      role: role || 'superAdmin',
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

    // Generate unique security code for deliverer
    let securityCode;
    try {
      securityCode = await generateUniqueSecurityCode('deliverer', 5);
      console.log(`🔐 [Deliverer Registration] Generated security code: ${securityCode}`);
    } catch (codeError) {
      console.error('Erreur génération code de sécurité:', codeError.message);
      return res.status(500).json({
        message: 'Impossible de générer un code de sécurité. Veuillez réessayer.'
      });
    }

    // Créer le livreur
    const deliverer = await User.create({
      phoneNumber,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email || null,
      vehicle: vehicle || '',
      role: 'deliverer',
      securityCode: securityCode,
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
        securityCode: deliverer.securityCode,
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
    console.error('❌ [registerDeliverer] Erreur création livreur:', {
      error: error,
      code: error.code,
      message: error.message,
      stack: error.stack,
      phoneNumber,
      firstName,
      lastName,
      email,
      vehicle,
      securityCode: securityCode || 'non-généré',
      timestamp: new Date().toISOString()
    });
    
    // Gestion spécifique des erreurs E11000
    if (error.code === 11000) {
      const errorInfo = getDuplicateKeyErrorMessage(error);
      
      // Cas spécial pour securityCode - très important pour les livreurs
      if (errorInfo.field === 'securityCode') {
        console.error('🚨 [registerDeliverer] Conflit de code de sécurité détecté!');
        console.error('🚨 [registerDeliverer] Code en conflit:', error.keyValue?.securityCode);
        console.error('🚨 [registerDeliverer] ACTION: Vérifier l\'unicité des codes ou relancer la génération');
      }
      
      // Cas spécial pour securityCode null - indique un problème d'index
      if (errorInfo.field === 'securityCode' && error.keyValue?.securityCode === null) {
        console.error('🚨 [registerDeliverer] ERREUR CRITIQUE: Index securityCode non-sparse détecté!');
        console.error('🚨 [registerDeliverer] ACTION REQUISE: Relancer le script de migration fixSecurityCodeIndex.js');
      }
      
      return res.status(errorInfo.statusCode).json({
        message: errorInfo.message,
        field: errorInfo.field,
        canRetry: errorInfo.canRetry,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    // Autres erreurs MongoDB
    if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      console.error('❌ [registerDeliverer] Erreur MongoDB:', {
        name: error.name,
        code: error.code,
        errorLabels: error.errorLabels
      });
      return res.status(500).json({
        message: 'Erreur de base de données lors de la création du compte livreur',
        canRetry: true,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    // Erreurs générales
    res.status(500).json({
      message: 'Erreur serveur lors de la création du livreur',
      canRetry: true,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Connecter un livreur
// @route   POST /api/auth/login-deliverer
// @access  Public
exports.loginDeliverer = async (req, res) => {
  const { phoneNumber, securityCode } = req.body;

  // Validate required phoneNumber parameter
  if (!phoneNumber) {
    return res.status(400).json({
      message: 'Numéro de téléphone requis'
    });
  }

  // Check if backward compatibility mode is enabled (default: false - security code required)
  const requireSecurityCode = process.env.REQUIRE_DELIVERER_SECURITY_CODE !== 'false';

  // Validate security code only if required
  if (requireSecurityCode && !securityCode) {
    return res.status(400).json({
      message: 'Code de sécurité requis'
    });
  }

  // Warn if compatibility mode is enabled (security code not required)
  if (!requireSecurityCode) {
    console.warn('⚠️ [Compatibility Mode] Connexion livreur sans code de sécurité activée');
  }

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
        // Generate unique security code for new deliverer
        const newSecurityCode = await generateUniqueSecurityCode('deliverer', 5);
        console.log(`🔐 [Deliverer Login] Generated security code for new deliverer: ${newSecurityCode}`);

        deliverer = await User.create({
          phoneNumber: normalizedPhone,
          firstName: '', // Sera rempli plus tard
          lastName: '',
          securityCode: newSecurityCode,
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

    // === SECURITY CODE VALIDATION ===
    // Skip validation if security code not required (compatibility mode)
    if (requireSecurityCode) {
      // Check if deliverer is locked due to too many failed attempts
      if (deliverer.securityCodeLockedUntil && new Date() < deliverer.securityCodeLockedUntil) {
        const minutesRemaining = Math.ceil(
          (deliverer.securityCodeLockedUntil - new Date()) / (1000 * 60)
        );
        console.warn(`⚠️ [Security] Deliverer ${deliverer._id} locked until ${deliverer.securityCodeLockedUntil}`);
        return res.status(429).json({
          message: `Trop de tentatives. Réessayez dans ${minutesRemaining} minutes.`
        });
      }

      // Validate security code
      const { validateSecurityCode } = require('../utils/securityCodeGenerator');

      if (!deliverer.securityCode) {
        // Legacy deliverer without security code - auto-generate on save
        console.warn(`⚠️ [Security] Deliverer ${deliverer._id} missing security code. Auto-generating...`);
        // Trigger pre-save hook by saving
        await deliverer.save({ validateBeforeSave: false });
        console.log(`🔐 [Security] Security code auto-generated for deliverer ${deliverer._id}`);
      }

      // Compare provided code with stored code
      if (!validateSecurityCode(securityCode, deliverer.securityCode)) {
        // Increment failed attempts
        deliverer.failedSecurityCodeAttempts = (deliverer.failedSecurityCodeAttempts || 0) + 1;
        console.warn(`⚠️ [Security] Invalid security code for deliverer ${deliverer._id}. Attempts: ${deliverer.failedSecurityCodeAttempts}`);

        // Lock after 5 failed attempts for 15 minutes
        if (deliverer.failedSecurityCodeAttempts >= 5) {
          deliverer.securityCodeLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
          console.warn(`🔒 [Security] Deliverer ${deliverer._id} locked until ${deliverer.securityCodeLockedUntil}`);
        }

        await deliverer.save({ validateBeforeSave: false });
        return res.status(401).json({
          message: 'Identifiants invalides'
        });
      }

      // Security code validation successful - reset failed attempts
      console.log(`✅ [Security] Code de sécurité validé avec succès pour livreur ${deliverer._id}`);
      if (deliverer.failedSecurityCodeAttempts > 0) {
        deliverer.failedSecurityCodeAttempts = 0;
      }
      if (deliverer.securityCodeLockedUntil) {
        deliverer.securityCodeLockedUntil = null;
      }
    } else {
      // Compatibility mode - allow login without security code validation
      console.warn(`⚠️ [Compatibility Mode] Skipping security code validation for deliverer ${deliverer._id}`);
    }
    // === END SECURITY CODE VALIDATION ===

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

    // Vérifier que le mot de passe existe
    if (!provider.password) {
      console.log('Pas de mot de passe stocké pour le prestataire:', normalizedEmail);
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

// ============= OTP MONITORING ENDPOINTS =============

// Check OTP Service Health
exports.checkOTPServiceHealth = async (req, res) => {
  try {
    // Test the connection
    const connectionTest = await OTPService.testConnection();
    
    // Get recent success rate (last 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentLogs = await OTPLog.find({
      createdAt: { $gte: oneHourAgo }
    });
    
    const successCount = recentLogs.filter(log => log.status === 'success').length;
    const totalCount = recentLogs.length;
    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 100;
    
    // Get credential validation status
    const credentialsValid = await OTPService.validateCredentials();
    
    const health = {
      status: connectionTest.success && credentialsValid.valid ? 'healthy' : 'unhealthy',
      timestamp: new Date(),
      details: {
        twilio_connection: connectionTest.success ? 'connected' : 'disconnected',
        credentials_valid: credentialsValid.valid,
        recent_success_rate: parseFloat(successRate.toFixed(2)),
        attempts_last_hour: totalCount,
        successful_sends: successCount
      }
    };
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('Error checking OTP service health:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check OTP service health',
      error: error.message
    });
  }
};

// Get OTP Metrics
exports.getOTPMetrics = async (req, res) => {
  try {
    // Get metrics for different time periods
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // Aggregation pipeline for detailed metrics
    const metricsAggregation = [
      {
        $facet: {
          lastHour: [
            { $match: { createdAt: { $gte: oneHourAgo } } },
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
                avgResponseTime: { $avg: '$responseTime' },
                channels: { $push: '$channel' }
              }
            }
          ],
          last24Hours: [
            { $match: { createdAt: { $gte: twentyFourHoursAgo } } },
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
                avgResponseTime: { $avg: '$responseTime' },
                channels: { $push: '$channel' }
              }
            }
          ],
          last7Days: [
            { $match: { createdAt: { $gte: sevenDaysAgo } } },
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
                avgResponseTime: { $avg: '$responseTime' },
                channels: { $push: '$channel' }
              }
            }
          ],
          errorDistribution: [
            { $match: { 'errorDetails.type': { $exists: true } } },
            {
              $group: {
                _id: '$errorDetails.type',
                count: { $sum: 1 },
                lastOccurrence: { $max: '$createdAt' }
              }
            },
            { $sort: { count: -1 } }
          ],
          channelComparison: [
            {
              $group: {
                _id: '$channel',
                totalAttempts: { $sum: 1 },
                successCount: {
                  $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
                },
                avgResponseTime: { $avg: '$responseTime' }
              }
            }
          ]
        }
      }
    ];
    
    const metrics = await OTPLog.aggregate(metricsAggregation);
    
    res.status(200).json({
      timestamp: new Date(),
      metrics: metrics[0]
    });
  } catch (error) {
    console.error('Error getting OTP metrics:', error);
    res.status(500).json({
      message: 'Failed to retrieve OTP metrics',
      error: error.message
    });
  }
};

// Get OTP Service Status (Dashboard view)
exports.getOTPServiceStatus = async (req, res) => {
  try {
    // Get health check
    const connectionTest = await OTPService.testConnection();
    const credentialsValid = await OTPService.validateCredentials();
    
    // Get recent activity
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentLogs = await OTPLog.find({
      createdAt: { $gte: twentyFourHoursAgo }
    }).sort({ createdAt: -1 }).limit(10);
    
    // Get error trends
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentErrors = await OTPLog.aggregate([
      { $match: { createdAt: { $gte: oneHourAgo }, status: 'failed' } },
      {
        $group: {
          _id: '$errorDetails.type',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    // Get success rate for last hour
    const oneHourLogs = await OTPLog.find({
      createdAt: { $gte: oneHourAgo }
    });
    const successCount = oneHourLogs.filter(log => log.status === 'success').length;
    const successRate = oneHourLogs.length > 0 ? (successCount / oneHourLogs.length) * 100 : 100;
    
    const status = {
      timestamp: new Date(),
      health: {
        twilio_connection: connectionTest.success ? 'connected' : 'disconnected',
        credentials_valid: credentialsValid.valid,
        overall_status: connectionTest.success && credentialsValid.valid ? 'operational' : 'degraded'
      },
      performance: {
        success_rate_last_hour: parseFloat(successRate.toFixed(2)),
        total_attempts_last_hour: oneHourLogs.length,
        successful_sends: successCount
      },
      recent_errors: recentErrors.slice(0, 5),
      recent_activity: recentLogs.map(log => ({
        phoneNumber: log.phoneNumber,
        status: log.status,
        channel: log.channel,
        errorType: log.errorDetails?.type || null,
        timestamp: log.createdAt
      }))
    };
    
    res.status(200).json(status);
  } catch (error) {
    console.error('Error getting OTP service status:', error);
    res.status(500).json({
      message: 'Failed to retrieve OTP service status',
      error: error.message
    });
  }
};

// Test OTP Service
exports.testOTPService = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    // Validate phone number
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return res.status(400).json({
        message: 'Phone number is required'
      });
    }
    
    // Generate a test OTP (6-digit code)
    const testOTP = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Send test OTP via SMS Router
    const testResult = await SMSRouterService.sendOTP(phoneNumber, testOTP);
    console.log(`Test SMS sent via ${testResult.provider}`);
    
    // Determine which channel was used for logging
    const channels = testResult.channels || [];
    const logChannel = channels.length > 0 ? channels[0] : 'sms';
    
    // Create log entry with valid data from test
    const testLog = new OTPLog({
      phoneNumber,
      otp: testOTP,
      channel: logChannel,
      status: testResult.success ? 'success' : 'partial',
      attempts: 1,
      responseTime: testResult.responseTime || 0,
      twilioResponses: testResult.responses || [],
      credentialsValid: true,
      metadata: {
        isTest: true,
        testedAt: new Date()
      }
    });
    
    await testLog.save();
    
    res.status(200).json({
      message: 'OTP test successful',
      data: {
        phoneNumber,
        channels: channels,
        otp: testOTP,
        status: testResult.success ? 'sent' : 'partial',
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Error testing OTP service:', error);
    
    // Log the failed test
    const { phoneNumber } = req.body;
    if (phoneNumber) {
      const failedLog = new OTPLog({
        phoneNumber,
        otp: 'test',
        channel: 'unknown',
        status: 'failed',
        attempts: 1,
        responseTime: 0,
        errorDetails: {
          type: 'test_failure',
          message: error.message,
          code: error.code || 'UNKNOWN'
        },
        metadata: {
          isTest: true,
          testedAt: new Date()
        }
      });
      
      await failedLog.save().catch(logError => {
        console.error('Failed to log test error:', logError);
      });
    }
    
    res.status(500).json({
      message: 'OTP test failed',
      error: error.message
    });
  }
};

// ============= WINSMS MONITORING ENDPOINTS =============

// Test WinSMS Connection (connection check only, no SMS sent)
exports.testWinSMSConnection = async (req, res) => {
  try {
    const WinSMSService = require('../services/winSmsService');
    const winSmsService = new WinSMSService();
    
    const connectionTest = await winSmsService.testConnection();
    
    res.status(connectionTest.success ? 200 : 503).json({
      message: connectionTest.success ? 'WinSMS connection successful' : 'WinSMS connection failed',
      timestamp: new Date(),
      data: {
        provider: 'winsms',
        connected: connectionTest.success,
        balance: connectionTest.balance,
        error: connectionTest.error
      }
    });
  } catch (error) {
    console.error('Error testing WinSMS connection:', error);
    res.status(500).json({
      message: 'Failed to test WinSMS connection',
      error: error.message
    });
  }
};

// Check WinSMS Service Health
exports.checkWinSMSServiceHealth = async (req, res) => {
  try {
    const WinSMSLog = require('../models/WinSMSLog');
    const WinSMSService = require('../services/winSmsService');
    const winSmsService = new WinSMSService();
    
    // Test connection
    const connectionTest = await winSmsService.testConnection();
    
    // Exclude test entries from production health check
    const testFilter = { 'metadata.isTest': { $ne: true } };
    
    // Get recent success rate (last 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentLogs = await WinSMSLog.find({
      createdAt: { $gte: oneHourAgo },
      ...testFilter
    });
    
    const successCount = recentLogs.filter(log => log.status === 'success').length;
    const totalCount = recentLogs.length;
    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 100;
    
    const health = {
      status: connectionTest.success ? 'healthy' : 'unhealthy',
      timestamp: new Date(),
      details: {
        winsms_connection: connectionTest.success ? 'connected' : 'disconnected',
        balance: connectionTest.balance,
        recent_success_rate: parseFloat(successRate.toFixed(2)),
        attempts_last_hour: totalCount,
        successful_sends: successCount
      }
    };
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('Error checking WinSMS service health:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check WinSMS service health',
      error: error.message
    });
  }
};

// Get WinSMS Metrics
exports.getWinSMSMetrics = async (req, res) => {
  try {
    const WinSMSLog = require('../models/WinSMSLog');
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // Exclude test entries from production metrics
    const testFilter = { 'metadata.isTest': { $ne: true } };
    
    const metricsAggregation = [
      {
        $facet: {
          lastHour: [
            { $match: { createdAt: { $gte: oneHourAgo }, ...testFilter } },
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
                avgResponseTime: { $avg: '$responseTime' }
              }
            }
          ],
          last24Hours: [
            { $match: { createdAt: { $gte: twentyFourHoursAgo }, ...testFilter } },
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
                avgResponseTime: { $avg: '$responseTime' }
              }
            }
          ],
          last7Days: [
            { $match: { createdAt: { $gte: sevenDaysAgo }, ...testFilter } },
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
                avgResponseTime: { $avg: '$responseTime' }
              }
            }
          ],
          errorDistribution: [
            { $match: { 'errorDetails.type': { $exists: true }, ...testFilter } },
            {
              $group: {
                _id: '$errorDetails.type',
                count: { $sum: 1 },
                lastOccurrence: { $max: '$createdAt' }
              }
            },
            { $sort: { count: -1 } }
          ]
        }
      }
    ];
    
    const metrics = await WinSMSLog.aggregate(metricsAggregation);
    
    res.status(200).json({
      timestamp: new Date(),
      provider: 'winsms',
      metrics: metrics[0]
    });
  } catch (error) {
    console.error('Error getting WinSMS metrics:', error);
    res.status(500).json({
      message: 'Failed to retrieve WinSMS metrics',
      error: error.message
    });
  }
};

// Get WinSMS Service Status (Dashboard view)
exports.getWinSMSServiceStatus = async (req, res) => {
  try {
    const WinSMSLog = require('../models/WinSMSLog');
    const WinSMSService = require('../services/winSmsService');
    const winSmsService = new WinSMSService();
    
    const connectionTest = await winSmsService.testConnection();
    
    // Exclude test entries from production status
    const testFilter = { 'metadata.isTest': { $ne: true } };
    
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentLogs = await WinSMSLog.find({
      createdAt: { $gte: twentyFourHoursAgo },
      ...testFilter
    }).sort({ createdAt: -1 }).limit(10);
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentErrors = await WinSMSLog.aggregate([
      { $match: { createdAt: { $gte: oneHourAgo }, status: 'failed', ...testFilter } },
      {
        $group: {
          _id: '$errorDetails.type',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    const oneHourLogs = await WinSMSLog.find({
      createdAt: { $gte: oneHourAgo },
      ...testFilter
    });
    const successCount = oneHourLogs.filter(log => log.status === 'success').length;
    const successRate = oneHourLogs.length > 0 ? (successCount / oneHourLogs.length) * 100 : 100;
    
    const status = {
      timestamp: new Date(),
      provider: 'winsms',
      health: {
        winsms_connection: connectionTest.success ? 'connected' : 'disconnected',
        balance: connectionTest.balance,
        overall_status: connectionTest.success ? 'operational' : 'degraded'
      },
      performance: {
        success_rate_last_hour: parseFloat(successRate.toFixed(2)),
        total_attempts_last_hour: oneHourLogs.length,
        successful_sends: successCount
      },
      recent_errors: recentErrors.slice(0, 5),
      recent_activity: recentLogs.map(log => ({
        phoneNumber: log.phoneNumber,
        status: log.status,
        errorType: log.errorDetails?.type || null,
        timestamp: log.createdAt
      }))
    };
    
    res.status(200).json(status);
  } catch (error) {
    console.error('Error getting WinSMS service status:', error);
    res.status(500).json({
      message: 'Failed to retrieve WinSMS service status',
      error: error.message
    });
  }
};

// Test WinSMS Service
exports.testWinSMSService = async (req, res) => {
  try {
    const WinSMSLog = require('../models/WinSMSLog');
    const WinSMSService = require('../services/winSmsService');
    const winSmsService = new WinSMSService();
    
    const { phoneNumber } = req.body;
    
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return res.status(400).json({
        message: 'Phone number is required'
      });
    }
    
    // Validate Tunisian number format (+216)
    if (!phoneNumber.startsWith('+216')) {
      return res.status(400).json({
        message: 'WinSMS only supports Tunisian numbers (+216)'
      });
    }
    
    const testOTP = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Send OTP with test metadata
    const testResult = await winSmsService.sendOTP(phoneNumber, testOTP, {
      isTest: true,
      testedAt: new Date()
    });
    
    res.status(200).json({
      message: 'WinSMS test successful',
      data: {
        phoneNumber,
        provider: 'winsms',
        otp: testOTP,
        status: testResult.success ? 'sent' : 'failed',
        messageId: testResult.messageId,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Error testing WinSMS service:', error);
    
    res.status(500).json({
      message: 'WinSMS test failed',
      error: error.message
    });
  }
};

// ============= UNIFIED SMS DASHBOARD =============

// Get Combined SMS Services Dashboard (WinSMS + Twilio)
exports.getSMSDashboard = async (req, res) => {
  try {
    const WinSMSLog = require('../models/WinSMSLog');
    const WinSMSService = require('../services/winSmsService');
    const winSmsService = new WinSMSService();
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Exclude test entries from production dashboard
    const testFilter = { 'metadata.isTest': { $ne: true } };
    
    // WinSMS Stats
    const winSmsConnection = await winSmsService.testConnection();
    const winSmsLogs = await WinSMSLog.find({ createdAt: { $gte: oneHourAgo }, ...testFilter });
    const winSmsSuccess = winSmsLogs.filter(log => log.status === 'success').length;
    const winSmsRate = winSmsLogs.length > 0 ? (winSmsSuccess / winSmsLogs.length) * 100 : 0;
    
    // Twilio Stats
    const twilioConnection = await OTPService.testConnection();
    const twilioLogs = await OTPLog.find({ createdAt: { $gte: oneHourAgo } });
    const twilioSuccess = twilioLogs.filter(log => log.status === 'success').length;
    const twilioRate = twilioLogs.length > 0 ? (twilioSuccess / twilioLogs.length) * 100 : 0;
    
    // Combined Stats (24h)
    const winSmsLogs24h = await WinSMSLog.find({ createdAt: { $gte: twentyFourHoursAgo }, ...testFilter });
    const twilioLogs24h = await OTPLog.find({ createdAt: { $gte: twentyFourHoursAgo } });
    
    const dashboard = {
      timestamp: new Date(),
      summary: {
        total_sms_sent_24h: winSmsLogs24h.length + twilioLogs24h.length,
        winsms_count_24h: winSmsLogs24h.length,
        twilio_count_24h: twilioLogs24h.length
      },
      winsms: {
        status: winSmsConnection.success ? 'operational' : 'degraded',
        balance: winSmsConnection.balance,
        success_rate_1h: parseFloat(winSmsRate.toFixed(2)),
        total_attempts_1h: winSmsLogs.length,
        successful_sends_1h: winSmsSuccess
      },
      twilio: {
        status: twilioConnection.success ? 'operational' : 'degraded',
        success_rate_1h: parseFloat(twilioRate.toFixed(2)),
        total_attempts_1h: twilioLogs.length,
        successful_sends_1h: twilioSuccess
      },
      routing: {
        tunisia_numbers: winSmsLogs.length,
        international_numbers: twilioLogs.length
      }
    };
    
    res.status(200).json(dashboard);
  } catch (error) {
    console.error('Error getting SMS dashboard:', error);
    res.status(500).json({
      message: 'Failed to retrieve SMS dashboard',
      error: error.message
    });
  }
};

// @desc    Récupérer tous les administrateurs
// @route   GET /api/auth/admins
// @access  Private (SuperAdmin)
exports.getAdmins = async (req, res) => {
  try {
    console.log('=== DEBUT GET ADMINS ===');

    // Récupérer tous les utilisateurs avec le rôle 'admin'
    const admins = await User.find({ role: 'admin' })
      .populate('city', 'name')
      .select('firstName lastName email city createdAt')
      .sort({ createdAt: -1 });

    console.log(`${admins.length} administrateurs trouvés`);

    // Formatter la réponse
    const formattedAdmins = admins.map((admin) => ({
      id: admin._id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      cityName: admin.city ? admin.city.name : 'N/A',
      cityId: admin.city ? admin.city._id : null,
      createdAt: admin.createdAt
    }));

    res.status(200).json({
      message: 'Administrateurs récupérés avec succès',
      admins: formattedAdmins
    });
  } catch (error) {
    console.error('=== ERREUR GET ADMINS ===');
    console.error('Erreur complète:', error);
    res.status(500).json({
      message: 'Erreur serveur lors de la récupération des administrateurs',
      error: error.message
    });
  }
};

// @desc    Mettre à jour un administrateur
// @route   PUT /api/auth/admins/:id
// @access  Private (SuperAdmin)
exports.updateAdmin = async (req, res) => {
  try {
    console.log('=== DEBUT UPDATE ADMIN ===');
    const { id } = req.params;
    const { email, firstName, lastName, cityId, password } = req.body;

    console.log('Tentative de mise à jour de l\'admin:', id);

    // Vérifier que l'admin existe et a le rôle 'admin'
    const admin = await User.findOne({ _id: id, role: 'admin' });
    if (!admin) {
      console.log('Admin non trouvé:', id);
      return res.status(404).json({
        message: 'Administrateur non trouvé'
      });
    }

    // Construire l'objet de mise à jour
    const updateData = {};

    // Valider et ajouter email s'il est fourni
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Format d\'email invalide' });
      }

      const normalizedEmail = email.toLowerCase();

      // Vérifier que l'email n'est pas déjà utilisé par un autre utilisateur (quelconque)
      const existingUser = await User.findOne({
        _id: { $ne: id },
        email: normalizedEmail
      });
      if (existingUser) {
        return res.status(400).json({
          message: 'Cet email est déjà utilisé par un autre utilisateur'
        });
      }

      updateData.email = normalizedEmail;
    }

    // Ajouter firstName et lastName s'ils sont fournis
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;

    // Valider et ajouter la ville s'il est fourni
    if (cityId) {
      const city = await City.findById(cityId);
      if (!city) {
        return res.status(404).json({ message: 'Ville non trouvée' });
      }
      updateData.city = cityId;
    }

    // Hasher et ajouter le mot de passe s'il est fourni
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({
          message: 'Le mot de passe doit contenir au moins 6 caractères'
        });
      }
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    // Mettre à jour l'admin
    const updatedAdmin = await User.findOneAndUpdate(
      { _id: id, role: 'admin' },
      updateData,
      { new: true }
    ).populate('city', 'name');

    console.log('Admin mis à jour avec succès:', updatedAdmin._id);

    res.status(200).json({
      message: 'Administrateur mis à jour avec succès',
      admin: {
        id: updatedAdmin._id,
        firstName: updatedAdmin.firstName,
        lastName: updatedAdmin.lastName,
        email: updatedAdmin.email,
        cityId: updatedAdmin.city ? updatedAdmin.city._id : null
      }
    });
  } catch (error) {
    console.error('=== ERREUR UPDATE ADMIN ===');
    console.error('Erreur complète:', error);

    // Gérer les erreurs de clé dupliquée MongoDB
    if (error.code === 11000) {
      const errorInfo = getDuplicateKeyErrorMessage(error);
      console.error('❌ [updateAdmin] Erreur E11000:', errorInfo);
      
      return res.status(errorInfo.statusCode).json({
        message: errorInfo.message,
        field: errorInfo.field,
        canRetry: errorInfo.canRetry,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    res.status(500).json({
      message: 'Erreur serveur lors de la mise à jour de l\'administrateur',
      error: error.message
    });
  }
};