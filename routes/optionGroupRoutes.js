const express = require('express');
const router = express.Router();
const {
  createOptionGroup,
  getAllOptionGroups,
  getOptionGroupById,
  updateOptionGroup,
  deleteOptionGroup,
  addSubOptionGroup,
  removeSubOptionGroup
} = require('../controllers/optionGroupController');

router.post('/', createOptionGroup);
router.get('/', getAllOptionGroups);
router.get('/:id', getOptionGroupById);
router.put('/:id', updateOptionGroup);
router.delete('/:id', deleteOptionGroup);
router.post('/:id/sub-option-groups', addSubOptionGroup);
router.delete('/:id/sub-option-groups/:subGroupId', removeSubOptionGroup);

module.exports = router;
