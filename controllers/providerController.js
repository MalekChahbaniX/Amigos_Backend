const Provider = require('../models/Provider');
const Product = require('../models/Product');

// @desc    Get all providers
// @route   GET /api/providers
// @access  Public
exports.getProviders = async (req, res) => {
  try {
    const providers = await Provider.find({});
    res.json(providers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get a single provider and its menu
// @route   GET /api/providers/:id
// @access  Public
exports.getProviderById = async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.id);
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found' });
    }
    const menu = await Product.find({ provider: req.params.id });
    res.json({ provider, menu });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get providers by type
// @route   GET /api/providers/type/:type
// @access  Public
exports.getProvidersByType = async (req, res) => {
  try {
    const providers = await Provider.find({ type: req.params.type });
    res.json(providers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get products for a specific provider
// @route   GET /api/products/:providerId
// @access  Public
exports.getProductsByProviderId = async (req, res) => {
  try {
    const products = await Product.find({ provider: req.params.providerId });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Search for providers or products
// @route   GET /api/search?q=...
// @access  Public
exports.search = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    const providers = await Provider.find({ name: { $regex: q, $options: 'i' } });
    const products = await Product.find({ name: { $regex: q, $options: 'i' } });
    res.json({ providers, products });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};