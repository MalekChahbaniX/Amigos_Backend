const flouciAPI = require('../services/flouciAPI');
const clickToPayAPI = require('../services/clickToPayAPI');
const Transaction = require('../models/Transaction');
const Order = require('../models/Order'); // Make sure you have this model
const mongoose = require('mongoose');

const validateCardDetails = (cardDetails, req) => {
  if (!cardDetails) return { valid: false, error: 'Card details missing' };
  
  // Validate last4
  if (!cardDetails.last4 || !/^\d{4}$/.test(cardDetails.last4)) {
    return { valid: false, error: 'Invalid last4 digits' };
  }
  
  // Validate brand
  const validBrands = ['Visa', 'Mastercard', 'Amex', 'Discover', 'JCB', 'Card'];
  if (!cardDetails.brand || !validBrands.includes(cardDetails.brand)) {
    return { valid: false, error: 'Invalid card brand' };
  }
  
  // Validate cardholder name
  if (!cardDetails.cardholderName || cardDetails.cardholderName.trim() === '') {
    return { valid: false, error: 'Cardholder name missing' };
  }
  
  // Validate expiry date format (MM/YY)
  if (cardDetails.expiryDate && !/^\d{2}\/\d{2}$/.test(cardDetails.expiryDate)) {
    return { valid: false, error: 'Invalid expiry date format' };
  }
  
  // SECURITY: Check that no sensitive fields are present
  if (cardDetails.cvv || cardDetails.cardNumber) {
    console.error('⚠️ SECURITY ALERT: Sensitive card data detected in request');
    if (req) {
      console.error('⚠️ Request IP:', req.ip || 'unknown');
    }
    console.error('⚠️ User ID:', cardDetails.userId || 'unknown');
    return { valid: false, error: 'Sensitive data not allowed' };
  }
  
  return { valid: true };
};

