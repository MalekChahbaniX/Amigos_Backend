const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Charger les variables d'environnement
dotenv.config();

// Se connecter à la base de données
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully!');
  } catch (err) {
    console.error(`Error connecting to MongoDB: ${err.message}`);
    process.exit(1);
  }
};

connectDB();

const app = express();

// Middleware pour parser le corps des requêtes en JSON
app.use(express.json());

// Routes
const authRoutes = require('./routes/authRoutes');
const providerRoutes = require('./routes/providerRoutes');
const orderRoutes = require('./routes/orderRoutes');
const transactionRoutes = require('./routes/transactionRoutes'); // <-- AJOUTEZ CETTE LIGNE

app.use('/api/auth', authRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/search', providerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/transactions', transactionRoutes); // <-- AJOUTEZ CETTE LIGNE

// Route de base pour tester que le serveur fonctionne
app.get('/', (req, res) => {
  res.send('API is running...');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
