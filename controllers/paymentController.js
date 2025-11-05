// controllers/paymentController.js
import axios from 'axios';
import Transaction from '../models/Transaction.js';

/**
 * @desc   Initier un paiement Swared
 * @route  POST /api/payments/initiate
 */
export const initiatePayment = async (req, res) => {
  const { amount, userId } = req.body;

  try {
    // 1️⃣ Créer la transaction dans ta base locale
    const transaction = await Transaction.create({
      userId,
      amount,
      status: 'pending',
    });

    // 2️⃣ Appeler l’API de Swared (endpoint exemple — à ajuster selon leur doc)
    const response = await axios.post(
      `${process.env.SWARED_API_URL}/payment/create`,
      {
        amount,
        currency: 'TND',
        description: 'Paiement commande mobile',
        reference: transaction._id, // identifiant interne
        redirect_url: `${process.env.APP_URL}/api/payments/callback`, // callback
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SWARED_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // 3️⃣ Sauvegarder l’URL de paiement
    transaction.paymentUrl = response.data.payment_url || response.data.url;
    transaction.transactionId = response.data.transaction_id;
    await transaction.save();

    // 4️⃣ Retourner l’URL au front (React Native)
    res.json({
      success: true,
      paymentUrl: transaction.paymentUrl,
      transactionId: transaction.transactionId,
    });
  } catch (error) {
    console.error('Erreur paiement Swared:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du paiement',
      error: error.response?.data || error.message,
    });
  }
};

/**
 * @desc   Callback (webhook) Swared — confirmation du paiement
 * @route  POST /api/payments/callback
 */
export const paymentCallback = async (req, res) => {
  try {
    const { transaction_id, status } = req.body;

    const transaction = await Transaction.findOne({ transactionId: transaction_id });
    if (!transaction) return res.status(404).json({ message: 'Transaction introuvable' });

    // Vérification du statut
    transaction.status = status === 'success' ? 'success' : 'failed';
    await transaction.save();

    // Ici tu peux mettre à jour la commande associée ou notifier le client
    console.log('Paiement mis à jour:', transaction._id, '→', transaction.status);

    res.sendStatus(200);
  } catch (error) {
    console.error('Erreur callback:', error.message);
    res.status(500).json({ message: 'Erreur callback' });
  }
};

/**
 * @desc   Vérifier le statut d’un paiement
 * @route  GET /api/payments/status/:id
 */
export const checkPaymentStatus = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ message: 'Transaction introuvable' });
    res.json({ status: transaction.status });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
