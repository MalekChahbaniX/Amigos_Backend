const axios = require('axios');

// Read environment variables at function call time, not module load time
// This ensures dotenv.config() has been called before these are evaluated
const getEnvConfig = () => ({
  apiUrl: process.env.CLICTOPAY_API_URL,
  username: process.env.CLICTOPAY_USERNAME,
  password: process.env.CLICTOPAY_PASSWORD,
});

/**
 * Create a payment with ClickToPay
 * @param {Object} params - Payment parameters
 * @param {number} params.amount - Amount in millimes (1 DT = 1000 millimes)
 * @param {string} params.orderId - Order number/ID from merchant system
 * @param {string} params.returnUrl - Success callback URL
 * @param {string} params.failUrl - Failure callback URL (optional)
 * @param {string} params.currency - Currency code ISO 4217 (default: '788' for TND)
 * @param {string} params.language - Language code ISO 639-1 (default: 'fr')
 * @param {string} params.description - Order description (optional)
 */
exports.createPayment = async ({ 
  amount, 
  orderId, 
  returnUrl, 
  failUrl,
  currency = '788',  // ✅ CORRECTION: Ajout du paramètre currency (obligatoire selon doc page 7)
  language = 'fr',
  description = ''
}) => {
  const { apiUrl: CLICTOPAY_API_URL, username: CLICTOPAY_USERNAME, password: CLICTOPAY_PASSWORD } = getEnvConfig();
  
  console.log('🔌 ClickToPay API - Creating payment with:', { 
    amount, 
    orderId, 
    currency,  // ✅ Log currency
    returnUrl, 
    failUrl 
  });
  console.log('🔑 CLICTOPAY_USERNAME exists:', !!CLICTOPAY_USERNAME);
  console.log('🔑 CLICTOPAY_PASSWORD exists:', !!CLICTOPAY_PASSWORD);
  console.log('🌐 CLICTOPAY_API_URL:', CLICTOPAY_API_URL);

  if (!CLICTOPAY_API_URL) {
    throw new Error('CLICTOPAY_API_URL environment variable is not set');
  }
  if (!CLICTOPAY_USERNAME) {
    throw new Error('CLICTOPAY_USERNAME environment variable is not set');
  }
  if (!CLICTOPAY_PASSWORD) {
    throw new Error('CLICTOPAY_PASSWORD environment variable is not set');
  }
  if (!returnUrl) {
    throw new Error('returnUrl is required');
  }
  if (!amount || amount <= 0) {
    throw new Error('amount must be a positive number');
  }
  if (!orderId) {
    throw new Error('orderId is required');
  }

  try {
    const fullUrl = `${CLICTOPAY_API_URL}/register.do`;
    console.log('📡 Calling ClickToPay API at:', fullUrl);

    // ✅ CORRECTION: Payload conforme à la documentation (page 7-8)
    const payload = {
      userName: CLICTOPAY_USERNAME,
      password: CLICTOPAY_PASSWORD,
      orderNumber: orderId,
      amount: amount, // Already in millimes (smallest unit)
      currency: currency,  // ✅ AJOUTÉ - Obligatoire selon documentation
      returnUrl: returnUrl,
      failUrl: failUrl || returnUrl, // Use return URL as fallback if failure URL not provided
      language: language
    };

    // Add description if provided (optional according to doc)
    if (description) {
      payload.description = description;
    }

    console.log('📦 Sending payload:', JSON.stringify({
      ...payload,
      userName: '***REDACTED***',
      password: '***REDACTED***'
    }, null, 2));

    // URL-encode the payload for application/x-www-form-urlencoded
    const encodedPayload = new URLSearchParams(payload).toString();

    const response = await axios.post(
      fullUrl,
      encodedPayload,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    
    console.log('✅ ClickToPay API response:', JSON.stringify(response.data, null, 2));
    
    // Check for ClickToPay API errors BEFORE destructuring
    // errorCode "0" or 0 means success, only throw for non-zero error codes
    if (response.data.errorCode && parseInt(response.data.errorCode) !== 0) {
      console.error('❌ ClickToPay API returned error:', {
        errorCode: response.data.errorCode,
        errorMessage: response.data.errorMessage
      });
      
      // Map error codes to user-friendly messages
      const errorMessages = {
        1: 'Numéro de commande dupliqué',
        3: 'Monnaie inconnue',
        4: 'Paramètre obligatoire manquant',
        5: 'Valeur erronée d\'un paramètre',
        7: 'Erreur système'
      };
      
      const userMessage = errorMessages[response.data.errorCode] || response.data.errorMessage;
      
      throw new Error(userMessage || `ClickToPay error ${response.data.errorCode}`);
    }
    
    // ClickToPay returns: { orderId: "...", formUrl: "...", errorCode: 0 }
    const { orderId: ctpOrderId, formUrl } = response.data;
    
    if (!ctpOrderId || !formUrl) {
      console.error('❌ Invalid ClickToPay response structure:', JSON.stringify(response.data, null, 2));
      throw new Error(`Invalid ClickToPay response structure: missing orderId or formUrl`);
    }
    
    console.log('✅ Payment created successfully with orderId:', ctpOrderId);
    return {
      payment_url: formUrl,
      id: ctpOrderId,
    };
  } catch (error) {
    console.error('❌ ClickToPay API error:', error.message);
    if (axios.isAxiosError(error)) {
      console.error('Response status:', error.response?.status);
      console.error('Response data:', JSON.stringify(error.response?.data, null, 2));
      console.error('Request URL:', error.config?.url);
      
      // Safe parsing of request payload that handles both objects and strings
      let payloadForLog = {};
      if (error.config?.data) {
        if (typeof error.config.data === 'string') {
          try {
            payloadForLog = Object.fromEntries(new URLSearchParams(error.config.data));
          } catch (parseErr) {
            payloadForLog = { raw: error.config.data };
          }
        } else {
          payloadForLog = error.config.data;
        }
      }
      console.error('Request payload:', JSON.stringify({
        ...payloadForLog,
        userName: '***REDACTED***',
        password: '***REDACTED***'
      }, null, 2));
      
      console.error('Error code:', error.code);
      console.error('Request headers:', {
        ...error.config?.headers,
        // Credentials are in payload, not headers for ClickToPay
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

/**
 * Verify payment status with ClickToPay
 * @param {string} orderId - ClickToPay order ID (not merchant order number)
 * @returns {Object} Verification data including orderStatus
 */
exports.verifyPayment = async (orderId) => {
  const { apiUrl: CLICTOPAY_API_URL, username: CLICTOPAY_USERNAME, password: CLICTOPAY_PASSWORD } = getEnvConfig();
  
  console.log('🔍 ClickToPay API - Verifying payment:', { orderId });
  console.log('🔑 CLICTOPAY_USERNAME exists:', !!CLICTOPAY_USERNAME);
  console.log('🔑 CLICTOPAY_PASSWORD exists:', !!CLICTOPAY_PASSWORD);
  console.log('🌐 CLICTOPAY_API_URL:', CLICTOPAY_API_URL);

  if (!CLICTOPAY_API_URL) {
    throw new Error('CLICTOPAY_API_URL environment variable is not set');
  }
  if (!CLICTOPAY_USERNAME) {
    throw new Error('CLICTOPAY_USERNAME environment variable is not set');
  }
  if (!CLICTOPAY_PASSWORD) {
    throw new Error('CLICTOPAY_PASSWORD environment variable is not set');
  }

  try {
    // Using getOrderStatusExtended for more detailed information (page 18-20)
    const fullUrl = `${CLICTOPAY_API_URL}/getOrderStatusExtended.do`;
    console.log('📡 Calling ClickToPay API at:', fullUrl);

    const payload = {
      userName: CLICTOPAY_USERNAME,
      password: CLICTOPAY_PASSWORD,
      orderId: orderId,
      language: 'fr'  // ✅ Added language parameter
    };

    console.log('📦 Sending payload:', JSON.stringify({
      ...payload,
      userName: '***REDACTED***',
      password: '***REDACTED***'
    }, null, 2));

    // URL-encode the payload for application/x-www-form-urlencoded
    const encodedPayload = new URLSearchParams(payload).toString();

    const response = await axios.post(
      fullUrl,
      encodedPayload,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    
    console.log('✅ ClickToPay API verification response:', JSON.stringify(response.data, null, 2));
    
    // Check for ClickToPay API errors BEFORE processing
    // errorCode "0" or 0 means success, only throw for non-zero error codes
    if (response.data.errorCode && parseInt(response.data.errorCode) !== 0) {
      console.error('❌ ClickToPay API returned error:', {
        errorCode: response.data.errorCode,
        errorMessage: response.data.errorMessage
      });
      throw new Error(
        response.data.errorMessage || `ClickToPay error ${response.data.errorCode}`
      );
    }

    // Log success details
    console.log('✅ ClickToPay verification success:', {
      orderStatus: response.data.orderStatus,
      orderStatusName: getOrderStatusName(response.data.orderStatus),
      actionCode: response.data.actionCode,
      actionDescription: response.data.actionCodeDescription,
      amount: response.data.amount
    });
    
    // Return the complete verification data including orderStatus
    // orderStatus = 2 means success/authorized (page 18)
    console.log('🔍 Order status:', response.data.orderStatus);
    return response.data;
  } catch (error) {
    console.error('❌ ClickToPay API verification error:', error.message);
    if (axios.isAxiosError(error)) {
      console.error('Response status:', error.response?.status);
      console.error('Response data:', JSON.stringify(error.response?.data, null, 2));
      console.error('Request URL:', error.config?.url);
      
      // Safe parsing of request payload that handles both objects and strings
      let payloadForLog = {};
      if (error.config?.data) {
        if (typeof error.config.data === 'string') {
          try {
            payloadForLog = Object.fromEntries(new URLSearchParams(error.config.data));
          } catch (parseErr) {
            payloadForLog = { raw: error.config.data };
          }
        } else {
          payloadForLog = error.config.data;
        }
      }
      console.error('Request payload:', JSON.stringify({
        ...payloadForLog,
        userName: '***REDACTED***',
        password: '***REDACTED***'
      }, null, 2));
      
      console.error('Error code:', error.code);
      console.error('Request headers:', {
        ...error.config?.headers,
        // Credentials are in payload, not headers for ClickToPay
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

/**
 * Helper function to get order status name
 * Based on documentation page 18
 */
function getOrderStatusName(status) {
  const statuses = {
    0: 'Commande enregistrée, mais pas payée',
    1: 'Montant pré-autorisation bloqué',
    2: 'Le montant a été déposé avec succès ✅',
    3: 'Annulation d\'autorisation',
    4: 'Transaction remboursée',
    5: 'Autorisation par ACS initiée',
    6: 'Autorisation refusée ❌'
  };
  return statuses[status] || `Status inconnu (${status})`;
}

module.exports = {
  createPayment: exports.createPayment,
  verifyPayment: exports.verifyPayment,
  getOrderStatusName
};
