const express = require('express');
const router = express.Router();
const {
  createOptionGroup,
  getAllOptionGroups,
  getOptionGroupById,
  updateOptionGroup,
  deleteOptionGroup,
} = require('../controllers/optionGroupController');

router.post('/', createOptionGroup);
router.get('/', getAllOptionGroups);
router.get('/:id', getOptionGroupById);
router.put('/:id', updateOptionGroup);
router.delete('/:id', deleteOptionGroup);

module.exports = router;
