const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

module.exports = {
  protect,
  isDeliverer,
  isSuperAdmin
};