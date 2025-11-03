const express = require('express');
const cors = require('cors');
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

// Configuration CORS pour permettre les requêtes du frontend
const corsOptions = {
  origin: [
    'http://localhost:5173',  // Vite dev server
    'http://localhost:3000',  // Alternative port
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'https://amigos-dashboard-rrnj.onrender.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));

// Additional headers for CORS preflight
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Middleware pour parser le corps des requêtes en JSON
app.use(express.json());

// Routes
const authRoutes = require('./routes/authRoutes');
const providerRoutes = require('./routes/providerRoutes');
const orderRoutes = require('./routes/orderRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const clientsRoutes = require('./routes/clientsRoutes');
const deliverersRoutes = require('./routes/deliverersRoutes');
const productsRoutes = require('./routes/productsRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const zoneRoutes = require("./routes/zoneRoutes.js");
const cityRoutes = require('./routes/cityRoutes');
const promoRoutes = require('./routes/promoRoutes');
const promoProductRoutes = require('./routes/promoProductRoutes');
const appSettingRoutes = require('./routes/appSettingRoutes');
const optionGroupRoutes = require('./routes/optionGroupRoutes');
const productOptionRoutes = require('./routes/productOptionRoutes');

app.use('/api/app-settings', appSettingRoutes);
app.use('/api/promos', promoRoutes);
app.use('/api/promo-products', promoProductRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/search', providerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/deliverers', deliverersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/settings', settingsRoutes);
app.use("/api/zones", zoneRoutes);
app.use('/api/cities', cityRoutes);
app.use('/api/option-groups', optionGroupRoutes);
app.use('/api/product-options', productOptionRoutes);

// Route de base pour tester que le serveur fonctionne
app.get('/', (req, res) => {
  res.send('API is running...');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
