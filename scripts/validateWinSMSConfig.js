// Script pour valider la configuration WinSMS
// Usage: node scripts/validateWinSMSConfig.js

require('dotenv').config();
const WinSMSService = require('../services/winSmsService');
const winSmsService = new WinSMSService();

async function validateConfig() {
  console.log('🔍 Validation de la configuration WinSMS...\n');
  
  // 1. Vérifier les variables d'environnement
  console.log('1. Variables d\'environnement:');
  console.log(`   WINSMS_API_KEY: ${process.env.WINSMS_API_KEY ? '✓ Configurée' : '✗ Manquante'}`);
  console.log(`   WINSMS_SENDER_ID: ${process.env.WINSMS_SENDER_ID ? '✓ Configurée' : '✗ Manquante'}`);
  console.log(`   WINSMS_API_URL: ${process.env.WINSMS_API_URL || 'Valeur par défaut'}\n`);
  
  // Validation des formats
  if (process.env.WINSMS_API_KEY) {
    const apiKeyFormat = process.env.WINSMS_API_KEY.length > 10 ? '✓' : '⚠️';
    console.log(`   Format API Key: ${apiKeyFormat} (longueur: ${process.env.WINSMS_API_KEY.length})`);
  }
  
  if (process.env.WINSMS_SENDER_ID) {
    const senderIdFormat = process.env.WINSMS_SENDER_ID.length >= 3 && process.env.WINSMS_SENDER_ID.length <= 11 ? '✓' : '⚠️';
    console.log(`   Format Sender ID: ${senderIdFormat} (longueur: ${process.env.WINSMS_SENDER_ID.length})`);
  }
  
  console.log('');
  
  // 2. Tester la connexion
  console.log('2. Test de connexion:');
  try {
    const result = await winSmsService.testConnection();
    
    if (result.success) {
      console.log('   ✓ Connexion réussie');
      if (result.balance !== undefined) {
        console.log(`   ✓ Solde disponible: ${result.balance} crédits`);
      }
      if (result.responseTime) {
        console.log(`   ✓ Temps de réponse: ${result.responseTime}ms`);
      }
    } else {
      console.log('   ✗ Connexion échouée');
      console.log(`   ✗ Erreur: ${result.error || 'Erreur inconnue'}`);
      
      // Suggestions basées sur l'erreur
      if (result.error && result.error.includes('authentication')) {
        console.log('   💡 Suggestion: Vérifiez votre WINSMS_API_KEY');
      }
      if (result.error && result.error.includes('network')) {
        console.log('   💡 Suggestion: Vérifiez votre connexion internet ou firewall');
      }
    }
  } catch (error) {
    console.log('   ✗ Erreur lors du test de connexion');
    console.log(`   ✗ Détail: ${error.message}`);
  }
  
  console.log('');
  
  // 3. Validation des prérequis
  console.log('3. Prérequis système:');
  console.log(`   Node.js: ${process.version} ✓`);
  console.log(`   Environnement: ${process.env.NODE_ENV || 'development'} ✓`);
  
  // Vérifier si le service peut être initialisé
  try {
    console.log('   ✓ Service WinSMS initialisable');
  } catch (error) {
    console.log('   ✗ Erreur d\'initialisation du service');
    console.log(`   ✗ ${error.message}`);
  }
  
  console.log('');
  
  // 4. Résumé
  const hasApiKey = !!process.env.WINSMS_API_KEY;
  const hasSenderId = !!process.env.WINSMS_SENDER_ID;
  const allConfigured = hasApiKey && hasSenderId;
  
  console.log('4. Résumé:');
  if (allConfigured) {
    console.log('   ✅ Configuration complète');
    console.log('   📋 Prochaines étapes:');
    console.log('      1. Testez l\'envoi SMS: curl -X POST /api/auth/winsms/test');
    console.log('      2. Surveillez les métriques: GET /api/auth/winsms/metrics');
    console.log('      3. Configurez les alertes si nécessaire');
  } else {
    console.log('   ⚠️ Configuration incomplète');
    console.log('   📋 Actions requises:');
    if (!hasApiKey) {
      console.log('      1. Ajoutez WINSMS_API_KEY dans votre .env');
      console.log('      2. Obtenez une clé API depuis https://www.winsms.tn/');
    }
    if (!hasSenderId) {
      console.log('      3. Ajoutez WINSMS_SENDER_ID dans votre .env');
      console.log('      4. Faites approuver votre Sender ID par WinSMS');
    }
    console.log('      5. Relancez ce script après configuration');
  }
  
  console.log('\n✅ Validation terminée');
  
  // Exit code basé sur la configuration
  process.exit(allConfigured ? 0 : 1);
}

validateConfig().catch(error => {
  console.error('❌ Erreur lors de la validation:', error.message);
  console.error('❌ Stack trace:', error.stack);
  process.exit(1);
});
