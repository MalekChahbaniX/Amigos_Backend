const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const path = require('path');
const http = require('http');

// Initialize order grouping scheduler
const { startGroupingScheduler, stopGroupingScheduler } = require('./services/orderGroupingScheduler');

// Initialize ROOM timer service
const roomTimerService = require('./services/roomTimerService');

// Charger les variables d'environnement
dotenv.config();

// Valider les variables d'environnement requises
const validateEnvironmentVariables = () => {
  const requiredEnvVars = [
    'MONGO_URI',
    'JWT_SECRET',
    'FLOUCI_PUBLIC_KEY',
    'FLOUCI_PRIVATE_KEY',
    'FLOUCI_DEVELOPER_TRACKING_ID',
  ];

  const missing = requiredEnvVars.filter(varName => !process.env[varName] || process.env[varName].trim() === '');
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing);
    console.error('Please check your .env file and ensure all required variables are set.');
    process.exit(1);
  }
  
  console.log('✅ All required environment variables are set');
};

// Valider les variables d'environnement avant de continuer
validateEnvironmentVariables();

// Se connecter à la base de données
const connectDB = async () => {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000
    });
    console.log('✅ MongoDB connected successfully!');
    
    // Verify connection state
    if (mongoose.connection.readyState !== 1) {
      throw new Error('MongoDB connection state is not ready (readyState !== 1)');
    }
    console.log('✅ MongoDB connection verified');
  } catch (err) {
    console.error(`❌ Error connecting to MongoDB: ${err.message}`);
    process.exit(1);
  }
};

// Ajouter un gestionnaire pour les erreurs de connexion MongoDB après l'initialisation
mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error after initialization:', err.message);
  process.exit(1);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB disconnected unexpectedly');
});

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
    'http://192.168.1.104:5000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));

// Trust proxy headers (for HTTPS behind reverse proxy)
app.set('trust proxy', 1);

// Additional headers for CORS preflight
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
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
    origin: [
      'https://amigosdelivery25.com',
      'http://amigosdelivery25.com',
      'http://localhost:5173',  // Dashboard dev
      'http://localhost:3000',
      'http://192.168.1.104:5173',  // Dashboard dev (IP locale)
      'http://192.168.1.104:5000',
      'http://192.168.1.32:5000'
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
    allowEIO3: true  // Support pour Socket.IO v3
  },
  transports: ['websocket', 'polling'],  // Autoriser les deux transports
  pingTimeout: 60000,  // 60 secondes
  pingInterval: 25000,  // 25 secondes
  upgradeTimeout: 30000,  // 30 secondes
  maxHttpBufferSize: 1e8,  // 100 MB
  allowUpgrades: true
});

// Store active deliverers with their push tokens
const activeDeliverers = new Map();

