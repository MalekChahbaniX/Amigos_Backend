const Zone = require('../models/Zone');
const City = require('../models/City');
const { calculateDistance } = require('../utils/distanceCalculator');

// 📍 Déterminer la zone de l’utilisateur
const getUserZone = async (req, res) => {
  try {
    const { userLat, userLng, cityId, destLat, destLng } = req.body;
    const distance = calculateDistance(userLat, userLng, destLat, destLng);

    const city = await City.findById(cityId);
    const activeZones = await Zone.find({ number: { $in: city.activeZones } });

    const matchedZone = activeZones.find(
      (z) => distance >= z.minDistance && distance < z.maxDistance
    );

    if (!matchedZone)
      return res.status(404).json({ message: "Aucune zone trouvée" });

    res.json({
      zone: matchedZone.number,
      distance: distance.toFixed(2),
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
    const zone = await Zone.findOneAndUpdate(
      { number: zoneNumber },
      { price: newPrice },
      { new: true }
    );
    res.json(zone);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🧩 Activer/Désactiver zones d’une ville
const updateCityZones = async (req, res) => {
  try {
    const { cityId, activeZones } = req.body;
    const city = await City.findByIdAndUpdate(
      cityId,
      { activeZones },
      { new: true }
    );
    res.json(city);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
module.exports = {
  getUserZone,
  updateZonePrice,
  updateCityZones
};


