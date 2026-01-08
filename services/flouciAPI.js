const axios = require('axios');

const FLOUCI_BASE_URL = 'https://developers.flouci.com/api/v2';
const FLOUCI_PUBLIC_KEY = process.env.FLOUCI_PUBLIC_KEY;
const FLOUCI_PRIVATE_KEY = process.env.FLOUCI_PRIVATE_KEY;
const FLOUCI_DEVELOPER_TRACKING_ID = process.env.FLOUCI_DEVELOPER_TRACKING_ID;

exports.createPayment = async ({ amount, orderId, successUrl, failureUrl, webhookUrl }) => {
  console.log('🔌 Flouci API - Creating payment with:', { amount, orderId, successUrl, failureUrl, webhookUrl });
  console.log('🔑 FLOUCI_PUBLIC_KEY exists:', !!FLOUCI_PUBLIC_KEY);
  console.log('🔑 FLOUCI_PRIVATE_KEY exists:', !!FLOUCI_PRIVATE_KEY);
  console.log('🌐 FLOUCI_BASE_URL:', FLOUCI_BASE_URL);
  console.log('📍 FLOUCI_DEVELOPER_TRACKING_ID:', FLOUCI_DEVELOPER_TRACKING_ID);

  if (!FLOUCI_PUBLIC_KEY) {
    throw new Error('FLOUCI_PUBLIC_KEY environment variable is not set');
  }
  if (!FLOUCI_PRIVATE_KEY) {
    throw new Error('FLOUCI_PRIVATE_KEY environment variable is not set');
  }
  if (!successUrl) {
    throw new Error('successUrl is required');
  }

  try {
    const fullUrl = `${FLOUCI_BASE_URL}/generate_payment`;
    console.log('📡 Calling Flouci API at:', fullUrl);

    // Build Authorization header: Bearer PUBLIC_KEY:PRIVATE_KEY
    const authHeader = `Bearer ${FLOUCI_PUBLIC_KEY}:${FLOUCI_PRIVATE_KEY}`;

    const payload = {
      amount: amount, // Already in millimes (smallest unit)
      success_link: successUrl,
      fail_link: failureUrl || successUrl, // Use success URL as fallback if failure URL not provided
    };

    // Add optional fields if provided
    if (FLOUCI_DEVELOPER_TRACKING_ID) {
      payload.developer_tracking_id = FLOUCI_DEVELOPER_TRACKING_ID;
    }

    if (webhookUrl) {
      payload.webhook = webhookUrl;
    }

    console.log('📦 Sending payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post(
      fullUrl,
      payload,
      {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log('✅ Flouci API response:', response.data);
    
    // Flouci returns nested response: { result: { link: "...", payment_id: "..." }, ... }
    const resultData = response.data.result || response.data;
    
    if (!resultData.link || !resultData.payment_id) {
      console.error('❌ Invalid Flouci response structure:', JSON.stringify(response.data, null, 2));
      throw new Error(`Invalid Flouci response structure: missing link or payment_id`);
    }
    
    return {
      payment_url: resultData.link,
      id: resultData.payment_id,
    };
  } catch (error) {
    console.error('❌ Flouci API error:', error.message);
    if (axios.isAxiosError(error)) {
      console.error('Response status:', error.response?.status);
      console.error('Response data:', JSON.stringify(error.response?.data, null, 2));
      console.error('Request URL:', error.config?.url);
      console.error('Request payload:', JSON.stringify(error.config?.data, null, 2));
      console.error('Error code:', error.code);
      console.error('Request headers:', {
        ...error.config?.headers,
        Authorization: '***REDACTED***', // Don't log auth headers
      });
      
      // Log validation errors if present
      if (error.response?.data?.errors) {
        console.error('Validation errors:', JSON.stringify(error.response.data.errors, null, 2));
      }
    } else {
      console.error('Non-Axios error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    throw error;
  }
};

exports.verifyPayment = async (paymentId) => {
  console.log('🔍 Flouci API - Verifying payment:', { paymentId });
  console.log('🔑 FLOUCI_PUBLIC_KEY exists:', !!FLOUCI_PUBLIC_KEY);
  console.log('🔑 FLOUCI_PRIVATE_KEY exists:', !!FLOUCI_PRIVATE_KEY);

  if (!FLOUCI_PUBLIC_KEY) {
    throw new Error('FLOUCI_PUBLIC_KEY environment variable is not set');
  }
  if (!FLOUCI_PRIVATE_KEY) {
    throw new Error('FLOUCI_PRIVATE_KEY environment variable is not set');
  }

  try {
    const fullUrl = `${FLOUCI_BASE_URL}/verify_payment/${paymentId}`;
    console.log('📡 Calling Flouci API at:', fullUrl);

    // Build Authorization header: Bearer PUBLIC_KEY:PRIVATE_KEY
    const authHeader = `Bearer ${FLOUCI_PUBLIC_KEY}:${FLOUCI_PRIVATE_KEY}`;

    const response = await axios.get(
      fullUrl,
      {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log('✅ Flouci API verification response:', response.data);
    
    // Return the verification data including status (SUCCESS, PENDING, EXPIRED, FAILURE)
    return response.data;
  } catch (error) {
    console.error('❌ Flouci API verification error:', error.message);
    if (axios.isAxiosError(error)) {
      console.error('Response status:', error.response?.status);
      console.error('Response data:', JSON.stringify(error.response?.data, null, 2));
      console.error('Request URL:', error.config?.url);
      console.error('Error code:', error.code);
      console.error('Request headers:', {
        ...error.config?.headers,
        Authorization: '***REDACTED***', // Don't log auth headers
      });
    } else {
      console.error('Non-Axios error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    throw error;
  }
};
