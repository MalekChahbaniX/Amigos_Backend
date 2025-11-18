// controllers/productOptionController.js (IMPROVED VERSION)
const ProductOption = require('../models/ProductOption');
const OptionGroup = require('../models/OptionGroup');

// Create product option
exports.createProductOption = async (req, res) => {
  try {
    const { name, price, groupId, storeId, image, availability, dineIn, delivery, takeaway } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Nom requis" });
    }

    const optionData = {
      name,
      price: price || 0,
      storeId,
      image,
      availability: availability !== undefined ? availability : true,
      dineIn: dineIn !== undefined ? dineIn : true,
      delivery: delivery !== undefined ? delivery : true,
      takeaway: takeaway !== undefined ? takeaway : true,
    };

    const option = await ProductOption.create(optionData);

    // If groupId provided, add to group
    if (groupId) {
      const group = await OptionGroup.findById(groupId);
      if (group) {
        group.options.push({
          option: option._id,
          name,
          price: price || 0,
          image
        });
        await group.save();

        option.optionGroups.push(group._id);
        await option.save();
      }
    }

    res.status(201).json({
      message: "Option créée avec succès",
      option,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all product options
exports.getAllProductOptions = async (req, res) => {
  try {
    const { storeId, availability } = req.query;
    let query = {};

    if (storeId) {
      query.storeId = storeId;
    }

    if (availability !== undefined) {
      query.availability = availability === 'true';
    }

    const options = await ProductOption.find(query)
      .populate('optionGroups')
      .sort({ createdAt: -1 });

    res.json(options);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get product option by ID
exports.getProductOptionById = async (req, res) => {
  try {
    const option = await ProductOption.findById(req.params.id)
      .populate('optionGroups');

    if (!option) {
      return res.status(404).json({ message: 'Option non trouvée' });
    }

    res.json(option);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update product option
exports.updateProductOption = async (req, res) => {
  try {
    const updateData = { ...req.body };

    const option = await ProductOption.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('optionGroups');

    if (!option) {
      return res.status(404).json({ message: 'Option non trouvée' });
    }

    // Update option in all groups
    await OptionGroup.updateMany(
      { 'options.option': option._id },
      {
        $set: {
          'options.$[elem].name': option.name,
          'options.$[elem].price': option.price,
          'options.$[elem].image': option.image
        }
      },
      { arrayFilters: [{ 'elem.option': option._id }] }
    );

    res.json({
      message: 'Option mise à jour avec succès',
      option
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete product option
exports.deleteProductOption = async (req, res) => {
  try {
    const option = await ProductOption.findByIdAndDelete(req.params.id);

    if (!option) {
      return res.status(404).json({ message: 'Option non trouvée' });
    }

    // Remove from all groups
    await OptionGroup.updateMany(
      {},
      { $pull: { options: { option: option._id } } }
    );

    res.json({ message: 'Option supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
