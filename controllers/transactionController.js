const Transaction = require('../models/Transaction');

// @desc    Initiate an online payment
// @route   POST /api/payments/online
// @access  Private (client)
exports.initiatePayment = async (req, res) => {
  const { user, amount, orderId } = req.body;

  try {
    // Dans un cas réel, vous interagiriez ici avec une passerelle de paiement (ex: Stripe, ClicToPay).
    // La passerelle de paiement vous retournerait un statut de transaction et un token de confirmation.

    // Pour l'instant, nous simulons la transaction.
    const transaction = await Transaction.create({
      user,
      type: 'paiement',
      amount,
      status: 'completed', // Supposons que le paiement réussit.
      details: { orderId },
    });

    res.status(201).json({
      message: 'Payment initiated successfully. Transaction completed.',
      transaction,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create a money transfer
// @route   POST /api/transfers
// @access  Private (client)
exports.createTransfer = async (req, res) => {
  const { user, amount, recipient, type, details } = req.body;

  try {
    const transaction = await Transaction.create({
      user,
      type: 'transfert',
      amount,
      status: 'completed', // Supposons que le virement réussit.
      details: { recipient, type, ...details },
    });

    res.status(201).json({
      message: 'Transfer completed successfully.',
      transaction,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get a user's transaction history
// @route   GET /api/transactions/user/:id
// @access  Private (client)
exports.getTransactionHistory = async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.params.id }).sort({ createdAt: -1 });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};