const flouciAPI = require('../services/flouciAPI');
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
      amount: amount / 1000, // Store in DT, not millimes
      status: 'pending',
      paymentMethodType: paymentMethodType,
      details: transactionDetails,
    });
    console.log('✅ Transaction created:', transaction._id);

    // Configure Flouci redirect URLs - Flouci requires valid HTTP URLs
    // The backend will receive these redirects and then redirect to the mobile deep link
    const backendUrl = 'https://amigosdelivery25.com';
    //const backendUrl = 'http://192.168.1.104:5000';
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