/**
 * Script de diagnostic - Vérifier le statut des horaires des prestataires
 * 
 * Usage: node scripts/checkProviderWorkingHours.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Importer le modèle Provider
const Provider = require('../models/Provider');

async function checkWorkingHours() {
  try {
    // Connexion à MongoDB
    console.log('🔄 Connexion à la base de données...');
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/amigos';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connecté à la base de données\n');

    // Compter les prestataires
    const totalProviders = await Provider.countDocuments({});
    console.log(`📊 Nombre total de prestataires: ${totalProviders}`);

    // Compter ceux avec horaires
    const providersWithHours = await Provider.countDocuments({
      workingHours: { $exists: true, $ne: null, $ne: [] }
    });
    console.log(`✅ Prestataires avec horaires: ${providersWithHours}`);

    // Compter ceux sans horaires
    const providersWithoutHours = await Provider.countDocuments({
      $or: [
        { workingHours: { $exists: false } },
        { workingHours: null },
        { workingHours: [] }
      ]
    });
    console.log(`❌ Prestataires sans horaires: ${providersWithoutHours}`);

    // Pourcentage
    const percentage = totalProviders > 0 ? ((providersWithHours / totalProviders) * 100).toFixed(2) : 0;
    console.log(`\n📈 Couverture: ${percentage}%`);

    // Liste détaillée des prestataires sans horaires
    if (providersWithoutHours > 0) {
      console.log(`\n📋 Prestataires sans horaires:\n`);
      const providers = await Provider.find({
        $or: [
          { workingHours: { $exists: false } },
          { workingHours: null },
          { workingHours: [] }
        ]
      }).select('name type city').populate('city', 'name');

      providers.forEach((provider, index) => {
        const cityName = provider.city ? provider.city.name : 'N/A';
        console.log(`${index + 1}. ${provider.name} (${provider.type}) - ${cityName}`);
      });

      console.log(`\n💡 Conseil: Exécutez le script de migration pour ajouter les horaires par défaut`);
      console.log(`   Command: node scripts/migrateProviderWorkingHours.js`);
    } else {
      console.log(`\n✅ Tous les prestataires ont des horaires configurés!`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Exécuter la vérification
checkWorkingHours();
