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

// @desc    Get transaction status by ID
// @route   GET /api/transactions/:transactionId/status
// @access  Private (authenticated user)
exports.getTransactionStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;

    // Validate transactionId format (MongoDB ObjectId)
    if (!transactionId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction ID format'
      });
    }

    // Find transaction by ID
    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Guard against missing transaction.user before calling toString()
    if (!transaction.user) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Verify that the authenticated user owns this transaction
    if (transaction.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not own this transaction'
      });
    }

    // Return minimal transaction status data
    res.json({
      success: true,
      data: {
        transactionId: transaction._id,
        status: transaction.status,
        clickToPayOrderId: transaction.details?.clickToPayOrderId || null,
        orderStatus: transaction.details?.orderStatus || null,
        paymentGateway: transaction.paymentGateway,
        amount: transaction.amount,
        createdAt: transaction.createdAt
      }
    });
  } catch (error) {
    console.error('Error in getTransactionStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching transaction status'
    });
  }
};