const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Configuration de multer pour les images de produits
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'product'));
  },
  filename: (req, file, cb) => {
    // Générer un nom unique avec l'extension originale
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Filtre pour accepter seulement les images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Seules les images sont acceptées'), false);
  }
};

// Configuration de multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  }
});

// Configuration de multer pour les images de prestataires
const providerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'provider'));
  },
  filename: (req, file, cb) => {
    // Générer un nom unique avec l'extension originale
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Configuration de multer pour provider
const uploadProvider = multer({
  storage: providerStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  }
});

// Configuration de multer pour les prescriptions
const prescriptionStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'prescription'));
  },
  filename: (req, file, cb) => {
    // Générer un nom unique avec l'extension originale
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Configuration de multer pour prescriptions
const uploadPrescription = multer({
  storage: prescriptionStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max for prescriptions
  }
});

// Route pour uploader une image de produit
router.post('/product', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier fourni' });
    }

    // Return relative path - client will prepend origin as needed
    // This avoids tying absolute URLs to runtime protocol/host
    const relativePath = `/uploads/product/${req.file.filename}`;

    // For backward compatibility, also provide absolute URL with forced HTTPS in production
    let imageUrl = relativePath;
    if (process.env.NODE_ENV === 'production') {
      // Force HTTPS in production using configured base URL or default domain
      const baseUrl = 'https://amigosdelivery25.com';
      //const baseUrl = 'http://192.168.1.104:5000';
      imageUrl = `${baseUrl}${relativePath}`;
    } else {
      // Development: construct from request
      const protocol = req.secure ? 'https' : 'http';
      const host = req.get('host');
      imageUrl = `${protocol}://${host}${relativePath}`;
    }

    res.json({
      success: true,
      imageUrl: imageUrl,
      message: 'Image uploadée avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de l\'upload:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'upload de l\'image'
    });
  }
});

// Route pour uploader une image de prestataire
router.post('/provider', uploadProvider.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier fourni' });
    }

    // Return relative path - client will prepend origin as needed
    // This avoids tying absolute URLs to runtime protocol/host
    const relativePath = `/uploads/provider/${req.file.filename}`;

    // For backward compatibility, also provide absolute URL with forced HTTPS in production
    let imageUrl = relativePath;
    if (process.env.NODE_ENV === 'production') {
      // Force HTTPS in production using configured base URL or default domain
      const baseUrl = 'https://amigosdelivery25.com';
      //const baseUrl = 'http://192.168.1.104:5000';
      imageUrl = `${baseUrl}${relativePath}`;
    } else {
      // Development: construct from request
      const protocol = req.secure ? 'https' : 'http';
      const host = req.get('host');
      imageUrl = `${protocol}://${host}${relativePath}`;
    }

    res.json({
      success: true,
      imageUrl: imageUrl,
      message: 'Image uploadée avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de l\'upload:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'upload de l\'image'
    });
  }
});

// Route pour uploader une ordonnance
router.post('/prescription', uploadPrescription.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier fourni' });
    }

    // Return relative path - client will prepend origin as needed
    // This avoids tying absolute URLs to runtime protocol/host
    const relativePath = `/uploads/prescription/${req.file.filename}`;

    // For backward compatibility, also provide absolute URL with forced HTTPS in production
    let imageUrl = relativePath;
    if (process.env.NODE_ENV === 'production') {
      // Force HTTPS in production using configured base URL or default domain
      const baseUrl = 'https://amigosdelivery25.com';
      //const baseUrl = 'http://192.168.1.104:5000';
      imageUrl = `${baseUrl}${relativePath}`;
    } else {
      // Development: construct from request
      const protocol = req.secure ? 'https' : 'http';
      const host = req.get('host');
      imageUrl = `${protocol}://${host}${relativePath}`;
    }

    res.json({
      success: true,
      imageUrl: imageUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      message: 'Ordonnance uploadée avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de l\'upload:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'upload de l\'ordonnance'
    });
  }
});

// Middleware de gestion d'erreurs pour multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Le fichier est trop volumineux (max 5MB)'
      });
    }
  }
  
  if (error.message === 'Seules les images sont acceptées') {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  res.status(500).json({
    success: false,
    message: 'Erreur lors du traitement du fichier'
  });
});

module.exports = router;