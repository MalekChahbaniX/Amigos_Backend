// controllers/optionGroupController.js (IMPROVED VERSION)
const OptionGroup = require('../models/OptionGroup');
const Product = require('../models/Product');

// Create option group
exports.createOptionGroup = async (req, res) => {
  try {
    const { name, description, min, max, productId, storeId, image } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Nom requis" });
    }

    const groupData = {
      name,
      description,
      min: min || 0,
      max: max || 1,
      storeId,
      image
    };

    const group = await OptionGroup.create(groupData);

    // If productId provided, link to product
    if (productId) {
      const product = await Product.findById(productId);
      if (product) {
        product.optionGroups = product.optionGroups || [];
        product.optionGroups.push(group._id);
        await product.save();
      }
    }

    res.status(201).json({
      message: "Groupe d'options créé avec succès",
      group,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all option groups
exports.getAllOptionGroups = async (req, res) => {
  try {
    const { product, storeId } = req.query;
    let query = {};

    if (storeId) {
      query.storeId = storeId;
    }

    if (product) {
      const productDoc = await Product.findById(product);
      if (productDoc) {
        query = { _id: { $in: productDoc.optionGroups } };
      }
    }

    const groups = await OptionGroup.find(query)
      .populate('options.option')
      .sort({ createdAt: -1 });

    res.json(groups);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get option group by ID
exports.getOptionGroupById = async (req, res) => {
  try {
    const group = await OptionGroup.findById(req.params.id)
      .populate('options.option');

    if (!group) {
      return res.status(404).json({ message: 'Groupe non trouvé' });
    }

    res.json(group);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update option group
exports.updateOptionGroup = async (req, res) => {
  try {
    const { name, description, min, max, image } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (min !== undefined) updateData.min = min;
    if (max !== undefined) updateData.max = max;
    if (image !== undefined) updateData.image = image;

    const group = await OptionGroup.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('options.option');

    if (!group) {
      return res.status(404).json({ message: 'Groupe non trouvé' });
    }

    res.json({
      message: 'Groupe mis à jour avec succès',
      group
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete option group
exports.deleteOptionGroup = async (req, res) => {
  try {
    const group = await OptionGroup.findByIdAndDelete(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Groupe non trouvé' });
    }

    // Remove references from products
    await Product.updateMany(
      { optionGroups: group._id },
      { $pull: { optionGroups: group._id } }
    );

    res.json({ message: 'Groupe supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add option to group
exports.addOptionToGroup = async (req, res) => {
  try {
    const { optionId, name, price, image } = req.body;
    const groupId = req.params.id;

    const group = await OptionGroup.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Groupe non trouvé' });
    }

    group.options.push({
      option: optionId,
      name,
      price: price || 0,
      image
    });

    await group.save();
    await group.populate('options.option');

    res.json({
      message: 'Option ajoutée avec succès',
      group
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Remove option from group
exports.removeOptionFromGroup = async (req, res) => {
  try {
    const { groupId, optionId } = req.params;

    const group = await OptionGroup.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Groupe non trouvé' });
    }

    group.options = group.options.filter(
      opt => opt.option.toString() !== optionId
    );

    await group.save();

    res.json({ message: 'Option retirée avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
