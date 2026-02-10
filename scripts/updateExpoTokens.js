const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// Connexion à la base de données
mongoose.connect('mongodb+srv://malekchb0621_db_user:amigos2025**@amigos.gyjfexc.mongodb.net/?retryWrites=true&w=majority&appName=amigos', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Générer des tokens Expo réalistes pour les tests
function generateRealisticExpoToken() {
  // Format réel des tokens Expo: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx]
  const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';
  let token = 'ExponentPushToken[';
  
  for (let i = 0; i < 32; i++) {
    token += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  token += ']';
  return token;
}

async function updateDelivererTokens() {
  try {
    console.log('🔄 Mise à jour des tokens Expo des livreurs...');
    
    // Récupérer tous les livreurs
    const deliverers = await User.find({ role: 'deliverer' });
    
    for (const deliverer of deliverers) {
      // Générer un token réaliste
      const newToken = generateRealisticExpoToken();
      
      // Mettre à jour le token
      await User.findByIdAndUpdate(deliverer._id, {
        pushToken: newToken
      });
      
      console.log(`📱 ${deliverer.firstName} ${deliverer.lastName}: ${newToken}`);
    }
    
    console.log(`✅ ${deliverers.length} tokens Expo mis à jour avec succès`);
    
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour des tokens:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Exécuter le script
updateDelivererTokens();
