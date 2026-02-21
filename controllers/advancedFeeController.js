const { calculateAdvancedFees, updateOrderWithAdvancedFees } = require('../services/advancedFeeCalculator');
const Order = require('../models/Order');
const User = require('../models/User');

// @desc    Calculate advanced fees for an order (Zone 5 logic)
// @route   POST /api/advanced-fees/calculate
// @access  Private (admin)
exports.calculateAdvancedFees = async (req, res) => {
  try {
    const { orderId, delivererId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    // Récupérer la commande
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Récupérer le livreur
    let deliverer = null;
    if (delivererId) {
      deliverer = await User.findById(delivererId);
    }

    // Calculer les frais avancés
    const advancedFees = await calculateAdvancedFees(order, deliverer);

    res.status(200).json({
      success: true,
      data: advancedFees,
      message: 'Advanced fees calculated successfully'
    });
  } catch (error) {
    console.error('Error calculating advanced fees:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating advanced fees',
      error: error.message
    });
  }
};

// @desc    Update an order with advanced fees (Zone 5 logic)
// @route   PUT /api/advanced-fees/update-order/:orderId
// @access  Private (admin)
exports.updateOrderWithAdvancedFees = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { delivererId } = req.body;

    // Récupérer la commande
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Récupérer le livreur
    let deliverer = null;
    if (delivererId) {
      deliverer = await User.findById(delivererId);
    }

    // Mettre à jour la commande avec les frais avancés
    const updatedOrder = await updateOrderWithAdvancedFees(order, deliverer);

    res.status(200).json({
      success: true,
      data: updatedOrder,
      message: 'Order updated with advanced fees successfully'
    });
  } catch (error) {
    console.error('Error updating order with advanced fees:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating order with advanced fees',
      error: error.message
    });
  }
};

// @desc    Batch update multiple orders with advanced fees
// @route   POST /api/advanced-fees/batch-update
// @access  Private (admin)
exports.batchUpdateOrdersWithAdvancedFees = async (req, res) => {
  try {
    const { orderIds, delivererId } = req.body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order IDs array is required'
      });
    }

    // Récupérer le livreur
    let deliverer = null;
    if (delivererId) {
      deliverer = await User.findById(delivererId);
    }

    const results = [];
    const errors = [];

    // Traiter chaque commande
    for (const orderId of orderIds) {
      try {
        const order = await Order.findById(orderId);
        if (!order) {
          errors.push({ orderId, error: 'Order not found' });
          continue;
        }

        const updatedOrder = await updateOrderWithAdvancedFees(order, deliverer);
        results.push({
          orderId,
          success: true,
          order: updatedOrder
        });
      } catch (error) {
        errors.push({ orderId, error: error.message });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        processed: orderIds.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors
      },
      message: `Batch update completed: ${results.length} successful, ${errors.length} failed`
    });
  } catch (error) {
    console.error('Error in batch update:', error);
    res.status(500).json({
      success: false,
      message: 'Error in batch update',
      error: error.message
    });
  }
};

// @desc    Get advanced fees breakdown for existing orders
// @route   GET /api/advanced-fees/breakdown/:orderId
// @access  Private (admin)
exports.getAdvancedFeesBreakdown = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate('client', 'firstName lastName')
      .populate('provider', 'name')
      .populate('zone', 'number price promoPrice isPromoActive');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Si la commande a déjà des frais avancés, les retourner
    if (order.advancedFees) {
      return res.status(200).json({
        success: true,
        data: {
          order: {
            id: order._id,
            orderNumber: order.orderNumber,
            client: order.client,
            provider: order.provider,
            zone: order.zone,
            totalAmount: order.totalAmount,
            finalAmount: order.finalAmount,
            deliveryFee: order.deliveryFee,
            appFee: order.appFee,
            platformSolde: order.platformSolde
          },
          advancedFees: order.advancedFees,
          calculationBreakdown: order.calculationBreakdown
        }
      });
    }

    // Sinon, calculer les frais avancés à la volée
    const deliverer = order.deliveryDriver ? await User.findById(order.deliveryDriver) : null;
    const advancedFees = await calculateAdvancedFees(order, deliverer);

    res.status(200).json({
      success: true,
      data: {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          client: order.client,
          provider: order.provider,
          zone: order.zone,
          totalAmount: order.totalAmount,
          finalAmount: order.finalAmount,
          deliveryFee: order.deliveryFee,
          appFee: order.appFee,
          platformSolde: order.platformSolde
        },
        advancedFees,
        calculationBreakdown: order.calculationBreakdown
      }
    });
  } catch (error) {
    console.error('Error getting advanced fees breakdown:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting advanced fees breakdown',
      error: error.message
    });
  }
};

// @desc    Compare standard vs advanced calculation for an order
// @route   GET /api/advanced-fees/compare/:orderId
// @access  Private (admin)
exports.compareCalculations = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const deliverer = order.deliveryDriver ? await User.findById(order.deliveryDriver) : null;

    // Calcul standard (existant)
    const balanceCalc = require('../services/balanceCalculator');
    const standardResult = await balanceCalc.calculatePlatformSolde(order);

    // Calcul avancé (Zone 5)
    const advancedResult = await balanceCalc.calculateAdvancedPlatformSolde(order, deliverer);

    // Calculer les différences
    const difference = {
      platformSolde: advancedResult.platformSolde - standardResult.platformSolde,
      deliveryFee: (advancedResult.breakdown.advancedFees?.totalDeliveryFee || 0) - (order.deliveryFee || 0),
      appFee: (advancedResult.breakdown.advancedFees?.totalAppFee || 0) - (order.appFee || 0)
    };

    res.status(200).json({
      success: true,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        standard: {
          platformSolde: standardResult.platformSolde,
          deliveryFee: order.deliveryFee,
          appFee: order.appFee,
          breakdown: standardResult.breakdown
        },
        advanced: {
          platformSolde: advancedResult.platformSolde,
          deliveryFee: advancedResult.breakdown.advancedFees?.totalDeliveryFee || 0,
          appFee: advancedResult.breakdown.advancedFees?.totalAppFee || 0,
          breakdown: advancedResult.breakdown
        },
        difference,
        recommendation: Math.abs(difference.platformSolde) > 0.1 ? 'Use advanced calculation' : 'Standard calculation is sufficient'
      }
    });
  } catch (error) {
    console.error('Error comparing calculations:', error);
    res.status(500).json({
      success: false,
      message: 'Error comparing calculations',
      error: error.message
    });
  }
};
