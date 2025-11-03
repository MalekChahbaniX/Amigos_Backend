const OptionGroup = require('../models/OptionGroup');
const Product = require('../models/Product');

// ➕ Créer un groupe d’options lié à un produit
exports.createOptionGroup = async (req, res) => {
  try {
    const { name, description, productId } = req.body;

    if (!name || !productId) {
      return res.status(400).json({ message: "Nom et produit requis" });
    }

    // Vérifie que le produit existe
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Produit non trouvé" });
    }

    // Crée le groupe
    const group = await OptionGroup.create({
      name,
      description,
      storeId: product.provider, // si provider = store
    });

    // L’associe au produit
    product.optionGroups = product.optionGroups || [];
    product.optionGroups.push(group._id);
    await product.save();

    res.status(201).json({
      message: "Groupe d’options créé avec succès",
      group,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📋 Tous les groupes (optionnellement filtrés par produit)
exports.getAllOptionGroups = async (req, res) => {
  try {
    const { product } = req.query;
    let query = {};

    if (product) {
      query = { _id: { $in: (await Product.findById(product)).optionGroups } };
    }

    const groups = await OptionGroup.find(query)
      .populate('options.option')
      .populate('options.subOptionGroup');

    res.json(groups);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔍 Groupe par ID
exports.getOptionGroupById = async (req, res) => {
  try {
    const group = await OptionGroup.findById(req.params.id)
      .populate('options.option')
      .populate('options.subOptionGroup');
    if (!group) return res.status(404).json({ message: 'Group not found' });
    res.json(group);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✏️ Modifier un groupe
exports.updateOptionGroup = async (req, res) => {
  try {
    const group = await OptionGroup.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!group) return res.status(404).json({ message: 'Group not found' });
    res.json(group);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ❌ Supprimer un groupe
exports.deleteOptionGroup = async (req, res) => {
  try {
    const group = await OptionGroup.findByIdAndDelete(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // Retirer la référence du produit
    await Product.updateMany(
      { optionGroups: group._id },
      { $pull: { optionGroups: group._id } }
    );

    res.json({ message: 'Groupe supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Ajouter un sous-groupe dans un groupe existant
exports.addSubOptionGroup = async (req, res) => {
  try {
    const { subGroupId } = req.body;
    const parentId = req.params.id;

    const parent = await OptionGroup.findById(parentId);
    const subGroup = await OptionGroup.findById(subGroupId);

    if (!parent || !subGroup) {
      return res.status(404).json({ message: 'Groupe ou sous-groupe introuvable' });
    }

    // Évite les doublons
    if (parent.options.some(o => o.subOptionGroup?.includes(subGroup._id))) {
      return res.status(400).json({ message: 'Sous-groupe déjà associé' });
    }

    // Ajout du sous-groupe
    parent.options.push({ subOptionGroup: [subGroup._id] });
    await parent.save();

    res.status(200).json({ message: 'Sous-groupe ajouté avec succès', parent });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Supprimer un sous-groupe d’un groupe
exports.removeSubOptionGroup = async (req, res) => {
  try {
    const { id, subId } = req.params;

    const group = await OptionGroup.findById(id);
    if (!group) return res.status(404).json({ message: 'Groupe introuvable' });

    group.options = group.options.filter(
      (opt) => !opt.subOptionGroup?.includes(subId)
    );
    await group.save();

    res.json({ message: 'Sous-groupe supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
