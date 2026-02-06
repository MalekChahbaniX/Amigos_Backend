require('dotenv').config();
const axios = require('axios');

async function testClickToPayDirect() {
  console.log('🧪 Test direct de l\'API ClickToPay...');
  
  const config = {
    apiUrl: process.env.CLICTOPAY_API_URL,
    username: process.env.CLICTOPAY_USERNAME,
    password: process.env.CLICTOPAY_PASSWORD,
  };
  
  console.log('🔧 Configuration:', {
    apiUrl: config.apiUrl,
    username: config.username,
    password: config.password ? '***' : 'NOT SET'
  });
  
  if (!config.apiUrl || !config.username || !config.password) {
    console.error('❌ Configuration manquante');
    return;
  }
  
  try {
    // Test avec des paramètres valides
    const payload = {
      userName: config.username,
      password: config.password,
      orderNumber: `TEST_${Date.now()}`,
      amount: 1000, // 1 DT en millimes
      currency: '788', // TND
      returnUrl: 'https://httpbin.org/post',
      failUrl: 'https://httpbin.org/post',
      language: 'fr'
    };
    
    console.log('📦 Payload:', JSON.stringify({
      ...payload,
      userName: '***',
      password: '***'
    }, null, 2));
    
    const response = await axios.post(
      `${config.apiUrl}/register.do`,
      new URLSearchParams(payload).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000
      }
    );
    
    console.log('✅ Réponse ClickToPay:', JSON.stringify(response.data, null, 2));
    
    if (response.data.errorCode && parseInt(response.data.errorCode) !== 0) {
      console.error('❌ Erreur ClickToPay:', {
        errorCode: response.data.errorCode,
        errorMessage: response.data.errorMessage
      });
    } else {
      console.log('🎉 Paiement créé avec succès!');
      console.log('🔗 URL de paiement:', response.data.formUrl);
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message);
    if (axios.isAxiosError(error)) {
      console.error('Status:', error.response?.status);
      console.error('Data:', JSON.stringify(error.response?.data, null, 2));
    }
  }
}

testClickToPayDirect();
