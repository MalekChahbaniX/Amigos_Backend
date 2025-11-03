const express = require('express');
const router = express.Router();
const {
  createProductOption,
  getAllProductOptions,
  getProductOptionById,
  updateProductOption,
  deleteProductOption,
} = require('../controllers/productOptionController');

router.post('/', createProductOption);
router.get('/', getAllProductOptions);
router.get('/:id', getProductOptionById);
router.put('/:id', updateProductOption);
router.delete('/:id', deleteProductOption);

module.exports = router;
