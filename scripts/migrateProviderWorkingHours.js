/**
 * Script de migration - Ajouter les horaires de travail par défaut à tous les prestataires anciens
 * 
 * Usage: node scripts/migrateProviderWorkingHours.js
 * 
 * Ce script:
 * 1. Connecte à la base de données MongoDB
 * 2. Trouve tous les prestataires sans horaires (workingHours vide ou non défini)
 * 3. Leur ajoute les horaires par défaut (9h-22h, 7/7 jours)
 * 4. Affiche le nombre de prestataires mis à jour
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Importer le modèle Provider
const Provider = require('../models/Provider');

// Horaires par défaut
const DEFAULT_WORKING_HOURS = [
  { day: 'lundi', isOpen: true, openTime: '09:00', closeTime: '22:00' },
  { day: 'mardi', isOpen: true, openTime: '09:00', closeTime: '22:00' },
  { day: 'mercredi', isOpen: true, openTime: '09:00', closeTime: '22:00' },
  { day: 'jeudi', isOpen: true, openTime: '09:00', closeTime: '22:00' },
  { day: 'vendredi', isOpen: false, openTime: '09:00', closeTime: '22:00' },
  { day: 'samedi', isOpen: true, openTime: '09:00', closeTime: '22:00' },
  { day: 'dimanche', isOpen: true, openTime: '09:00', closeTime: '22:00' }
];

async function migrateWorkingHours() {
  try {
    // Connexion à MongoDB
    console.log('🔄 Connexion à la base de données...');
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connecté à la base de données');

    // Trouver tous les prestataires sans horaires
    console.log('\n📋 Recherche des prestataires sans horaires...');
    const providersWithoutHours = await Provider.find({
      $or: [
        { workingHours: { $exists: false } },
        { workingHours: null },
        { workingHours: [] }
      ]
    });

    console.log(`📍 Trouvé ${providersWithoutHours.length} prestataire(s) sans horaires`);

    if (providersWithoutHours.length === 0) {
      console.log('✅ Tous les prestataires ont déjà des horaires');
      process.exit(0);
    }

    // Ajouter les horaires par défaut
    console.log('\n⏳ Ajout des horaires par défaut...');
    let successCount = 0;
    let errorCount = 0;

    for (const provider of providersWithoutHours) {
      try {
        provider.workingHours = DEFAULT_WORKING_HOURS;
        await provider.save();
        successCount++;
        console.log(`  ✅ ${provider.name} (${provider._id})`);
      } catch (error) {
        errorCount++;
        console.log(`  ❌ Erreur pour ${provider.name}: ${error.message}`);
      }
    }

    // Résumé
    console.log(`\n📊 Migration terminée:`);
    console.log(`  ✅ Réussi: ${successCount}`);
    console.log(`  ❌ Erreur: ${errorCount}`);
    console.log(`\n🎉 Les horaires par défaut ont été ajoutés avec succès!`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Exécuter la migration
migrateWorkingHours();