// Store active admins
const activeAdmins = new Map();

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`🔌 New connection established`);
  console.log(`   Socket ID: ${socket.id}`);
  console.log(`   Transport: ${socket.conn.transport.name}`);
  console.log(`   Remote Address: ${socket.handshake.address}`);
  
  // Log sanitized headers only in debug mode
  if (process.env.DEBUG_WS_LOGS === 'true') {
    console.log(`   User-Agent: ${socket.handshake.headers['user-agent'] || 'N/A'}`);
    console.log(`   Origin: ${socket.handshake.headers.origin || 'N/A'}`);
    console.log(`   Full Headers:`, socket.handshake.headers);
    console.log(`   Query:`, socket.handshake.query);
  } else {
    // Production: only log non-sensitive info
    console.log(`   User-Agent: ${socket.handshake.headers['user-agent'] || 'N/A'}`);
    console.log(`   Origin: ${socket.handshake.headers.origin || 'N/A'}`);
  }

  // Logs de changement de transport
  socket.conn.on('upgrade', (transport) => {
    console.log(`🔄 Transport upgraded to: ${transport.name} for socket ${socket.id}`);
  });

  // Join deliverer to a room
  socket.on("join-deliverer", (delivererId) => {
    socket.join(`deliverer-${delivererId}`);
    activeDeliverers.set(delivererId, socket.id);
    console.log(`👤 Deliverer ${delivererId} joined room (Socket: ${socket.id})`);
    console.log(`   Active deliverers: ${activeDeliverers.size}`);
    
    // Send online status
    socket.emit("status", {
      status: "online",
      delivererId,
      timestamp: new Date().toISOString()
    });
  });

  // Join admin to a room
  socket.on("join-admin", (data) => {
    const { adminId } = data;
    socket.join(`admin-${adminId}`);
    activeAdmins.set(adminId, socket.id);
    console.log(`👤 Admin ${adminId} joined room (Socket: ${socket.id})`);
    console.log(`   Active admins: ${activeAdmins.size}`);
    
    socket.emit("status", {
      status: "online",
      adminId,
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
  socket.on("disconnect", (reason) => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
    console.log(`   Reason: ${reason}`);
    console.log(`   Transport: ${socket.conn.transport.name}`);
    
    // Remove from active deliverers
    for (const [delivererId, socketId] of activeDeliverers.entries()) {
      if (socketId === socket.id) {
        activeDeliverers.delete(delivererId);
        console.log(`👤 Deliverer ${delivererId} removed from active list`);
        console.log(`   Remaining active deliverers: ${activeDeliverers.size}`);
        break;
      }
    }

    // Remove from active admins
    for (const [adminId, socketId] of activeAdmins.entries()) {
      if (socketId === socket.id) {
        activeAdmins.delete(adminId);
        console.log(`👤 Admin ${adminId} removed from active list`);
        console.log(`   Remaining active admins: ${activeAdmins.size}`);
        break;
      }
    }
  });

  // Log errors
  socket.on('error', (error) => {
    console.error(`❌ Socket error for ${socket.id}:`, error);
  });
});

// Log global Socket.IO errors
io.engine.on("connection_error", (err) => {
  console.error('❌ Socket.IO connection error:');
  console.error(`   Code: ${err.code}`);
  console.error(`   Message: ${err.message}`);
  console.error(`   Context:`, err.context);
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
      name: order.provider ? order.provider.name : 
            (order.providers && order.providers.length > 0 ? order.providers[0].name : 'Unknown'),
      type: order.provider ? order.provider.type : 
            (order.providers && order.providers.length > 0 ? order.providers[0].type : 'unknown'),
      phone: order.provider ? order.provider.phone : 
            (order.providers && order.providers.length > 0 ? order.providers[0].phone : 'N/A'),
      address: order.provider ? order.provider.address : 
            (order.providers && order.providers.length > 0 ? order.providers[0].address : 'N/A')
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
    zone: order.zone,
    orderType: order.orderType || 'A1',
    isGrouped: !!order.isGrouped,
    groupSize: order.groupedOrders ? order.groupedOrders.length : 1,
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

// Function to notify admins immediately (separate from deliverer notifications)
async function notifyAdminsImmediate(order) {
  console.log(`📢 [IMMEDIATE] Notifying admins about new order: ${order._id}`);
  
  const orderNotification = {
    orderId: order._id,
    orderNumber: `CMD-${order._id.toString().slice(-6).toUpperCase()}`,
    client: {
      name: `${order.client.firstName} ${order.client.lastName}`,
      phone: order.client.phoneNumber,
      location: order.client.location
    },
    provider: {
      name: order.provider ? order.provider.name : 
            (order.providers && order.providers.length > 0 ? order.providers[0].name : 'Unknown'),
      type: order.provider ? order.provider.type : 
            (order.providers && order.providers.length > 0 ? order.providers[0].type : 'unknown'),
      phone: order.provider ? order.provider.phone : 
            (order.providers && order.providers.length > 0 ? order.providers[0].phone : 'N/A'),
      address: order.provider ? order.provider.address : 
            (order.providers && order.providers.length > 0 ? order.providers[0].address : 'N/A')
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
    zone: order.zone,
    status: order.status,
    orderType: order.orderType,
    isUrgent: order.isUrgent
  };

  // Send to all connected admins via WebSocket
  io.emit("new-order-admin", orderNotification);
  console.log(`📢 [IMMEDIATE] Sent WebSocket notification to ${activeAdmins.size} active admins`);
  
  return {
    success: true,
    notifiedAdmins: activeAdmins.size,
    order: orderNotification
  };
}

// Make functions available globally
global.notifyNewOrder = notifyNewOrder;
global.notifyAdminsImmediate = notifyAdminsImmediate;
global.activeDeliverers = activeDeliverers;
global.activeAdmins = activeAdmins;

// Map to store auto-cancellation timers: orderId -> timeoutId
global.orderCancellationTimers = new Map();

// Function to schedule auto-cancellation for pending orders
global.scheduleOrderAutoCancellation = function(orderId, delayMs = 600000) {
  // Clear existing timer if any
  if (global.orderCancellationTimers.has(orderId)) {
    clearTimeout(global.orderCancellationTimers.get(orderId));
  }
  
  const timerId = setTimeout(async () => {
    try {
      const Order = require('./models/Order');
      const Cancellation = require('./models/Cancellation');
      const order = await Order.findById(orderId);
      
      if (!order) {
        console.log(`⚠️ Order ${orderId} not found for auto-cancellation`);
        return;
      }
      
      // Only cancel if still pending
      if (order.status === 'pending') {
        // Dedicated auto-cancel path that bypasses the 1-minute guard
        const now = new Date();
        order.status = 'cancelled';
        order.cancellationType = 'ANNULER_1';
        order.cancelledAt = now;
        order.autoCancelledAt = now;
        order.autoCancel = true;
        order.cancellationReason = 'Auto-annulation: aucun livreur n\'a accepté dans les 20 minutes';
        
        await order.save();
        
        // Create cancellation record for audit trail
        try {
          const cancellation = new Cancellation({
            order: order._id,
            type: 'ANNULER_1',
            mode: 'SYSTEM_AUTO',
            solde: order.platformSolde || 0,
            reason: order.cancellationReason
          });
          await cancellation.save();
          console.log(`📋 Cancellation record created for order ${orderId}`);
        } catch (recordError) {
          console.error(`⚠️ Failed to create cancellation record for order ${orderId}:`, recordError);
        }
        
        console.log(`⏰ Order ${orderId} auto-cancelled after 20 minutes`);
      }
      
      // Remove timer from map
      global.orderCancellationTimers.delete(orderId);
    } catch (error) {
      console.error(`❌ Error auto-cancelling order ${orderId}:`, error);
    }
  }, delayMs);
  
  global.orderCancellationTimers.set(orderId, timerId);
  console.log(`⏰ Auto-cancellation scheduled for order ${orderId} in ${delayMs/1000}s`);
};

// Function to cancel scheduled auto-cancellation
global.cancelOrderAutoCancellation = function(orderId) {
  if (global.orderCancellationTimers.has(orderId)) {
    clearTimeout(global.orderCancellationTimers.get(orderId));
    global.orderCancellationTimers.delete(orderId);
    console.log(`✅ Auto-cancellation cancelled for order ${orderId}`);
    return true;
  }
  return false;
};

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
// NOUVEAUX: Routes pour marges et frais additionnels
const marginSettingsRoutes = require('./routes/marginSettingsRoutes');
const additionalFeesRoutes = require('./routes/additionalFeesRoutes');
// NOUVEAU: Routes pour les frais avancés (Zone 5)
const advancedFeeRoutes = require('./routes/advancedFeeRoutes');

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
// NOUVEAUX: Routes pour marges et frais additionnels
app.use('/api/margin-settings', marginSettingsRoutes);
app.use('/api/additional-fees', additionalFeesRoutes);
// NOUVEAU: Routes pour les frais avancés (Zone 5)
app.use('/api/advanced-fees', advancedFeeRoutes);

// Middleware d'erreur global pour transformer toutes les erreurs en JSON
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  
  // Si l'erreur est une réponse HTML (404, 500, etc.)
  if (res.headersSent) {
    return next(err);
  }
  
  // Toujours retourner du JSON pour les erreurs API
  res.status(500).json({
    success: false,
    message: err.message || 'Erreur serveur interne',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Route de base pour tester que le serveur fonctionne
app.get('/', (req, res) => {
  res.send('API is running...');
});

const PORT = process.env.PORT || 5000;

// Fonction IIFE pour gérer l'initialisation asynchrone
(async () => {
  try {
    // Attendre la connexion MongoDB
    await connectDB();
    
    // Vérifier l'état de la connexion
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Failed to establish MongoDB connection');
    }
    
    // Démarrer le serveur HTTP
    server.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`🔌 Socket.IO server listening for real-time notifications`);
      
      // Démarrer le scheduler de regroupement de commandes après le démarrage du serveur
      try {
        startGroupingScheduler();
        console.log('✅ Order grouping scheduler started successfully');
      } catch (schedulerError) {
        console.error('❌ Error starting order grouping scheduler:', schedulerError.message);
        // Le serveur continue à fonctionner même si le scheduler échoue
      }
      
      // Démarrer le service ROOM timer
      try {
        roomTimerService.start();
        console.log('🔥 ROOM timer service started successfully');
      } catch (roomError) {
        console.error('❌ Error starting ROOM timer service:', roomError.message);
        // Le serveur continue à fonctionner même si le service ROOM échoue
      }
    });
  } catch (initError) {
    console.error('❌ Fatal error during server initialization:', initError.message);
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⏸️ SIGTERM signal received: closing HTTP server');
  stopGroupingScheduler();
  roomTimerService.stop();
  
  // Clear all pending auto-cancellation timers
  if (global.orderCancellationTimers) {
    for (const [orderId, timerId] of global.orderCancellationTimers.entries()) {
      clearTimeout(timerId);
    }
    global.orderCancellationTimers.clear();
    console.log('🧹 Cleared all auto-cancellation timers');
  }
  
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
  roomTimerService.stop();
  
  // Clear all pending auto-cancellation timers
  if (global.orderCancellationTimers) {
    for (const [orderId, timerId] of global.orderCancellationTimers.entries()) {
      clearTimeout(timerId);
    }
    global.orderCancellationTimers.clear();
    console.log('🧹 Cleared all auto-cancellation timers');
  }
  
  server.close(() => {
    console.log('❌ HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('❌ MongoDB connection closed');
      process.exit(0);
    });
  });
});
