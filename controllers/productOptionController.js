const ProductOption = require('../models/ProductOption');
const OptionGroup = require('../models/OptionGroup');

// ➕ Créer une option et l’ajouter à un groupe
exports.createProductOption = async (req, res) => {
  try {
    const { name, price, groupId } = req.body;

    if (!name || !groupId) {
      return res.status(400).json({ message: "Nom et groupId requis" });
    }

    const group = await OptionGroup.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Groupe non trouvé" });
    }

    // Crée l’option
    const option = await ProductOption.create({
      name,
      price: price || 0,
      storeId: group.storeId,
    });

    // L’ajoute dans le groupe
    group.options.push({ option: option._id, name, price: price || 0 });
    await group.save();

    res.status(201).json({
      message: "Option ajoutée avec succès",
      option,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📋 Liste des options
exports.getAllProductOptions = async (req, res) => {
  try {
    const options = await ProductOption.find().populate('optionGroups');
    res.json(options);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔍 Option par ID
exports.getProductOptionById = async (req, res) => {
  try {
    const option = await ProductOption.findById(req.params.id).populate('optionGroups');
    if (!option) return res.status(404).json({ message: 'Option not found' });
    res.json(option);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✏️ Modifier une option
exports.updateProductOption = async (req, res) => {
  try {
    const option = await ProductOption.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!option) return res.status(404).json({ message: 'Option not found' });
    res.json(option);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ❌ Supprimer une option
exports.deleteProductOption = async (req, res) => {
  try {
    const option = await ProductOption.findByIdAndDelete(req.params.id);
    if (!option) return res.status(404).json({ message: 'Option non trouvée' });

    // Supprimer la référence dans tous les groupes
    await OptionGroup.updateMany(
      {},
      { $pull: { options: { option: option._id } } }
    );

    res.json({ message: 'Option supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
