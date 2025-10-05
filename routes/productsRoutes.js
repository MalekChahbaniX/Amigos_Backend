const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsByProvider,
} = require('../controllers/productsController');

// All product routes require authentication
// You can add middleware here to verify JWT token and super admin role

router.get('/', getProducts);
router.get('/:id', getProductById);
router.get('/provider/:providerId', getProductsByProvider);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;