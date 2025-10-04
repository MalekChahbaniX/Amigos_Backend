const User = require('../models/User');
const OTP = require('../models/OTP');
const jwt = require('jsonwebtoken');
const WASenderService = require('../services/WASenderService');

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
    
    // Test de WASender
    const wasenderTest = await WASenderService.testConnection();
    
    res.status(200).json({ 
      message: 'Serveur connecté avec succès',
      database: { connected: true, users: userCount },
      wasender: wasenderTest
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

        // Essayer d'envoyer l'OTP via WASender
        let whatsappSent = false;
        let errorMessage = '';

        try {
          await WASenderService.sendOTP(phoneNumber, otp);
          console.log('OTP envoyé via WhatsApp avec succès');
          whatsappSent = true;
        } catch (smsError) {
          console.error('Erreur envoi WhatsApp:', smsError.message);
          errorMessage = smsError.message;
          // On continue même si l'envoi WhatsApp échoue
        }

        // Réponse adaptée selon le succès de l'envoi
        const response = {
          _id: user._id,
          phoneNumber: user.phoneNumber,
          isVerified: false,
          otpSent: whatsappSent,
        };

        if (whatsappSent) {
          response.message = 'Code de vérification envoyé par WhatsApp';
        } else {
          response.message = 'Code de vérification généré (erreur envoi WhatsApp)';
          response.error = `Erreur WhatsApp: ${errorMessage}`;
          
          // En cas d'échec WhatsApp, on peut envoyer le code par SMS ou email
          // Ou simplement retourner le code en mode développement
          if (process.env.NODE_ENV === 'development') {
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