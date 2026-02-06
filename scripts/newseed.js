
const mongoose = require('mongoose');
require('dotenv').config();

// Import des modèles
const User = require('../models/User');
const Provider = require('../models/Provider');

// Couleurs pour le terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.bright}${colors.blue}=== ${msg} ===${colors.reset}\n`),
};

// Données de test pour les livreurs - DJERBA
const deliverersData = [
  {
    firstName: 'Ahmed',
    lastName: 'Ben Ali',
    phoneNumber: '+21698765432',
    role: 'deliverer',
    status: 'active',
    location: {
      latitude: 33.8139,
      longitude: 10.3476,
      address: '123 Rue de Djerba, Houmt Souk',
      city: 'Djerba',
      postalCode: '4180',
    },
    pushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxxxx]',
    isVerified: true,
    securityCode: '123456', // Code de sécurité unique pour chaque livreur
  },
  {
    firstName: 'Fatima',
    lastName: 'Mohamed',
    phoneNumber: '+21696543210',
    role: 'deliverer',
    status: 'active',
    location: {
      latitude: 33.8210,
      longitude: 10.3520,
      address: '456 Avenue Abdelhamid El Kadhi, Houmt Souk',
      city: 'Djerba',
      postalCode: '4180',
    },
    pushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxx]',
    isVerified: true,
    securityCode: '234567',
  },
  {
    firstName: 'Hassan',
    lastName: 'Khalil',
    phoneNumber: '+21694567890',
    role: 'deliverer',
    status: 'active',
    location: {
      latitude: 33.8070,
      longitude: 10.3450,
      address: '789 Rue Taieb Mehiri, Houmt Souk',
      city: 'Djerba',
      postalCode: '4180',
    },
    pushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxx]',
    isVerified: true,
    securityCode: '345678',
  },
  {
    firstName: 'Amel',
    lastName: 'Habib',
    phoneNumber: '+21692345678',
    role: 'deliverer',
    status: 'inactive',
    location: {
      latitude: 33.8150,
      longitude: 10.3400,
      address: '321 Avenue Bourguiba, Houmt Souk',
      city: 'Djerba',
      postalCode: '4180',
    },
    pushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxx]',
    isVerified: true,
    securityCode: '456789',
  },
  {
    firstName: 'Karim',
    lastName: 'Nasri',
    phoneNumber: '+21691234567',
    role: 'deliverer',
    status: 'active',
    location: {
      latitude: 33.8180,
      longitude: 10.3550,
      address: '789 Rue Salihedine, Houmt Souk',
      city: 'Djerba',
      postalCode: '4180',
    },
    pushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxx]',
    isVerified: true,
    securityCode: '567890',
  },
];

// Données de test pour les prestataires - DJERBA
const providersData = [];

/**
 * Fonction pour se connecter à la base de données
 */
async function connectDB() {
  try {
    const conn = await mongoose.connect("mongodb+srv://malekchb0621_db_user:amigos2025**@amigos.gyjfexc.mongodb.net/?retryWrites=true&w=majority&appName=amigos", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    log.success(`Connecté à MongoDB: ${conn.connection.host}`);
    return true;
  } catch (error) {
    log.error(`Erreur de connexion MongoDB: ${error.message}`);
    return false;
  }
}

/**
 * Fonction pour insérer les livreurs
 * ✓ N'ajoute QUE les nouveaux
 * ✓ Ne supprime JAMAIS les anciens
 */
async function seedDeliverers() {
  log.section('👨‍💼 AJOUT DES LIVREURS');

  try {
    // Afficher les livreurs existants
    const existingCount = await User.countDocuments({ role: 'deliverer' });
    log.info(`Livreurs existants en base: ${existingCount}`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const deliverer of deliverersData) {
      try {
        // Vérifier si le livreur existe déjà par téléphone
        const exists = await User.findOne({
          phoneNumber: deliverer.phoneNumber,
          role: 'deliverer'
        });

        if (exists) {
          log.warning(`⏭️  ${deliverer.firstName} ${deliverer.lastName} existe déjà (${deliverer.phoneNumber}) - Ignoré`);
          skippedCount++;
          continue;
        }

        // Créer SEULEMENT s'il n'existe pas
        const newDeliverer = new User(deliverer);
        await newDeliverer.save();

        log.success(`➕ ${deliverer.firstName} ${deliverer.lastName} (${deliverer.phoneNumber})`);
        createdCount++;
      } catch (error) {
        log.error(`Erreur pour ${deliverer.firstName}: ${error.message}`);
      }
    }

    log.info(`Résumé: ${createdCount} ajouté(s), ${skippedCount} déjà existant(s)`);
  } catch (error) {
    log.error(`Erreur lors de l'ajout des livreurs: ${error.message}`);
  }
}

/**
 * Fonction pour insérer les prestataires
 * ✓ N'ajoute QUE les nouveaux
 * ✓ Ne supprime JAMAIS les anciens
 */
async function seedProviders() {
  log.section('🏪 AJOUT DES PRESTATAIRES');

  try {
    // Afficher les prestataires existants
    const existingCount = await Provider.countDocuments();
    log.info(`Prestataires existants en base: ${existingCount}`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const provider of providersData) {
      try {
        // Vérifier si le prestataire existe déjà par téléphone
        const exists = await Provider.findOne({
          phone: provider.phone
        });

        if (exists) {
          log.warning(`⏭️  ${provider.name} existe déjà (${provider.phone}) - Ignoré`);
          skippedCount++;
          continue;
        }

        // Créer SEULEMENT s'il n'existe pas
        const newProvider = new Provider(provider);
        await newProvider.save();

        log.success(`➕ ${provider.name} (${provider.type})`);
        createdCount++;
      } catch (error) {
        log.error(`Erreur pour ${provider.name}: ${error.message}`);
      }
    }

    log.info(`Résumé: ${createdCount} ajouté(s), ${skippedCount} déjà existant(s)`);
  } catch (error) {
    log.error(`Erreur lors de l'ajout des prestataires: ${error.message}`);
  }
}

/**
 * Afficher le résumé final
 */
async function displayFinalStats() {
  log.section('📊 RÉSUMÉ FINAL');

  const delivererCount = await User.countDocuments({ role: 'deliverer' });
  const providerCount = await Provider.countDocuments();

  console.log(`
  ${colors.green}✓ Livreurs en base: ${delivererCount}${colors.reset}
  ${colors.green}✓ Prestataires en base: ${providerCount}${colors.reset}
  `);
}

/**
 * Fonction principale
 */
async function main() {
  console.log(`
${colors.bright}${colors.magenta}╔═══════════════════════════════════════════════════════╗
║   🚀 SCRIPT DE SEED - VERSION SÉCURISÉE            ║
║   ✓ N'ajoute QUE les nouveaux livreurs              ║
║   ✓ NE SUPPRIME JAMAIS les anciens                  ║
╚═══════════════════════════════════════════════════════╝${colors.reset}
  `);

  // Se connecter à la base de données
  const connected = await connectDB();
  if (!connected) {
    process.exit(1);
  }

  // Insérer les données
  await seedDeliverers();
  await seedProviders();

  // Afficher les stats
  await displayFinalStats();

  // Déconnecter
  await mongoose.disconnect();
  log.success('Déconnecté de MongoDB');

  console.log(`\n${colors.green}${colors.bright}✓ Opération complétée avec succès${colors.reset}\n`);
}

// Exécuter la fonction principale
main().catch(error => {
  log.error(`Erreur non gérée: ${error.message}`);
  process.exit(1);
});