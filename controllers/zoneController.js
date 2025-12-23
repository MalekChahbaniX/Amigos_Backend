const Zone = require('../models/Zone');
const City = require('../models/City');
const { calculateDistance } = require('../utils/distanceCalculator');

// 📍 Get all zones with pagination and search
const getZones = async (req, res) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    let query = {};
    if (search) {
      query = {
        $or: [
          { number: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const zones = await Zone.find(query)
      .sort({ number: 1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Zone.countDocuments(query);
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      zones: zones.map(zone => ({
        id: zone._id,
        number: zone.number,
        minDistance: zone.minDistance,
        maxDistance: zone.maxDistance,
        price: zone.price,
        createdAt: zone.createdAt,
        updatedAt: zone.updatedAt
      })),
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: total,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 📍 Get zone by ID
const getZoneById = async (req, res) => {
  try {
    const { id } = req.params;
    const zone = await Zone.findById(id);

    if (!zone) {
      return res.status(404).json({ message: "Zone non trouvée" });
    }

    res.json({
      id: zone._id,
      number: zone.number,
      minDistance: zone.minDistance,
      maxDistance: zone.maxDistance,
      price: zone.price,
      createdAt: zone.createdAt,
      updatedAt: zone.updatedAt
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🆕 Create new zone
const createZone = async (req, res) => {
  try {
    const { number, minDistance, maxDistance, price } = req.body;

    // Ensure 3 decimal precision for distances
    const minDist = Number(minDistance);
    const maxDist = Number(maxDistance);
    
    if (maxDist <= minDist) {
      return res.status(400).json({ message: "La distance maximale doit être supérieure à la distance minimale" });
    }

    // Check for overlapping zones
    const allZones = await Zone.find({}).sort({ minDistance: 1 });
    
    for (const existingZone of allZones) {
      // Check if new zone overlaps with existing zone
      if ((minDist < existingZone.maxDistance && maxDist > existingZone.minDistance) ||
          (minDist === existingZone.maxDistance) ||
          (maxDist === existingZone.minDistance)) {
        return res.status(400).json({
          message: `La zone chevauche une zone existante (${existingZone.number}: ${existingZone.minDistance}km - ${existingZone.maxDistance}km)`
        });
      }
    }

    const zone = new Zone({
      number,
      minDistance: Number(minDist.toFixed(3)),
      maxDistance: Number(maxDist.toFixed(3)),
      price
    });

    const savedZone = await zone.save();

    res.status(201).json({
      message: "Zone créée avec succès",
      zone: {
        id: savedZone._id,
        number: savedZone.number,
        minDistance: savedZone.minDistance,
        maxDistance: savedZone.maxDistance,
        price: savedZone.price
      }
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: err.message });
  }
};

// ✏️ Update zone
const updateZone = async (req, res) => {
  try {
    const { id } = req.params;
    const { number, minDistance, maxDistance, price } = req.body;

    // Check if new zone number conflicts with existing zone
    if (number) {
      const existingZone = await Zone.findOne({ number, _id: { $ne: id } });
      if (existingZone) {
        return res.status(400).json({ message: "Un zone avec ce numéro existe déjà" });
      }
    }

    // Manual validation for maxDistance > minDistance with 3 decimal precision
    if (minDistance !== undefined && maxDistance !== undefined) {
      const minDist = Number(minDistance);
      const maxDist = Number(maxDistance);
      
      if (maxDist <= minDist) {
        return res.status(400).json({ message: "La distance maximale doit être supérieure à la distance minimale" });
      }
      
      // Check for overlapping zones (excluding current zone being updated)
      const allOtherZones = await Zone.find({ _id: { $ne: id } }).sort({ minDistance: 1 });
      
      for (const existingZone of allOtherZones) {
        // Check if updated zone overlaps with existing zone
        if ((minDist < existingZone.maxDistance && maxDist > existingZone.minDistance) ||
            (minDist === existingZone.maxDistance) ||
            (maxDist === existingZone.minDistance)) {
          return res.status(400).json({
            message: `La zone chevauche une zone existante (${existingZone.number}: ${existingZone.minDistance}km - ${existingZone.maxDistance}km)`
          });
        }
      }
      
      // Ensure 3 decimal precision for consistency
      if (minDistance !== undefined) {
        req.body.minDistance = Number(minDist.toFixed(3));
      }
      if (maxDistance !== undefined) {
        req.body.maxDistance = Number(maxDist.toFixed(3));
      }
    }

    const zone = await Zone.findByIdAndUpdate(
      id,
      { number, minDistance, maxDistance, price },
      { new: true, runValidators: true }
    );

    if (!zone) {
      return res.status(404).json({ message: "Zone non trouvée" });
    }

    res.json({
      message: "Zone mise à jour avec succès",
      zone: {
        id: zone._id,
        number: zone.number,
        minDistance: zone.minDistance,
        maxDistance: zone.maxDistance,
        price: zone.price
      }
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: err.message });
  }
};

// 🗑️ Delete zone
const deleteZone = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the zone first to get its number
    const zone = await Zone.findById(id);
    if (!zone) {
      return res.status(404).json({ message: "Zone non trouvée" });
    }

    // Check if zone is used by any city (using zone number, not ID)
    const citiesUsingZone = await City.find({ activeZones: zone.number });
    if (citiesUsingZone.length > 0) {
      return res.status(400).json({
        message: "Impossible de supprimer cette zone car elle est utilisée par des villes"
      });
    }

    // Delete the zone
    await Zone.findByIdAndDelete(id);

    res.json({ message: "Zone supprimée avec succès" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 📍 Déterminer la zone de l’utilisateur
const getUserZone = async (req, res) => {
  try {
    const { userLat, userLng, cityId, destLat, destLng } = req.body;
    const distance = calculateDistance(userLat, userLng, destLat, destLng);

    const city = await City.findById(cityId);
    if (!city) {
      return res.status(404).json({ message: "Ville non trouvée" });
    }

    const activeZones = await Zone.find({ number: { $in: city.activeZones } });

    // Sort zones by minDistance to ensure proper order
    activeZones.sort((a, b) => a.minDistance - b.minDistance);

    const matchedZone = activeZones.find(
      (z) => distance >= z.minDistance && distance < z.maxDistance
    );

    if (!matchedZone)
      return res.status(404).json({ message: "Aucune zone trouvée" });

    res.json({
      zone: matchedZone.number,
      distance: distance.toFixed(3), // Use 3 decimal places for distance
      price: matchedZone.price,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🛠️ Modifier tarif d’une zone
const updateZonePrice = async (req, res) => {
  try {
    const { zoneNumber, newPrice } = req.body;

    // If requester is admin, ensure the zone belongs to their city
    if (req.user && req.user.role === 'admin') {
      if (!req.user.city) return res.status(403).json({ message: 'Admin sans ville assignée' });
      const city = await City.findById(req.user.city);
      if (!city) return res.status(404).json({ message: 'Ville de l\'admin non trouvée' });
      if (!city.activeZones.includes(zoneNumber)) {
        return res.status(403).json({ message: 'Accès refusé: zone hors de votre ville' });
      }
    }
    const zone = await Zone.findOneAndUpdate(
      { number: zoneNumber },
      { price: newPrice },
      { new: true }
    );

    if (!zone) {
      return res.status(404).json({ message: "Zone non trouvée" });
    }

    res.json({
      message: "Prix de la zone mis à jour avec succès",
      zone: {
        number: zone.number,
        price: zone.price
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🧩 Activer/Désactiver zones d’une ville
// 🧩 Activer/Désactiver zones d'une ville
const updateCityZones = async (req, res) => {
  try {
    // Récupérer l'ID depuis les params d'URL au lieu du body
    const { id } = req.params;
    const { activeZones } = req.body;

    // Valider que activeZones est fourni
    if (!activeZones || !Array.isArray(activeZones)) {
      return res.status(400).json({ 
        message: "activeZones doit être un tableau" 
      });
    }

    // If requester is an admin, ensure they can only update their own city
    if (req.user && req.user.role === 'admin') {
      if (!req.user.city) return res.status(403).json({ message: 'Admin sans ville assignée' });
      if (req.user.city.toString() !== id.toString()) {
        return res.status(403).json({ message: 'Accès refusé: vous ne pouvez modifier que votre ville' });
      }
    }

    const city = await City.findByIdAndUpdate(
      id,
      { activeZones },
      { new: true }
    );

    if (!city) {
      return res.status(404).json({ message: "Ville non trouvée" });
    }

    res.json({
      message: "Zones de la ville mises à jour avec succès",
      city: {
        id: city._id,
        name: city.name,
        activeZones: city.activeZones
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ===== CITY MANAGEMENT METHODS =====

// 🏙️ Get all cities
const getCities = async (req, res) => {
  try {
    const cities = await City.find({})
      .sort({ name: 1 });

    res.json({
      cities: cities.map(city => ({
        id: city._id,
        name: city.name,
        activeZones: city.activeZones,
        isActive: city.isActive,
        createdAt: city.createdAt
      }))
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🏙️ Get city by ID
const getCityById = async (req, res) => {
  try {
    const { id } = req.params;
    const city = await City.findById(id);

    if (!city) {
      return res.status(404).json({ message: "Ville non trouvée" });
    }

    res.json({
      id: city._id,
      name: city.name,
      activeZones: city.activeZones,
      isActive: city.isActive,
      createdAt: city.createdAt
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🆕 Create new city
const createCity = async (req, res) => {
  try {
    const { name, activeZones } = req.body;

    // Check if city name already exists
    const existingCity = await City.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existingCity) {
      return res.status(400).json({ message: "Une ville avec ce nom existe déjà" });
    }

    const city = new City({
      name,
      activeZones: activeZones || []
    });

    const savedCity = await city.save();

    res.status(201).json({
      message: "Ville créée avec succès",
      city: {
        id: savedCity._id,
        name: savedCity.name,
        activeZones: savedCity.activeZones,
        isActive: savedCity.isActive
      }
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: err.message });
  }
};

// ✏️ Update city
const updateCity = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, activeZones, isActive } = req.body;

    // Check if new city name conflicts with existing city
    if (name) {
      const existingCity = await City.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: id }
      });
      if (existingCity) {
        return res.status(400).json({ message: "Une ville avec ce nom existe déjà" });
      }
    }

    const city = await City.findByIdAndUpdate(
      id,
      { name, activeZones, isActive },
      { new: true, runValidators: true }
    );

    if (!city) {
      return res.status(404).json({ message: "Ville non trouvée" });
    }

    res.json({
      message: "Ville mise à jour avec succès",
      city: {
        id: city._id,
        name: city.name,
        activeZones: city.activeZones,
        isActive: city.isActive
      }
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: err.message });
  }
};

// 🗑️ Delete city
const deleteCity = async (req, res) => {
  try {
    const { id } = req.params;

    const city = await City.findByIdAndDelete(id);

    if (!city) {
      return res.status(404).json({ message: "Ville non trouvée" });
    }

    res.json({ message: "Ville supprimée avec succès" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🏙️ GET city settings (multiplicateur and other configuration)
const getCitySettings = async (req, res) => {
  try {
    const { id } = req.params;
    const city = await City.findById(id);

    if (!city) {
      return res.status(404).json({ 
        success: false,
        message: 'Ville non trouvée' 
      });
    }

    res.json({
      success: true,
      data: {
        id: city._id,
        name: city.name,
        multiplicateur: city.multiplicateur || 1,
        isActive: city.isActive,
        activeZones: city.activeZones,
        createdAt: city.createdAt,
        updatedAt: city.updatedAt
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

// ✏️ UPDATE city multiplicateur
const updateCityMultiplicateur = async (req, res) => {
  try {
    const { id } = req.params;
    const { multiplicateur } = req.body;

    // Validate input
    if (multiplicateur === undefined || multiplicateur === null) {
      return res.status(400).json({
        success: false,
        message: 'Le multiplicateur est requis'
      });
    }

    const multiplier = Number(multiplicateur);
    
    if (isNaN(multiplier) || multiplier <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Le multiplicateur doit être un nombre positif (> 0)'
      });
    }

    const city = await City.findById(id);
    if (!city) {
      return res.status(404).json({
        success: false,
        message: 'Ville non trouvée'
      });
    }

    const oldMultiplicateur = city.multiplicateur;
    city.multiplicateur = Number(multiplier.toFixed(2));
    await city.save();

    console.log(`📊 City ${city.name} multiplicateur updated: ${oldMultiplicateur} → ${city.multiplicateur}`);

    res.json({
      success: true,
      message: 'Multiplicateur mise à jour avec succès',
      data: {
        id: city._id,
        name: city.name,
        multiplicateur: city.multiplicateur,
        updatedAt: city.updatedAt
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// 🎯 GET zone garanties (minimum guarantees for each order type)
const getZoneGaranties = async (req, res) => {
  try {
    const { id } = req.params;
    const zone = await Zone.findById(id);

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Zone non trouvée'
      });
    }

    res.json({
      success: true,
      data: {
        id: zone._id,
        number: zone.number,
        minGarantieA1: zone.minGarantieA1 || 0,
        minGarantieA2: zone.minGarantieA2 || 0,
        minGarantieA3: zone.minGarantieA3 || 0,
        minGarantieA4: zone.minGarantieA4 || 0,
        price: zone.price,
        minDistance: zone.minDistance,
        maxDistance: zone.maxDistance,
        createdAt: zone.createdAt,
        updatedAt: zone.updatedAt
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ✏️ UPDATE zone garanties (minimum guarantees)
const updateZoneGaranties = async (req, res) => {
  try {
    const { id } = req.params;
    const { minGarantieA1, minGarantieA2, minGarantieA3, minGarantieA4 } = req.body;

    const zone = await Zone.findById(id);
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Zone non trouvée'
      });
    }

    // Validate and update each guarantee
    const garanties = {
      minGarantieA1,
      minGarantieA2,
      minGarantieA3,
      minGarantieA4
    };

    const updatedGaranties = {};
    for (const [key, value] of Object.entries(garanties)) {
      if (value !== undefined && value !== null) {
        const numValue = Number(value);
        
        if (isNaN(numValue) || numValue < 0) {
          return res.status(400).json({
            success: false,
            message: `${key} doit être un nombre positif ou zéro (>= 0)`
          });
        }

        zone[key] = Number(numValue.toFixed(2));
        updatedGaranties[key] = zone[key];
      }
    }

    // Check that at least one guarantee was updated
    if (Object.keys(updatedGaranties).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Au moins une garantie doit être fournie pour la mise à jour'
      });
    }

    await zone.save();

    console.log(`🎯 Zone ${zone.number} garanties updated:`, updatedGaranties);

    res.json({
      success: true,
      message: 'Garanties mise à jour avec succès',
      data: {
        id: zone._id,
        number: zone.number,
        minGarantieA1: zone.minGarantieA1,
        minGarantieA2: zone.minGarantieA2,
        minGarantieA3: zone.minGarantieA3,
        minGarantieA4: zone.minGarantieA4,
        updatedAt: zone.updatedAt
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

module.exports = {
  getUserZone,
  updateZonePrice,
  updateCityZones,
  getZones,
  deleteCity,
  createCity,
  getCityById,
  getCities,
  updateCity,
  deleteZone,
  updateZone,
  createZone,
  getZoneById,
  getCitySettings,
  updateCityMultiplicateur,
  getZoneGaranties,
  updateZoneGaranties
};


