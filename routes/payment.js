// backend/routes/payment.js
const express = require('express');
const router = express.Router();
const swaredAPI = require('../services/swaredAPI');
const crypto = require('crypto');


router.post('/payment/init', async (req, res) => {
  try {
    const { orderId, amount, customerInfo } = req.body;
    
    // Initialiser le paiement avec Swared
    const paymentSession = await swaredAPI.createPaymentSession({
      merchantId: process.env.SWARED_MERCHANT_ID,
      orderId,
      amount: amount * 1000, // DT vers millimes
      currency: 'TND',
      returnUrl: `${process.env.APP_URL}/payment/success`,
      cancelUrl: `${process.env.APP_URL}/payment/cancel`,
      customerInfo,
    });

    res.json({
      success: true,
      paymentUrl: paymentSession.paymentUrl,
      sessionId: paymentSession.sessionId,
    });
  } catch (error) {
    console.error('Payment init error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'initialisation du paiement',
    });
  }
});
router.get('/payment/status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { sessionId } = req.query;
    
    const paymentStatus = await swaredAPI.getPaymentStatus(orderId, sessionId);
    
    res.json({
      success: true,
      status: paymentStatus.status,
      transactionId: paymentStatus.transactionId,
    });
  } catch (error) {
    console.error('Payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification du statut',
    });
  }
});



router.post('/webhooks/swared', async (req, res) => {
  try {
    const signature = req.headers['x-swared-signature'];
    const payload = JSON.stringify(req.body);
    
    // Valider la signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.SWARED_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Traiter l'événement
    const { event, orderId, status, transactionId, amount } = req.body;
    
    switch (event) {
      case 'payment.success':
        // Mettre à jour la commande comme payée
        await Order.findOneAndUpdate(
          { _id: orderId },
          { 
            paymentStatus: 'paid',
            transactionId,
            paidAt: new Date(),
          }
        );
        break;
        
      case 'payment.failed':
        // Mettre à jour la commande comme échouée
        await Order.findOneAndUpdate(
          { _id: orderId },
          { paymentStatus: 'failed' }
        );
        break;
        
      case 'payment.cancelled':
        // Mettre à jour la commande comme annulée
        await Order.findOneAndUpdate(
          { _id: orderId },
          { paymentStatus: 'cancelled' }
        );
        break;
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;


// Configurer l'URL du webhook sur Swared
// Dans votre dashboard Swared, configurez l'URL de webhook :
// https://votre-backend.com/api/webhooks/swared


// 6. Test et débogage
// Mode Test Swared
// Swared propose un mode sandbox pour tester les paiements.
// typescript// Pour le mode test
// const SWARED_CONFIG = {
//   apiUrl: 'https://sandbox-api.swared.tn', // Mode test
//   merchantId: 'test_merchant_id',
//   apiKey: 'test_api_key',
// };


// Cartes de test
// Utilisez ces cartes pour tester en mode sandbox :
// CarteRésultat
// 4111 1111 1111 1111 Succès
// 4000 0000 0000 0002 Échec
// 4000 0000 0000 0077 Annulation
// CVV : 123
// Date d'expiration : n'importe quelle date future

//  Flux complet de paiement

// Utilisateur finalise sa commande → CheckoutScreen
// Sélection du mode de paiement → Carte bancaire (Swared)
// Création de la commande → Backend crée une commande
// Initialisation du paiement → Appel API Swared
// Redirection → SwaredPaymentScreen avec WebView
// Utilisateur paie → Interface Swared dans WebView
// Redirection de retour → Deep link vers l'app
// Webhook → Backend reçoit la confirmation
// Confirmation → OrderConfirmationScreen