import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import User from "../models/User.js";
import { sendNewOrderNotification } from "./pushNotificationService.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
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
export async function notifyNewOrder(order) {
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
    const deliverers = await User.find({ role: 'deliverer', pushToken: { $ne: '' } });
    const tokens = deliverers.map(d => d.pushToken).filter(token => token);
    
    if (tokens.length > 0) {
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

// Function to notify specific deliverer
export function notifyDeliverer(delivererId, message) {
  const socketId = activeDeliverers.get(delivererId);
  
  if (socketId) {
    io.to(`deliverer-${delivererId}`).emit("notification", message);
    console.log(`📢 Notification sent to deliverer ${delivererId}`);
    return true;
  } else {
    console.log(`⚠️ Deliverer ${delivererId} not connected, sending push notification`);
    // TODO: Implement push notification service
    return false;
  }
}

// Function to update order status for specific deliverer
export function updateOrderStatusForDeliverer(delivererId, orderUpdate) {
  io.to(`deliverer-${delivererId}`).emit("order-update", orderUpdate);
  console.log(`📢 Order update sent to deliverer ${delivererId}`);
}

// Function to get active deliverers count
export function getActiveDeliverersCount() {
  return activeDeliverers.size;
}

// Function to get all active deliverers
export function getActiveDeliverers() {
  return Array.from(activeDeliverers.keys());
}

export { io, server, app };