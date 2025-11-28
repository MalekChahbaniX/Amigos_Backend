const axios = require('axios');

const KONNECT_BASE_URL = process.env.KONNECT_API_URL; // https://api.preprod.konnect.network/api/v2
const KONNECT_API_KEY = process.env.KONNECT_API_KEY;
const KONNECT_WALLET_ID = process.env.KONNECT_PORTFOLIO_ID;

exports.createPayment = async ({ amount, currency, orderId, returnUrl }) => {
  console.log('🔌 Konnect API - Creating payment with:', { amount, currency, orderId, returnUrl });
  console.log('🔑 KONNECT_API_KEY exists:', !!KONNECT_API_KEY);
  console.log('🌐 KONNECT_BASE_URL:', KONNECT_BASE_URL);
  console.log('👛 KONNECT_WALLET_ID:', KONNECT_WALLET_ID);

  if (!KONNECT_API_KEY) {
    throw new Error('KONNECT_API_KEY environment variable is not set');
  }
  if (!KONNECT_BASE_URL) {
    throw new Error('KONNECT_BASE_URL environment variable is not set');
  }
  if (!KONNECT_WALLET_ID) {
    throw new Error('KONNECT_WALLET_ID environment variable is not set');
  }

  try {
    const fullUrl = `${KONNECT_BASE_URL}/payments/init-payment`;
    console.log('📡 Calling Konnect API at:', fullUrl);

    const payload = {
      receiverWalletId: KONNECT_WALLET_ID,
      amount: amount, // Already in millimes (smallest unit)
      token: currency || 'TND',
      acceptedPaymentMethods: ['wallet', 'bank_card', 'e-DINAR'],
      orderId: orderId,
      successUrl: returnUrl,
      failUrl: returnUrl,
      theme: 'light',
      // Optional webhook URL
      // webhook: 'https://yourbackend.com/api/payments/konnect-webhook'
    };

    console.log('📦 Sending payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post(
      fullUrl,
      payload,
      {
        headers: {
          'x-api-key': KONNECT_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log('✅ Konnect API response:', response.data);
    
    // Konnect returns: { payUrl: "...", paymentRef: "..." }
    return {
      payment_url: response.data.payUrl,
      id: response.data.paymentRef,
    };
  } catch (error) {
    console.error('❌ Konnect API error:', error.message);
    if (axios.isAxiosError(error)) {
      console.error('Response status:', error.response?.status);
      console.error('Response data:', JSON.stringify(error.response?.data, null, 2));
      console.error('Request config URL:', error.config?.url);
      console.error('Request data:', error.config?.data);
    }
    throw error;
  }
};