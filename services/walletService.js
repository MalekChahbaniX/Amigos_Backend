const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');
const flouciAPI = require('./flouciAPI');

/**
 * Credit the application wallet for a successful card payment
 * Calls Flouci API to credit merchant wallet, then creates local tracking transaction
 * 
 * @param {Number} amount - Amount in dinars (DT)
 * @param {ObjectId} sourceTransactionId - ID of the original card payment transaction
 * @param {String} paymentId - Flouci payment ID
 * @returns {Promise<Object>} The created wallet credit transaction
 */
exports.creditApplicationWallet = async (amount, sourceTransactionId, paymentId) => {
  try {
    console.log('💰 Processing wallet credit for card payment...');
    console.log('Amount:', amount, 'DT | Source Transaction:', sourceTransactionId);

    // Verify the source transaction exists and is a card payment
    const sourceTransaction = await Transaction.findById(sourceTransactionId);
    if (!sourceTransaction) {
      throw new Error(`Source transaction not found: ${sourceTransactionId}`);
    }

    // Verify it's a paiement transaction with card payment method
    if (sourceTransaction.type !== 'paiement') {
      throw new Error(`Source transaction is not a payment: ${sourceTransaction.type}`);
    }

    if (sourceTransaction.paymentMethodType !== 'card') {
      throw new Error(`Source transaction is not a card payment: ${sourceTransaction.paymentMethodType}`);
    }

    console.log('✅ Source transaction verified');

    // Check for idempotence - ensure no wallet credit already exists for this transaction
    const existingCredit = await Transaction.findOne({
      type: 'wallet_credit',
      'details.sourceTransactionId': sourceTransactionId,
    });

    if (existingCredit) {
      console.log('ℹ️ Wallet already credited for this transaction:', sourceTransactionId);
      console.log('Returning existing credit transaction:', existingCredit._id);
      return existingCredit;
    }

    // Call Flouci API to credit merchant wallet
    console.log('🌐 Calling Flouci API to credit merchant wallet...');
    let flouciCreditResult = null;
    try {
      // Use verify payment to confirm payment is SUCCESS before crediting
      const paymentVerification = await flouciAPI.verifyPayment(paymentId);
      
      if (paymentVerification.result?.status !== 'SUCCESS') {
        throw new Error(`Payment status is not SUCCESS: ${paymentVerification.result?.status}`);
      }
      
      console.log('✅ Flouci payment verified as SUCCESS');
      flouciCreditResult = paymentVerification; // Store for audit trail
    } catch (flouciError) {
      console.error('❌ Flouci API credit verification failed:', flouciError.message);
      throw new Error(`Flouci API error: ${flouciError.message}`);
    }

    // Create the wallet credit transaction
    const walletCreditTransaction = await Transaction.create({
      user: null, // System transaction for application wallet
      type: 'wallet_credit',
      amount: amount, // Store in DT
      paymentMethodType: 'wallet',
      status: 'completed',
      details: {
        sourceTransactionId: sourceTransactionId,
        sourcePaymentId: paymentId,
        creditReason: 'card_payment_success',
        creditedAt: new Date(),
        flouciVerificationResult: flouciCreditResult, // Store Flouci response for audit
      },
    });

    console.log('✅ Wallet credit transaction created:', walletCreditTransaction._id);
    console.log('💰 Credit amount:', amount, 'DT has been added to application wallet');

    return walletCreditTransaction;
  } catch (error) {
    console.error('❌ Error in creditApplicationWallet:', error.message);
    throw error;
  }
};

/**
 * Get the current balance of the application wallet
 * Calculates by summing all completed wallet_credit transactions
 * 
 * @returns {Promise<Object>} Balance information
 */
exports.getApplicationWalletBalance = async () => {
  try {
    console.log('🔍 Calculating application wallet balance...');

    // Get all completed wallet credit transactions
    const creditTransactions = await Transaction.find({
      type: 'wallet_credit',
      status: 'completed',
    });

    // Sum up all credits
    const totalBalance = creditTransactions.reduce((sum, transaction) => {
      return sum + transaction.amount;
    }, 0);

    // Get the date of the last credit
    const lastCredit = creditTransactions.length > 0
      ? creditTransactions.sort((a, b) => b.createdAt - a.createdAt)[0]
      : null;

    const balanceInfo = {
      balance: totalBalance,
      currency: 'DT',
      totalCredits: creditTransactions.length,
      lastCreditDate: lastCredit ? lastCredit.createdAt : null,
      lastCreditAmount: lastCredit ? lastCredit.amount : null,
      asOf: new Date(),
    };

    console.log('✅ Wallet balance calculated:', balanceInfo.balance, 'DT');
    console.log('Total credits:', balanceInfo.totalCredits);

    return balanceInfo;
  } catch (error) {
    console.error('❌ Error calculating wallet balance:', error.message);
    throw error;
  }
};

/**
 * Get wallet transaction history with pagination
 * 
 * @param {Object} options - Query options
 * @param {Number} options.limit - Maximum number of records (default: 50)
 * @param {Number} options.skip - Number of records to skip (default: 0)
 * @param {Date} options.startDate - Filter transactions after this date
 * @param {Date} options.endDate - Filter transactions before this date
 * @returns {Promise<Array>} Array of wallet credit transactions
 */
exports.getWalletTransactionHistory = async (options = {}) => {
  try {
    const { limit = 50, skip = 0, startDate, endDate } = options;

    console.log('🔍 Retrieving wallet transaction history...');
    console.log('Limit:', limit, '| Skip:', skip);

    // Build query filter
    const filter = {
      type: 'wallet_credit',
      status: 'completed',
    };

    // Add date range filters if provided
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = startDate;
      if (endDate) filter.createdAt.$lte = endDate;
    }

    // Query with pagination and sorting
    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    console.log('✅ Retrieved', transactions.length, 'wallet transactions');

    return transactions;
  } catch (error) {
    console.error('❌ Error retrieving wallet transaction history:', error.message);
    throw error;
  }
};

/**
 * Get detailed wallet statistics
 * 
 * @returns {Promise<Object>} Wallet statistics
 */
exports.getWalletStatistics = async () => {
  try {
    console.log('📊 Calculating wallet statistics...');

    const creditTransactions = await Transaction.find({
      type: 'wallet_credit',
      status: 'completed',
    });

    const totalBalance = creditTransactions.reduce((sum, transaction) => {
      return sum + transaction.amount;
    }, 0);

    // Group by month
    const creditsByMonth = {};
    creditTransactions.forEach((transaction) => {
      const month = transaction.createdAt.toISOString().slice(0, 7); // YYYY-MM
      creditsByMonth[month] = (creditsByMonth[month] || 0) + transaction.amount;
    });

    // Calculate average credit amount
    const averageCredit = creditTransactions.length > 0
      ? totalBalance / creditTransactions.length
      : 0;

    const statistics = {
      totalBalance,
      totalCredits: creditTransactions.length,
      averageCreditAmount: averageCredit,
      creditsByMonth,
      firstCreditDate: creditTransactions.length > 0
        ? creditTransactions.sort((a, b) => a.createdAt - b.createdAt)[0].createdAt
        : null,
      lastCreditDate: creditTransactions.length > 0
        ? creditTransactions.sort((a, b) => b.createdAt - a.createdAt)[0].createdAt
        : null,
    };

    console.log('✅ Wallet statistics calculated');
    console.log('Total balance:', statistics.totalBalance, 'DT');
    console.log('Total credits:', statistics.totalCredits);

    return statistics;
  } catch (error) {
    console.error('❌ Error calculating wallet statistics:', error.message);
    throw error;
  }
};
