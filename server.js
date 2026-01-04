const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const path = require('path');
const http = require('http');

// Initialize order grouping scheduler
const { startGroupingScheduler, stopGroupingScheduler } = require('./services/orderGroupingScheduler');

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
    'http://amigosdelivery25.com',
    'https://amigosdelivery25.com',
    'http://localhost:5173',  // Vite dev server
    'http://localhost:3000',  // Alternative port
    'http://localhost:8081',  // React Native Metro bundler
    'http://192.168.1.104:8081',  // React Native Metro bundler
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8081', // React Native
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));

// Trust proxy headers (for HTTPS behind reverse proxy)
app.set('trust proxy', 1);

// Additional headers for CORS preflight
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Middleware pour parser le corps des requêtes en JSON
// Increase limit to handle large payloads (default is 100kb)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Middleware pour servir les fichiers statiques (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Create HTTP server for Socket.IO
const server = http.createServer(app);

// Initialize Socket.IO for real-time notifications
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Store active deliverers with their push tokens
const activeDeliverers = new Map();

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`🔌 Deliverer connected: ${socket.id}`);

  // Join deliverer to a room
  socket.on("join-deliverer", (delivererId) => {
    socket.join(`deliverer-${delivererId}`);
    activeDeliverers.set(delivererId, socket.id);
    console.log(`👤 Deliverer ${delivererId} joined room`);
    
    // Send online status
    socket.emit("status", {
      status: "online",
      delivererId,
      timestamp: new Date().toISOString()
    });
  });

  // Handle order acceptance
  socket.on("accept-order", (data) => {
    const { orderId, delivererId } = data;
    console.log(`✅ Deliverer ${delivererId} attempting to accept order ${orderId}`);
    
    // Emit to all deliverers that this order is being processed
    io.emit("order-accepted", {
      orderId,
      delivererId,
      timestamp: new Date().toISOString()
    });
  });

  // Handle order rejection
  socket.on("reject-order", (data) => {
    const { orderId, delivererId } = data;
    console.log(`❌ Deliverer ${delivererId} rejected order ${orderId}`);
    
    // Make order available again
    io.emit("order-rejected", {
      orderId,
      delivererId,
      timestamp: new Date().toISOString()
    });
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log(`🔌 Deliverer disconnected: ${socket.id}`);
    
    // Remove from active deliverers
    for (const [delivererId, socketId] of activeDeliverers.entries()) {
      if (socketId === socket.id) {
        activeDeliverers.delete(delivererId);
        console.log(`👤 Deliverer ${delivererId} removed from active list`);
        break;
      }
    }
  });
});

// Function to notify all active deliverers about new order
async function notifyNewOrder(order) {
  console.log(`📢 Notifying deliverers about new order: ${order._id}`);
  
  const orderNotification = {
    orderId: order._id,
    orderNumber: `CMD-${order._id.toString().slice(-6).toUpperCase()}`,
    client: {
      name: `${order.client.firstName} ${order.client.lastName}`,
      phone: order.client.phoneNumber,
      location: order.client.location
    },
    provider: {
      name: order.provider.name,
      type: order.provider.type,
      phone: order.provider.phone,
      address: order.provider.address
    },
    items: order.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price
    })),
    total: order.totalAmount,
    solde: order.platformSolde,
    deliveryAddress: order.deliveryAddress,
    paymentMethod: order.paymentMethod,
    finalAmount: order.finalAmount,
    createdAt: order.createdAt,
    platformSolde: order.platformSolde,
    distance: order.distance,
    zone: order.zone
  };

  // Send to all connected deliverers via WebSocket
  io.emit("new-order", orderNotification);
  
  console.log(`📢 Sent WebSocket notification to ${activeDeliverers.size} active deliverers`);
  
  // Send push notifications to all deliverers (including offline ones)
  try {
    const User = require('./models/User');
    const deliverers = await User.find({ role: 'deliverer', pushToken: { $ne: '' } });
    const tokens = deliverers.map(d => d.pushToken).filter(token => token);
    
    if (tokens.length > 0) {
      const { sendNewOrderNotification } = require('./services/pushNotificationService');
      const pushResult = await sendNewOrderNotification(tokens, orderNotification);
      console.log(`📢 Sent push notification to ${pushResult.summary.total} deliverers`);
    }
  } catch (error) {
    console.error('❌ Failed to send push notifications:', error);
  }
  
  return {
    success: true,
    notifiedDeliverers: activeDeliverers.size,
    order: orderNotification
  };
}

// Make functions available globally
global.notifyNewOrder = notifyNewOrder;
global.activeDeliverers = activeDeliverers;

// Routes
const authRoutes = require('./routes/authRoutes');
const providerRoutes = require('./routes/providerRoutes');
const orderRoutes = require('./routes/orderRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const clientsRoutes = require('./routes/clientsRoutes');
const deliverersRoutes = require('./routes/deliverersRoutes');
const delivererRoutes = require('./routes/delivererRoutes');
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
const paymentRoutes = require('./routes/paymentRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

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
app.use('/api/deliverer', delivererRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use("/api/zones", zoneRoutes);
app.use('/api/cities', cityRoutes);
app.use('/api/option-groups', optionGroupRoutes);
app.use('/api/product-options', productOptionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/upload', uploadRoutes);

// Route de base pour tester que le serveur fonctionne
app.get('/', (req, res) => {
  res.send('API is running...');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Socket.IO server listening for real-time notifications`);
  
  // Start the order grouping scheduler
  startGroupingScheduler();
  console.log('✅ Order grouping scheduler started');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⏸️ SIGTERM signal received: closing HTTP server');
  stopGroupingScheduler();
  server.close(() => {
    console.log('❌ HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('❌ MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', async () => {
  console.log('⏸️ SIGINT signal received: closing HTTP server');
  stopGroupingScheduler();
  server.close(() => {
    console.log('❌ HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('❌ MongoDB connection closed');
      process.exit(0);
    });
  });
});
