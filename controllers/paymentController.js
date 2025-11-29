const konnectAPI = require('../services/konnectAPI');
const Transaction = require('../models/Transaction');
const Order = require('../models/Order'); // Make sure you have this model

exports.initiateKonnectPayment = async (req, res) => {
  console.log('💳 Payment initiation request:', req.body);

  try {
    const { amount, orderId, userId, orderDetails } = req.body;
    
    if (!amount || !orderId || !userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: amount, orderId, userId' 
      });
    }

    console.log('💾 Creating local transaction...');
    // Create transaction with pending status
    const transaction = await Transaction.create({
      user: userId,
      type: 'paiement',
      amount: amount / 1000, // Store in DT, not millimes
      status: 'pending',
      details: { 
        orderId,
        orderDetails, // Store order details for later
        amountInMillimes: amount,
      },
    });
    console.log('✅ Transaction created:', transaction._id);

    const returnUrl = 'myapp://payment-result';

    console.log('🔌 Calling Konnect API...');
    // Call Konnect API
    const paymentData = await konnectAPI.createPayment({
      amount,
      currency: 'TND',
      orderId,
      returnUrl,
    });

    // Update transaction with Konnect payment info
    transaction.details.paymentUrl = paymentData.payment_url;
    transaction.details.konnectPaymentRef = paymentData.id;
    await transaction.save();
    console.log('✅ Transaction updated with Konnect data');

    res.status(201).json({
      success: true,
      paymentUrl: paymentData.payment_url,
      transactionId: transaction._id,
      konnectPaymentRef: paymentData.id,
    });
  } catch (error) {
    console.error('❌ Error in initiateKonnectPayment:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Erreur lors de l\'initialisation du paiement' 
    });
  }
};

// Webhook for Konnect payment status updates
exports.konnectWebhook = async (req, res) => {
  console.log('🔔 Konnect webhook received:', req.body);

  try {
    const { payment_ref, order_id, status } = req.body;
    
    // Find transaction by Konnect payment reference or order ID
    const transaction = await Transaction.findOne({
      $or: [
        { 'details.konnectPaymentRef': payment_ref },
        { 'details.orderId': order_id }
      ]
    });

    if (!transaction) {
      console.warn('⚠️ Transaction not found for webhook');
      return res.status(404).json({ message: 'Transaction not found' });
    }

    console.log('📝 Updating transaction status...');
    // Update transaction status based on Konnect status
    if (status === 'completed' || status === 'success') {
      transaction.status = 'completed';
      
      // Create the actual order if payment is successful
      if (transaction.details.orderDetails) {
        console.log('🛍️ Creating order from successful payment...');
        
        // Calculate platformSolde for the order
        const orderDetails = transaction.details.orderDetails;
        const clientSubtotal = orderDetails.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const restaurantSubtotal = clientSubtotal * 0.95; // Assuming 5% commission for restaurants
        const deliveryFee = orderDetails.deliveryFee || 0;
        const appFee = 1.5; // Default app fee
        
        const order = await Order.create({
          ...orderDetails,
          paymentMethod: 'card',
          paymentStatus: 'paid',
          transactionId: transaction._id,
          platformSolde: clientSubtotal - restaurantSubtotal + deliveryFee + appFee,
        });
        console.log('✅ Order created:', order._id);
        
        transaction.details.orderId = order._id;
      }
    } else if (status === 'failed' || status === 'cancelled') {
      transaction.status = 'failed';
    }

    await transaction.save();
    console.log('✅ Transaction updated successfully');

    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ message: 'Webhook processing error' });
  }
};