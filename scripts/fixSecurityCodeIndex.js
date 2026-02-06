require('dotenv').config();
const mongoose = require('mongoose');

async function fixSecurityCodeIndex() {
  try {
    // 🔄 Connexion à MongoDB
    console.log('🔄 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connexion à MongoDB établie avec succès');

    // 📋 Accès à la collection users
    const collection = mongoose.connection.db.collection('users');
    
    // 📋 Vérification des index existants
    console.log('📋 Récupération des index existants...');
    const indexes = await collection.indexes();
    console.log('📋 Index trouvés:', indexes.map(idx => ({ name: idx.name, key: idx.key, unique: idx.unique, sparse: idx.sparse })));
    
    // 🔍 Vérifier si l'index securityCode_1 existe
    const securityCodeIndex = indexes.find(idx => idx.name === 'securityCode_1');
    
    if (securityCodeIndex) {
      // 🗑️ Suppression de l'ancien index
      console.log('🗑️ Suppression de l\'ancien index securityCode_1...');
      try {
        await collection.dropIndex('securityCode_1');
        console.log('✅ Index securityCode_1 supprimé avec succès');
      } catch (error) {
        if (error.code === 27) {
          console.log('ℹ️ L\'index securityCode_1 n\'existe pas, passage à la création...');
        } else {
          throw error;
        }
      }
    } else {
      console.log('ℹ️ L\'index securityCode_1 n\'existe pas, passage à la création...');
    }

    // 🎯 Création du nouvel index sparse
    console.log('🎯 Création du nouvel index securityCode_1 avec sparse: true...');
    const result = await collection.createIndex(
      { securityCode: 1 }, 
      { unique: true, sparse: true }
    );
    console.log('🎉 Index securityCode_1 créé avec succès:', result);

    // 🔍 Vérification finale
    console.log('🔍 Vérification finale de l\'index...');
    const finalIndexes = await collection.indexes();
    const finalSecurityCodeIndex = finalIndexes.find(idx => idx.name === 'securityCode_1');
    
    if (finalSecurityCodeIndex && finalSecurityCodeIndex.sparse === true) {
      console.log('✅ Confirmation: L\'index securityCode_1 a bien la propriété sparse: true');
      console.log('📋 Propriétés de l\'index:', {
        name: finalSecurityCodeIndex.name,
        key: finalSecurityCodeIndex.key,
        unique: finalSecurityCodeIndex.unique,
        sparse: finalSecurityCodeIndex.sparse
      });
    } else {
      throw new Error('L\'index créé n\'a pas la propriété sparse: true attendue');
    }

    console.log('🎉 Migration terminée avec succès !');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error.message);
    console.error('❌ Détail complet:', error);
    process.exit(1);
  } finally {
    // 🔄 Déconnexion de MongoDB
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('🔄 Déconnexion de MongoDB');
    }
  }
}

// Exécution du script
fixSecurityCodeIndex();
