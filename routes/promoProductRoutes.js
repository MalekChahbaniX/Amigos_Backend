const express = require('express');
const router = express.Router();
const {
  getProductsByPromo,
  getProductsWithoutPromo,
  assignPromoToProduct,
  removePromoFromProduct,
  getProviderProducts
} = require('../controllers/promoProductController');

/**
 * @route   GET /api/promo-products/:promoId
 * @desc    Récupérer les produits liés à une promo (avec recherche + pagination)
 * @access  Private (SuperAdmin)
 */
router.get('/:promoId', getProductsByPromo);

/**
 * @route   GET /api/promo-products
 * @desc    Récupérer produits sans promotion (avec recherche + pagination)
 * @access  Private (SuperAdmin)
 */
router.get('/', getProductsWithoutPromo);

/**
 * @route   PUT /api/promo-products/:productId/assign
 * @desc    Assigner une promo à un produit
 * @access  Private (SuperAdmin)
 */
router.put('/:productId/assign', assignPromoToProduct);

/**
 * @route   PUT /api/promo-products/:productId/unassign
 * @desc    Retirer la promo d'un produit
 * @access  Private (SuperAdmin)
 */
router.put('/:productId/unassign', removePromoFromProduct);

/**
 * @route   GET /api/promo-products/providers/:providerId
 * @desc    Produits d'un prestataire avec ou sans promo (avec recherche + pagination)
 * @access  Private (SuperAdmin)
 */
router.get('/providers/:providerId', getProviderProducts);

module.exports = router;
