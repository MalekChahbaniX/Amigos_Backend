const konnectAPI = require('../services/konnectAPI');
const Transaction = require('../models/Transaction'); // Modèle transaction

exports.initiateKonnectPayment = async (req, res) => {
  try {
    const { amount, orderId, userId } = req.body;
    // Créer une transaction locale avec statut "pending"
    const transaction = await Transaction.create({
      user: userId,
      type: 'paiement',
      amount,
      status: 'pending',
      details: { orderId },
    });

    const returnUrl = 'myapp://payment-result'; // Deep link app mobile

    // Appeler Konnect API
    const paymentData = await konnectAPI.createPayment({
      amount,
      currency: 'TND',
      orderId,
      returnUrl,
    });

    // Mettre à jour la transaction avec l'URL et Id Konnect
    transaction.details.paymentUrl = paymentData.payment_url;
    transaction.details.konnectTransactionId = paymentData.id;
    await transaction.save();

    res.status(201).json({
      success: true,
      paymentUrl: paymentData.payment_url,
      transactionId: paymentData.id,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Webhook pour mise à jour paiement Konnect (à configurer dans Konnect dashboard)
exports.konnectWebhook = async (req, res) => {
  try {
    const { transactionId, status } = req.body; // selon doc Konnect
    const transaction = await Transaction.findOne({ 'details.konnectTransactionId': transactionId });
    if (!transaction) return res.status(404).send();

    transaction.status = status === 'success' ? 'completed' : 'failed';
    await transaction.save();

    res.sendStatus(200);
  } catch (error) {
    res.status(500).send();
  }
};
