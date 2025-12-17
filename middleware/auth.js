const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  let token;

  // Check if token exists in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from token
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Token invalide, utilisateur non trouvé'
        });
      }

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(401).json({
        success: false,
        message: 'Token invalide ou expiré'
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Aucun token fourni'
    });
  }
};

// Check if user is authenticated as deliverer
const isDeliverer = (req, res, next) => {
  protect(req, res, () => {
    if (!req.user || req.user.role !== 'deliverer') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé, rôle livreur requis'
      });
    }
    next();
  });
};

// Check if user is authenticated as provider
const isProvider = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // For provider, the decoded.id is the Provider._id
      const Provider = require('../models/Provider');
      const provider = await Provider.findById(decoded.id);
      
      if (!provider) {
        return res.status(401).json({
          success: false,
          message: 'Token invalide, prestataire non trouvé'
        });
      }

      // Set req.user with provider data for compatibility
      req.user = {
        _id: provider._id,
        providerId: provider._id,
        role: 'provider',
        name: provider.name,
        email: provider.email
      };

      next();
    } catch (error) {
      console.error('Provider auth middleware error:', error);
      return res.status(401).json({
        success: false,
        message: 'Token invalide ou expiré'
      });
    }
  } else {
    return res.status(401).json({
      success: false,
      message: 'Aucun token fourni'
    });
  }
};

// Check that deliverer has an active Session document for today
// NOTE: This middleware assumes `isDeliverer` (and thus `protect`) has already run
const checkDelivererSession = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'deliverer') {
      return res.status(403).json({ success: false, message: 'Accès refusé, rôle livreur requis' });
    }

    // Prefer canonical session data on User, but verify against Session document
    const { currentSession, sessionActive, sessionDate } = req.user;

    if (!sessionActive || !currentSession) {
      return res.status(403).json({ success: false, message: 'Aucune session active. Démarrez votre session.' });
    }

    const session = await Session.findById(currentSession);
    if (!session || !session.active) {
      return res.status(403).json({ success: false, message: 'Session inactive. Démarrez votre session.' });
    }

    // Ensure the session started today (compare date-only)
    const start = new Date(session.startTime);
    start.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);

    if (start.getTime() !== today.getTime()) {
      return res.status(403).json({ success: false, message: 'Session expirée. Démarrez une nouvelle session pour aujourd\'hui.' });
    }

    // attach session to request
    req.currentSession = session;
    next();
  } catch (error) {
    console.error('Error in checkDelivererSession middleware:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur lors de la vérification de la session' });
  }
};

// Check if user is authenticated as super admin
const isSuperAdmin = (req, res, next) => {
  protect(req, res, () => {
    if (!req.user || req.user.role !== 'superAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé, rôle super admin requis'
      });
    }
    next();
  });
};

// Check if user is authenticated as admin
const isAdmin = (req, res, next) => {
  protect(req, res, () => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé, rôle admin requis'
      });
    }
    next();
  });
};

// Check if user is authenticated as admin OR superAdmin
const isAdminOrSuperAdmin = (req, res, next) => {
  protect(req, res, () => {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superAdmin')) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé, rôle admin ou super admin requis'
      });
    }
    next();
  });
};

module.exports = {
  protect,
  isDeliverer,
  isSuperAdmin,
  isAdmin,
  isAdminOrSuperAdmin,
  isProvider,
  checkDelivererSession
};