exports.initiateFlouciPayment = async (req, res) => {
  try {
    const { amount, orderId, userId, orderDetails, paymentMethodType = 'wallet', cardDetails } = req.body;
    
    if (!amount || !orderId || !userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: amount, orderId, userId' 
      });
    }
    // Validate payment method type
    if (!['card', 'wallet'].includes(paymentMethodType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid paymentMethodType. Must be "card" or "wallet"',
      });
    }

    // Validate card details if payment method is card
    if (paymentMethodType === 'card') {
      const validation = validateCardDetails(cardDetails, req);
      if (!validation.valid) {
        console.error('❌ Card validation failed:', validation.error);
        return res.status(400).json({
          success: false,
          message: `Invalid card details: ${validation.error}`,
        });
      }
    }
    
    // Log only safe fields after validation
    console.log('💳 Payment initiation:', { 
      paymentMethodType, 
      amount, 
      orderId, 
      ...(paymentMethodType === 'card' && cardDetails ? { 
        cardMetadata: { 
          brand: cardDetails.brand, 
          last4: cardDetails.last4 
        } 
      } : {})
    });
    
    if (paymentMethodType === 'card' && cardDetails) {
      console.log('💳 Card payment - Brand:', cardDetails.brand, 'Last4:', cardDetails.last4);
    }    
    // Security logging for card payments
    if (paymentMethodType === 'card' && cardDetails) {
      console.log('🔒 SECURITY LOG: Card payment attempt');
      console.log('🔒 User ID:', userId);
      console.log('🔒 Card brand:', cardDetails.brand);
      console.log('🔒 Card last4:', cardDetails.last4);
      console.log('🔒 Amount:', amount / 1000, 'DT');
      console.log('🔒 Timestamp:', new Date().toISOString());
      console.log('🔒 Request IP:', req.ip || 'unknown');
      console.log('🔒 Order ID:', orderId);
    }
    console.log('�💾 Creating local transaction...');
    // Create transaction with pending status
    const transactionDetails = {
      orderId,
      orderDetails, // Store order details for later
      amountInMillimes: amount,
      paymentMethodType: paymentMethodType,
    };

    // Add masked card details if payment method is card
    if (paymentMethodType === 'card' && cardDetails) {
      transactionDetails.cardDetails = {
        last4: cardDetails.last4,
        brand: cardDetails.brand,
        cardholderName: cardDetails.cardholderName,
        expiryDate: cardDetails.expiryDate,
        // NEVER store CVV - it should not be in cardDetails at this point
      };
      
      // Security check: ensure CVV is not present
      if (cardDetails.cvv) {
        console.error('⚠️ CRITICAL SECURITY ALERT: CVV detected in backend');
        console.error('⚠️ This should never happen - CVV must not be sent to backend');
        throw new Error('Security violation: CVV detected');
      }
    }

    const transaction = await Transaction.create({
      user: userId,
      type: 'paiement',
      paymentGateway: 'flouci', // Explicitly set gateway
      amount: amount / 1000, // Store in DT, not millimes
      status: 'pending',
      paymentMethodType: paymentMethodType,
      details: transactionDetails,
    });
    console.log('✅ Transaction created:', transaction._id);

    // Configure Flouci redirect URLs - Flouci requires valid HTTP URLs
    // The backend will receive these redirects and then redirect to the mobile deep link
    //const backendUrl = 'https://amigosdelivery25.com';
    const backendUrl = 'http://192.168.1.104:5000';
    const successUrl = `${backendUrl}/api/payments/flouci-success`;
    const failureUrl = `${backendUrl}/api/payments/flouci-failure`;
    
    console.log('🔗 Flouci redirect URLs:', { successUrl, failureUrl });
    
    // Optional: Configure webhook URL for real-time payment status notifications
    // Replace with your actual backend webhook URL
    const webhookUrl = process.env.FLOUCI_WEBHOOK_URL || null;

    console.log('🔌 Calling Flouci API...');
    // Call Flouci API with HTTP redirect URLs
    let paymentData;
    try {
      paymentData = await flouciAPI.createPayment({
        amount,
        orderId,
        successUrl,
        failureUrl,
        webhookUrl,
        paymentMethodType,
      });
    } catch (flouciError) {
      console.error('❌ Flouci API call failed:', flouciError.message);
      throw new Error(`Flouci API failed: ${flouciError.message}`);
    }

    if (!paymentData || !paymentData.payment_url) {
      console.error('❌ Invalid payment data from Flouci:', paymentData);
      throw new Error('Flouci API returned invalid payment data');
    }

    console.log('💳 Payment data received from Flouci:', { 
      payment_url: paymentData.payment_url,
      id: paymentData.id 
    });

    // Update transaction with Flouci payment info
    transaction.details.paymentUrl = paymentData.payment_url;
    transaction.details.flouciPaymentId = paymentData.id;
    await transaction.save();
    console.log('✅ Transaction updated with Flouci data');

    const responseData = {
      success: true,
      paymentUrl: paymentData.payment_url,
      transactionId: transaction._id,
      flouciPaymentId: paymentData.id,
      paymentMethodType: paymentMethodType,
    };
    console.log('📤 Sending response to frontend:', responseData);
    
    res.status(201).json(responseData);
  } catch (error) {
    console.error('❌ Error in initiateFlouciPayment:', error.message);
    
    let errorResponse = {
      success: false,
      message: 'Erreur lors de l\'initialisation du paiement',
      error: {
        type: 'UNKNOWN_ERROR',
      }
    };

    if (error.name === 'ValidationError') {
      // Mongoose validation error
      errorResponse.error.type = 'VALIDATION_ERROR';
      errorResponse.message = 'Données de paiement invalides';
      errorResponse.error.details = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      }));
      console.error('ValidationError details:', errorResponse.error.details);
      return res.status(400).json(errorResponse);
    }

    if (error.message && error.message.includes('Missing required fields')) {
      // Validation error from our code
      errorResponse.error.type = 'VALIDATION_ERROR';
      errorResponse.message = error.message;
      console.error('Request validation error:', error.message);
      return res.status(400).json(errorResponse);
    }

    // Check if it's an Axios error from Flouci API
    const axios = require('axios');
    if (axios.isAxiosError(error)) {
      errorResponse.error.type = 'FLOUCI_API_ERROR';
      errorResponse.error.statusCode = error.response?.status;
      errorResponse.error.requestUrl = error.config?.url;
      
      if (error.response?.data) {
        errorResponse.error.details = error.response.data;
        errorResponse.message = error.response.data.message || 'Erreur Flouci API';
        console.error('Flouci API error response:', JSON.stringify(error.response.data, null, 2));
      } else if (error.code) {
        errorResponse.error.code = error.code;
        errorResponse.message = `Erreur de connexion: ${error.code}`;
        console.error('Flouci connection error:', error.code);
      }
      
      const statusCode = error.response?.status || 500;
      return res.status(statusCode).json(errorResponse);
    }

    // MongoDB or other database errors
    if (error.name && error.name.includes('Mongo')) {
      errorResponse.error.type = 'DATABASE_ERROR';
      errorResponse.message = 'Erreur base de données';
      errorResponse.error.dbError = error.message;
      console.error('Database error:', {
        name: error.name,
        message: error.message,
        mongooseState: mongoose.connection.readyState
      });
      return res.status(500).json(errorResponse);
    }

    // Generic error
    errorResponse.error.errorMessage = error.message;
    res.status(500).json(errorResponse);
  }
};

// Webhook for Flouci payment status updates
exports.flouciWebhook = async (req, res) => {
  console.log('🔔 Flouci webhook received:', req.body);

  try {
    const { payment_id, status } = req.body;
    
    // Validate required webhook fields
    if (!payment_id || !status) {
      console.warn('⚠️ Missing required fields in webhook:', { payment_id, status });
      return res.status(400).json({ message: 'Missing required fields: payment_id, status' });
    }
    
    // Find transaction by Flouci payment ID
    const transaction = await Transaction.findOne({
      'details.flouciPaymentId': payment_id
    });

    if (!transaction) {
      console.warn('⚠️ Transaction not found for webhook, payment_id:', payment_id);
      return res.status(404).json({ message: 'Transaction not found' });
    }

    console.log('📝 Updating transaction status...');
    console.log('💳 Payment method type:', transaction.paymentMethodType);
    if (transaction.paymentMethodType === 'card') {
      console.log('🔒 SECURITY: Card payment - wallet will be credited');
      if (transaction.details && transaction.details.cardDetails) {
        console.log('💳 Card used:', transaction.details.cardDetails.brand, 'ending in', transaction.details.cardDetails.last4);
      }
    }
    // Update transaction status based on Flouci status
    // Flouci status values: SUCCESS, PENDING, EXPIRED, FAILURE
    if (status === 'SUCCESS') {
      transaction.status = 'completed';
      
      // Detect if it's a card payment and credit the application wallet
      // IMPORTANT: Do this BEFORE checking orderId to enable retry if credit previously failed
      if (transaction.paymentMethodType === 'card') {
        // Skip if wallet credit already exists for this transaction (idempotence)
        if (!transaction.details.walletCreditTransactionId && !transaction.details.walletCreditError) {
          console.log('💳 Card payment detected - crediting application wallet...');
          
          try {
            const walletService = require('../services/walletService');
            const walletCredit = await walletService.creditApplicationWallet(
              transaction.amount,
              transaction._id,
              payment_id
            );
            
            console.log('✅ Application wallet credited:', walletCredit._id);
            console.log('💰 Credit amount:', transaction.amount, 'DT');
            
            // Add the wallet credit transaction ID to the details
            transaction.details.walletCreditTransactionId = walletCredit._id;
          } catch (walletError) {
            console.error('❌ Error crediting application wallet:', walletError.message);
            // Log the error but don't fail the webhook
            transaction.details.walletCreditError = walletError.message;
          }
        } else if (transaction.details.walletCreditTransactionId) {
          console.log('ℹ️ Wallet already credited for this payment:', transaction.details.walletCreditTransactionId);
        }
      }
      
      // Check if order was already created for this successful payment (idempotence)
      if (transaction.details.orderId) {
        console.log('ℹ️ Order already exists for this payment:', transaction.details.orderId);
        await transaction.save();
        return res.sendStatus(200);
      }
      
      // Create the actual order if payment is successful
      if (transaction.details.orderDetails) {
        try {
          console.log('🛍️ Creating order from successful payment...');
          
          const orderDetails = transaction.details.orderDetails;
          
          // Validate that required order fields exist
          if (!orderDetails.client || !orderDetails.provider) {
            throw new Error('Missing required fields in orderDetails: client, provider');
          }
          if (!orderDetails.items || orderDetails.items.length === 0) {
            throw new Error('Order items are required');
          }
          
          const order = await Order.create({
            ...orderDetails,
            paymentMethod: 'online',
            paymentStatus: 'paid',
            transactionId: transaction._id,
          });
          console.log('✅ Order created:', order._id);
          
          transaction.details.orderId = order._id;
        } catch (orderError) {
          console.error('❌ Error creating order from payment:', orderError);
          // Log the error but don't fail the webhook - mark transaction as completed anyway
          transaction.details.orderCreationError = orderError.message;
        }
      }
    } else if (status === 'FAILURE' || status === 'EXPIRED') {
      transaction.status = 'failed';
    } else if (status === 'PENDING') {
      transaction.status = 'pending';
    }

    await transaction.save();
    console.log('✅ Transaction updated successfully');

    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Webhook error:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Log MongoDB connection state for diagnosis
    const mongoose = require('mongoose');
    console.error('MongoDB connection state:', mongoose.connection.readyState);
    
    // Check if it's a MongoDB error
    if (error.name && (error.name.includes('Mongo') || error.name.includes('Cast') || error.name.includes('Validation'))) {
      console.error('Database error details:', {
        name: error.name,
        message: error.message,
        mongooseState: mongoose.connection.readyState
      });
      return res.status(500).json({ 
        message: 'Database error during webhook processing',
        type: 'DATABASE_ERROR'
      });
    }
    
    res.status(500).json({ message: 'Webhook processing error' });
  }
};

// Handle Flouci payment success redirect
exports.handleFlouciSuccess = async (req, res) => {
  console.log('🔗 Flouci success redirect received');
  console.log('📋 Query parameters:', req.query);

  try {
    const { payment_id } = req.query;

    // Validate payment_id
    if (!payment_id) {
      console.warn('⚠️ Missing payment_id in query parameters');
      console.log('📌 All query params:', JSON.stringify(req.query, null, 2));
      const deepLinkUrl = 'myapp://payment-result?status=error&message=Missing payment_id';
      console.log('🔗 Redirecting to deep link:', deepLinkUrl);
      return res.redirect(302, deepLinkUrl);
    }

    console.log('🔍 Searching for transaction with payment_id:', payment_id);
    
    // Find transaction by Flouci payment ID
    const transaction = await Transaction.findOne({
      'details.flouciPaymentId': payment_id
    });

    if (!transaction) {
      console.warn('⚠️ Transaction not found for payment_id:', payment_id);
      // Build URLSearchParams from all Flouci query parameters
      const params = new URLSearchParams(req.query);
      params.set('status', 'error');
      params.set('message', 'Transaction not found');
      const deepLinkUrl = `myapp://payment-result?${params.toString()}`;
      console.log('🔗 Redirecting to deep link (transaction not found):', deepLinkUrl);
      return res.redirect(302, deepLinkUrl);
    }

    console.log('✅ Transaction found:', transaction._id);
    
    // Build URLSearchParams from all Flouci query parameters
    const params = new URLSearchParams(req.query);
    params.set('status', 'success');
    params.set('transactionId', transaction._id);
    
    // Construct the deep link URL with success status and all Flouci parameters
    const deepLinkUrl = `myapp://payment-result?${params.toString()}`;
    console.log('🔗 Redirecting to deep link:', deepLinkUrl);
    
    res.redirect(302, deepLinkUrl);
  } catch (error) {
    console.error('❌ Error in handleFlouciSuccess:', error);
    const deepLinkUrl = 'myapp://payment-result?status=error&message=Database error';
    console.log('🔗 Redirecting to deep link (error):', deepLinkUrl);
    res.redirect(302, deepLinkUrl);
  }
};

// Handle Flouci payment failure redirect
exports.handleFlouciFailure = async (req, res) => {
  console.log('🔗 Flouci failure redirect received');
  console.log('📋 Query parameters:', req.query);

  try {
    const { payment_id } = req.query;

    if (payment_id) {
      console.log('📌 Payment failed for payment_id:', payment_id);
    } else {
      console.warn('⚠️ No payment_id provided in failure redirect');
      console.log('📌 All query params:', JSON.stringify(req.query, null, 2));
    }

    // Build URLSearchParams from all Flouci query parameters
    const params = new URLSearchParams(req.query);
    params.set('status', 'failed');
    
    // Construct the deep link URL with failure status and all Flouci parameters
    const deepLinkUrl = `myapp://payment-result?${params.toString()}`;
    console.log('🔗 Redirecting to deep link:', deepLinkUrl);
    
    res.redirect(302, deepLinkUrl);
  } catch (error) {
    console.error('❌ Error in handleFlouciFailure:', error);
    const deepLinkUrl = 'myapp://payment-result?status=error&message=Redirect error';
    console.log('🔗 Redirecting to deep link (error):', deepLinkUrl);
    res.redirect(302, deepLinkUrl);
  }
};

// Initiate ClickToPay payment
exports.initiateClickToPayPayment = async (req, res) => {
  try {
    const { 
      amount, 
      userId, 
      paymentMethodType = 'card', 
      orderDetails,
      currency = '788'  // Code ISO 4217 pour TND
    } = req.body;

    // Validation des paramètres requis
    if (!amount || !userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: amount, userId' 
      });
    }

    // Log de l'initiation
    console.log('✅ ClickToPay credentials validated');
    console.log('💳 ClickToPay payment initiation:', { 
      paymentMethodType, 
      amount,
      currency,
      cardMetadata: { 
        brand: 'ClickToPay Gateway', 
        last4: 'N/A' 
      }
    });

    // Security logging
    console.log('🔒 SECURITY LOG: ClickToPay hosted payment');
    console.log('🔒 User ID:', userId);
    console.log('🔒 Payment method: Gateway Hosted');
    console.log('🔒 Card brand: ClickToPay Gateway');
    console.log('🔒 Card last4: N/A');
    console.log('🔒 Amount:', amount / 1000, 'DT');
    console.log('🔒 Timestamp:', new Date().toISOString());
    console.log('🔒 Request IP:', req.ip || 'unknown');

    // Créer la transaction locale
    console.log('💾 Creating local transaction...');
    const transactionDetails = {
      orderDetails,
      amountInMillimes: amount,
      paymentMethodType: paymentMethodType,
      currency: currency
    };

    const transaction = await Transaction.create({
      user: userId,
      type: 'paiement',
      paymentGateway: 'clictopay',
      amount: amount / 1000, // Store in DT
      status: 'pending',
      paymentMethodType: paymentMethodType,
      details: transactionDetails,
    });
    console.log('✅ Transaction created:', transaction._id);

    // Générer l'orderId à partir de transaction._id
    console.log('✅ Generating orderId from transaction._id');
    const orderId = transaction._id.toString();
    console.log('🆔 Final orderId:', orderId);
    console.log('📏 OrderId length:', orderId.length, 'characters');
    console.log('📌 OrderId source: generated (not provided)');

    // Validation du format orderId
    if (!orderId || orderId.length > 32) {
      throw new Error(`Invalid orderId format: length ${orderId?.length || 0}`);
    }
    console.log('✅ OrderId format validated');

    // ✅ CORRECTION CRITIQUE: Définir les URLs AVANT de les utiliser
    const backendUrl = process.env.BACKEND_URL || 'http://192.168.1.104:5000';
    const returnUrl = `${backendUrl}/api/payments/clictopay-success`;
    const failUrl = `${backendUrl}/api/payments/clictopay-failure`;
    
    console.log('🔗 ClickToPay redirect URLs:', { returnUrl, failUrl });

    // Appeler l'API ClickToPay
    console.log('🔌 Calling ClickToPay API...');
    let paymentData;
    try {
      const clickToPayAPI = require('../services/clickToPayAPI');
      
      paymentData = await clickToPayAPI.createPayment({
        amount,
        orderId,
        returnUrl: returnUrl,  // ✅ Utiliser returnUrl (défini ci-dessus)
        failUrl: failUrl,      // ✅ Utiliser failUrl (défini ci-dessus)
        currency: currency,
        language: 'fr',
        description: orderDetails?.description || `Commande ${orderId.substring(0, 8)}`
      });
    } catch (clickToPayError) {
      console.error('❌ ClickToPay API call failed:', clickToPayError.message);
      
      // Nettoyer la transaction en cas d'échec
      transaction.status = 'failed';
      transaction.details.errorMessage = clickToPayError.message;
      transaction.markModified('details');
      await transaction.save();

      return res.status(502).json({
        success: false,
        message: 'Erreur lors de l\'initialisation du paiement ClickToPay',
        error: {
          type: 'CLICTOPAY_API_ERROR',
          errorMessage: clickToPayError.message,
          details: clickToPayError.response?.data || null
        }
      });
    }

    if (!paymentData || !paymentData.payment_url) {
      console.error('❌ Invalid payment data from ClickToPay:', paymentData);
      throw new Error('ClickToPay API returned invalid payment data');
    }

    console.log('💳 Payment data received from ClickToPay:', { 
      payment_url: paymentData.payment_url,
      id: paymentData.id 
    });

    // Mettre à jour la transaction avec les données ClickToPay
    transaction.details.paymentUrl = paymentData.payment_url;
    transaction.details.clickToPayOrderId = paymentData.id;
    transaction.details.orderId = orderId;
    transaction.markModified('details');
    await transaction.save();
    console.log('✅ Transaction updated with ClickToPay data');
    console.log('🔍 Stored clickToPayOrderId:', paymentData.id);

    // Préparer la réponse
    const responseData = {
      success: true,
      paymentUrl: paymentData.payment_url,
      transactionId: transaction._id,
      clickToPayOrderId: paymentData.id,
      paymentMethodType: paymentMethodType,
    };
    console.log('📤 Sending response to frontend:', responseData);
    
    res.status(201).json(responseData);
  } catch (error) {
    console.error('❌ Error in initiateClickToPayPayment:', error.message);
    
    let errorResponse = {
      success: false,
      message: 'Erreur lors de l\'initialisation du paiement',
      error: {
        type: 'UNKNOWN_ERROR',
        statusCode: 500,
        message: error.message,
        details: null
      }
    };

    // Déterminer le type d'erreur
    if (error.message.includes('ClickToPay')) {
      errorResponse.error.type = 'CLICTOPAY_API_ERROR';
    } else if (error.message.includes('required') || error.message.includes('validation')) {
      errorResponse.error.type = 'VALIDATION_ERROR';
      errorResponse.error.statusCode = 400;
    } else if (error.name === 'MongoError' || error.name === 'ValidationError') {
      errorResponse.error.type = 'DATABASE_ERROR';
    }

    const statusCode = errorResponse.error.statusCode || 500;
    res.status(statusCode).json(errorResponse);
  }
};

// Handle ClickToPay payment success redirect
exports.handleClickToPaySuccess = async (req, res) => {
  const traceId = `TRACE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔍 REQUEST DETAILS:', traceId);
  console.log('═══════════════════════════════════════════════════════');
  console.log('⏱️  Timestamp:', new Date().toISOString());
  console.log('📌 Method:', req.method);
  console.log('📌 URL:', req.originalUrl);
  console.log('📌 IP:', req.ip || req.connection.remoteAddress);
  console.log('📌 User-Agent:', req.headers['user-agent']);
  console.log('📌 Referer:', req.headers['referer']);
  console.log('📌 Query params:', JSON.stringify(req.query, null, 2));
  console.log('═══════════════════════════════════════════════════════');
  
  console.log('🔗 ClickToPay success redirect received');
  console.log('📋 Query parameters:', req.query);

  try {
    const { orderId } = req.query;

    // Validate orderId
    if (!orderId) {
      console.warn('⚠️ Missing orderId in query parameters');
      console.log('📌 All query params:', JSON.stringify(req.query, null, 2));
      const deepLinkUrl = 'myapp://payment-result?status=error&message=Missing orderId';
      
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔀 REDIRECT DETAILS:', traceId);
      console.log('═══════════════════════════════════════════════════════');
      console.log('⏱️  Timestamp:', new Date().toISOString());
      console.log('📌 Status Code:', 302);
      console.log('📌 Location:', deepLinkUrl);
      console.log('📌 Response Headers:', {
        'Location': deepLinkUrl,
        'Content-Type': 'text/html'
      });
      console.log('═══════════════════════════════════════════════════════');
      
      console.log('🔗 Redirecting to deep link:', deepLinkUrl);
      return res.redirect(302, deepLinkUrl);
    }

    console.log('🔍 Verifying payment status with ClickToPay API...');
    
    // Call ClickToPay API to verify the actual payment status
    let verificationData;
    try {
      verificationData = await clickToPayAPI.verifyPayment(orderId);
      console.log('✅ Verification response received:', JSON.stringify(verificationData, null, 2));
    } catch (verifyError) {
      console.error('❌ ClickToPay verification failed:', verifyError.message);
      const deepLinkUrl = 'myapp://payment-result?status=error&message=Verification failed';
      
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔀 REDIRECT DETAILS:', traceId);
      console.log('═══════════════════════════════════════════════════════');
      console.log('⏱️  Timestamp:', new Date().toISOString());
      console.log('📌 Status Code:', 302);
      console.log('📌 Location:', deepLinkUrl);
      console.log('═══════════════════════════════════════════════════════');
      
      console.log('🔗 Redirecting to deep link (verification error):', deepLinkUrl);
      return res.redirect(302, deepLinkUrl);
    }

    // Check if payment was actually authorized (orderStatus = 2)
    if (verificationData.orderStatus !== 2) {
      console.warn('⚠️ Payment not authorized. Order status:', verificationData.orderStatus);
      const deepLinkUrl = `myapp://payment-result?status=failed&message=Payment not authorized&orderStatus=${verificationData.orderStatus}`;
      
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔀 REDIRECT DETAILS:', traceId);
      console.log('═══════════════════════════════════════════════════════');
      console.log('⏱️  Timestamp:', new Date().toISOString());
      console.log('📌 Status Code:', 302);
      console.log('📌 Location:', deepLinkUrl);
      console.log('═══════════════════════════════════════════════════════');
      
      console.log('🔗 Redirecting to deep link (not authorized):', deepLinkUrl);
      return res.redirect(302, deepLinkUrl);
    }

    console.log('🔍 Searching for transaction with clickToPayOrderId:', orderId);
    
    // Find transaction by ClickToPay orderId
    let transaction = await Transaction.findOne({
      'details.clickToPayOrderId': orderId
    });

    // FALLBACK: Search by orderNumber if first search fails
    if (!transaction && verificationData.orderNumber) {
      console.log('⚠️ Transaction not found by clickToPayOrderId, trying orderNumber fallback');
      console.log('🔍 Searching by orderNumber:', verificationData.orderNumber);
      
      transaction = await Transaction.findOne({
        'details.orderId': verificationData.orderNumber
      });
      
      if (transaction) {
        console.log('✅ Transaction found via orderNumber fallback:', transaction._id);
      }
    }

    if (!transaction) {
      console.error('❌ Transaction not found by clickToPayOrderId OR orderNumber');
      console.error('❌ Searched clickToPayOrderId:', orderId);
      console.error('❌ Searched orderNumber:', verificationData.orderNumber);
      
      // Build URLSearchParams from all ClickToPay query parameters
      const params = new URLSearchParams(req.query);
      params.set('status', 'error');
      params.set('message', 'Transaction not found');
      const deepLinkUrl = `myapp://payment-result?${params.toString()}`;
      
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔀 REDIRECT DETAILS:', traceId);
      console.log('═══════════════════════════════════════════════════════');
      console.log('⏱️  Timestamp:', new Date().toISOString());
      console.log('📌 Status Code:', 302);
      console.log('📌 Location:', deepLinkUrl);
      console.log('═══════════════════════════════════════════════════════');
      
      console.log('🔗 Redirecting to deep link (transaction not found):', deepLinkUrl);
      return res.redirect(302, deepLinkUrl);
    }

    console.log('✅ Transaction found:', transaction._id);
    console.log('🔍 Order status from verification:', verificationData.orderStatus);
    
    // Update transaction status to success
    transaction.status = 'success';
    transaction.details.verificationData = verificationData;
    transaction.details.orderStatus = verificationData.orderStatus;
    transaction.details.authId = verificationData.cardAuthInfo?.authorizationResponseId;
    
    // CRITICAL: Mark 'details' as modified for Mongoose
    transaction.markModified('details');
    await transaction.save();
    console.log('✅ Transaction updated:', {
      _id: transaction._id,
      status: transaction.status,
      orderStatus: verificationData.orderStatus,
      authId: verificationData.cardAuthInfo?.authorizationResponseId
    });
    
    // CREATE ORDER if it doesn't exist already
    const Order = require('../models/Order');
    // DISABLED: Order creation should be handled by frontend via orderController
    // This old order creation uses deprecated schema and conflicts with new multi-provider system
    /*
    let order = await Order.findOne({ transactionId: transaction._id });

    if (!order && transaction.details.orderDetails) {
      console.log('📦 Creating order from transaction...');
      
      try {
        const orderData = {
          user: transaction.user,
          transactionId: transaction._id,
          items: transaction.details.orderDetails.items || [],
          total: transaction.amount,
          deliveryFee: transaction.details.orderDetails.deliveryFee || 0,
          status: 'pending',
          paymentMethod: 'clictopay',
          paymentStatus: 'paid',
          deliveryAddress: transaction.details.orderDetails.deliveryAddress,
          provider: transaction.details.orderDetails.providerId,
        };
        
        order = await Order.create(orderData);
        console.log('✅ Order created:', order._id);
      } catch (orderError) {
        console.error('❌ Error creating order:', orderError.message);
        // Don't block redirection if order creation fails
      }
    } else if (order) {
      console.log('ℹ️ Order already exists:', order._id);
    }
    */
    let order = null;
    
    // Build redirect parameters with authorization details
    const params = new URLSearchParams();
    params.set('status', 'success');
    params.set('transactionId', transaction._id.toString());
    params.set('gateway', 'clictopay');
    params.set('orderStatus', verificationData.orderStatus.toString());
    
    // Add authorizationResponseId if available
    if (verificationData.cardAuthInfo?.authorizationResponseId) {
      params.set('authId', verificationData.cardAuthInfo.authorizationResponseId);
    }
    
    // Add orderId if order was created or exists
    if (order) {
      params.set('orderId', order._id.toString());
    }
    
    // Construct the deep link URL with success status and all ClickToPay parameters
    const deepLinkUrl = `myapp://payment-result?${params.toString()}`;
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔀 REDIRECT DETAILS:', traceId);
    console.log('═══════════════════════════════════════════════════════');
    console.log('⏱️  Timestamp:', new Date().toISOString());
    console.log('📌 Status Code:', 302);
    console.log('📌 Location:', deepLinkUrl);
    console.log('📌 Response Headers:', {
      'Location': deepLinkUrl,
      'Content-Type': 'text/html'
    });
    console.log('📋 Deep link params:', {
      status: 'success',
      transactionId: transaction._id.toString(),
      gateway: 'clictopay',
      orderStatus: verificationData.orderStatus,
      authId: verificationData.cardAuthInfo?.authorizationResponseId,
      orderId: order?._id.toString()
    });
    console.log('═══════════════════════════════════════════════════════');
    
    console.log('🔗 Redirecting to deep link (success):', deepLinkUrl);
    res.redirect(302, deepLinkUrl);
  } catch (error) {
    console.error('❌ Error in handleClickToPaySuccess:', error);
    const deepLinkUrl = 'myapp://payment-result?status=error&message=Database error';
    
    const traceIdError = `TRACE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔀 REDIRECT DETAILS:', traceIdError);
    console.log('═══════════════════════════════════════════════════════');
    console.log('⏱️  Timestamp:', new Date().toISOString());
    console.log('📌 Status Code:', 302);
    console.log('📌 Location:', deepLinkUrl);
    console.log('═══════════════════════════════════════════════════════');
    
    console.log('🔗 Redirecting to deep link (error):', deepLinkUrl);
    res.redirect(302, deepLinkUrl);
  }
};

// Handle ClickToPay payment failure redirect
exports.handleClickToPayFailure = async (req, res) => {
  const traceId = `TRACE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔍 REQUEST DETAILS:', traceId);
  console.log('═══════════════════════════════════════════════════════');
  console.log('⏱️  Timestamp:', new Date().toISOString());
  console.log('📌 Method:', req.method);
  console.log('📌 URL:', req.originalUrl);
  console.log('📌 IP:', req.ip || req.connection.remoteAddress);
  console.log('📌 User-Agent:', req.headers['user-agent']);
  console.log('📌 Referer:', req.headers['referer']);
  console.log('📌 Query params:', JSON.stringify(req.query, null, 2));
  console.log('═══════════════════════════════════════════════════════');
  
  console.log('🔗 ClickToPay failure redirect received');
  console.log('📋 Query parameters:', req.query);

  try {
    const { orderId } = req.query;

    if (orderId) {
      console.log('📌 Payment redirect for orderId:', orderId);
      
      // Try to get detailed information from ClickToPay API
      try {
        const verificationData = await clickToPayAPI.verifyPayment(orderId);
        console.log('🔍 Verification details from ClickToPay:', JSON.stringify(verificationData, null, 2));
        
        // Search for and update transaction
        let transaction = await Transaction.findOne({
          'details.clickToPayOrderId': orderId
        });
        
        // FALLBACK: Search by orderNumber
        if (!transaction && verificationData.orderNumber) {
          console.log('⚠️ Transaction not found by clickToPayOrderId, trying orderNumber fallback');
          transaction = await Transaction.findOne({
            'details.orderId': verificationData.orderNumber
          });
          if (transaction) {
            console.log('✅ Transaction found via orderNumber fallback:', transaction._id);
          }
        }
        
        if (transaction) {
          // Determine status based on orderStatus
          // orderStatus = 2 means success/authorized
          if (verificationData.orderStatus === 2) {
            console.log('✅ Payment actually succeeded (orderStatus = 2), marking transaction as success');
            transaction.status = 'success';
          } else {
            console.log('❌ Payment failed (orderStatus =', verificationData.orderStatus + ')');
            transaction.status = 'failed';
          }
          transaction.details.orderStatus = verificationData.orderStatus;
          transaction.details.verificationData = verificationData;
          transaction.details.authId = verificationData.cardAuthInfo?.authorizationResponseId;
          
          // CRITICAL: Mark details as modified
          transaction.markModified('details');
          await transaction.save();
          console.log('✅ Transaction updated with status:', transaction.status);
        } else {
          console.warn('⚠️ Transaction not found for orderId:', orderId);
        }
      } catch (verifyError) {
        console.error('⚠️ Could not verify payment details:', verifyError.message);
      }
    } else {
      console.warn('⚠️ No orderId provided in failure redirect');
      console.log('📌 All query params:', JSON.stringify(req.query, null, 2));
    }

    // Build URLSearchParams from all ClickToPay query parameters
    const params = new URLSearchParams(req.query);
    
    // Check if we have verification data to determine actual status
    let finalStatus = 'failed'; // Default to failed
    if (orderId) {
      try {
        const verificationData = await clickToPayAPI.verifyPayment(orderId);
        if (verificationData.orderStatus === 2) {
          finalStatus = 'success';
          params.set('orderStatus', verificationData.orderStatus);
        }
      } catch (e) {
        // If we can't verify, keep default failed status
      }
    }
    
    params.set('status', finalStatus);
    
    // Construct the deep link URL with appropriate status and all ClickToPay parameters
    const deepLinkUrl = `myapp://payment-result?${params.toString()}`;
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔀 REDIRECT DETAILS:', traceId);
    console.log('═══════════════════════════════════════════════════════');
    console.log('⏱️  Timestamp:', new Date().toISOString());
    console.log('📌 Status Code:', 302);
    console.log('📌 Location:', deepLinkUrl);
    console.log('📌 Response Headers:', {
      'Location': deepLinkUrl,
      'Content-Type': 'text/html'
    });
    console.log('═══════════════════════════════════════════════════════');
    
    console.log('🔗 Redirecting to deep link:', deepLinkUrl);
    res.redirect(302, deepLinkUrl);
  } catch (error) {
    console.error('❌ Error in handleClickToPayFailure:', error);
    const deepLinkUrl = 'myapp://payment-result?status=error&message=Redirect error';
    
    const traceIdError = `TRACE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔀 REDIRECT DETAILS:', traceIdError);
    console.log('═══════════════════════════════════════════════════════');
    console.log('⏱️  Timestamp:', new Date().toISOString());
    console.log('📌 Status Code:', 302);
    console.log('📌 Location:', deepLinkUrl);
    console.log('═══════════════════════════════════════════════════════');
    
    console.log('🔗 Redirecting to deep link (error):', deepLinkUrl);
    res.redirect(302, deepLinkUrl);
  }
};
// Verify ClickToPay payment status
exports.verifyClickToPayPayment = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    console.log("🔍 Verifying ClickToPay payment status for orderId:", orderId);

    // Call ClickToPay API to verify payment status
    const verificationResult = await clickToPayAPI.verifyPayment(orderId);

    // Find the transaction in our database
    const transaction = await Transaction.findOne({
      "details.clickToPayOrderId": orderId
    });

    if (transaction) {
      // Update transaction status based on verification
      const statusMap = {
        0: "pending",
        1: "pending", 
        2: "completed",
        3: "cancelled",
        4: "refunded",
        5: "pending",
        6: "failed"
      };

      transaction.status = statusMap[verificationResult.orderStatus] || "pending";
      transaction.details.verificationResult = verificationResult;
      transaction.details.lastVerifiedAt = new Date();
      transaction.markModified("details");
      await transaction.save();

      console.log("✅ Transaction updated with verification result");
    }

    res.json({
      success: true,
      data: {
        orderId: orderId,
        orderStatus: verificationResult.orderStatus,
        orderStatusName: verificationResult.orderStatusName || "Unknown",
        amount: verificationResult.amount,
        actionCode: verificationResult.actionCode,
        actionCodeDescription: verificationResult.actionCodeDescription,
        transactionId: transaction?._id,
        transactionStatus: transaction?.status
      }
    });

  } catch (error) {
    console.error("❌ Error verifying ClickToPay payment:", error.message);
    
    res.status(500).json({
      success: false,
      message: "Error verifying payment status",
      error: {
        type: "VERIFICATION_ERROR",
        message: error.message
      }
    });
  }
};
