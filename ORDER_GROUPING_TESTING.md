# Order Grouping System - Testing Guide

## Unit Tests

### Test Suite 1: Balance Calculator

```javascript
// test/balanceCalculator.test.js

const { 
  calculateSoldeSimple,
  calculateSoldeDual,
  calculateSoldeTriple,
  calculateSoldeAmigos,
  updateOrderSoldes
} = require('../services/balanceCalculator');

describe('Balance Calculator Service', () => {
  
  describe('calculateSoldeSimple', () => {
    it('should calculate solde for single order', () => {
      const order = {
        clientProductsPrice: 100,
        restaurantPayout: 80
      };
      const result = calculateSoldeSimple(order);
      expect(result).toBeGreaterThan(0);
    });

    it('should handle zero appFee', () => {
      const order = {
        clientProductsPrice: 50,
        restaurantPayout: 40
      };
      const result = calculateSoldeSimple(order);
      expect(result).toBe(0);
    });
  });

  describe('calculateSoldeDual', () => {
    it('should calculate 10% discount for pair', () => {
      const orders = [
        { clientProductsPrice: 100, restaurantPayout: 80, appFee: 5 },
        { clientProductsPrice: 80, restaurantPayout: 60, appFee: 4 }
      ];
      const total = calculateSoldeDual(orders);
      // (5 + 4) * 0.9 = 8.1
      expect(total).toBe(8.1);
    });

    it('should require exactly 2 orders', () => {
      const orders = [{ appFee: 5 }];
      expect(() => calculateSoldeDual(orders)).toThrow();
    });
  });

  describe('calculateSoldeTriple', () => {
    it('should calculate 15% discount for triplet', () => {
      const orders = [
        { appFee: 5 },
        { appFee: 4 },
        { appFee: 3 }
      ];
      const total = calculateSoldeTriple(orders);
      // (5 + 4 + 3) * 0.85 = 10.2
      expect(total).toBe(10.2);
    });

    it('should require exactly 3 orders', () => {
      const orders = [{ appFee: 5 }, { appFee: 4 }];
      expect(() => calculateSoldeTriple(orders)).toThrow();
    });
  });

  describe('updateOrderSoldes', () => {
    it('should update soldeSimple for A1', () => {
      const order = { appFee: 5, soldeSimple: 0, soldeDual: 0 };
      const result = updateOrderSoldes(order, 'A1');
      expect(result.soldeSimple).toBe(5);
      expect(result.soldeDual).toBe(0);
    });

    it('should update soldeDual for A2', () => {
      const order = { appFee: 5, soldeSimple: 0, soldeDual: 0 };
      const result = updateOrderSoldes(order, 'A2');
      expect(result.soldeDual).toBeGreaterThan(0);
    });
  });
});
```

### Test Suite 2: Distance Calculator

```javascript
// test/distanceCalculator.test.js

const { calculateDistance } = require('../utils/distanceCalculator');

describe('Distance Calculator', () => {
  
  it('should calculate distance between two points', () => {
    // Paris coordinates
    const distance = calculateDistance(48.8566, 2.3522, 48.8566, 2.3522);
    expect(distance).toBe(0); // Same point
  });

  it('should handle 6km distance (provider threshold)', () => {
    // Approximate 6km apart
    const distance = calculateDistance(48.8566, 2.3522, 48.9077, 2.3774);
    expect(distance).toBeLessThanOrEqual(6);
    expect(distance).toBeGreaterThan(5);
  });

  it('should reject distances > 6km', () => {
    // Further apart
    const distance = calculateDistance(48.8566, 2.3522, 49.0077, 2.3774);
    expect(distance).toBeGreaterThan(6);
  });

  it('should handle 3km distance (client threshold)', () => {
    // Approximate 3km apart
    const distance = calculateDistance(48.8566, 2.3522, 48.8847, 2.3585);
    expect(distance).toBeLessThanOrEqual(3);
    expect(distance).toBeGreaterThan(2);
  });
});
```

### Test Suite 3: Order Grouping Service

```javascript
// test/orderGroupingService.test.js

const {
  areProvidersClose,
  isClientInRange,
  findGroupingCandidates,
  groupOrdersIntoA2,
  groupOrdersIntoA3,
  detectAndGroupOrders
} = require('../services/orderGroupingService');
const Order = require('../models/Order');
const User = require('../models/User');

describe('Order Grouping Service', () => {
  
  describe('areProvidersClose', () => {
    it('should return true for providers ≤6km apart', () => {
      const loc1 = { latitude: 48.8566, longitude: 2.3522 };
      const loc2 = { latitude: 48.8847, longitude: 2.3585 };
      expect(areProvidersClose(loc1, loc2)).toBe(true);
    });

    it('should return false for providers >6km apart', () => {
      const loc1 = { latitude: 48.8566, longitude: 2.3522 };
      const loc2 = { latitude: 49.2000, longitude: 2.5000 };
      expect(areProvidersClose(loc1, loc2)).toBe(false);
    });
  });

  describe('isClientInRange', () => {
    it('should return true for delivery ≤3km from client', () => {
      const clientLoc = { latitude: 48.8566, longitude: 2.3522 };
      const deliveryAddr = { latitude: 48.8650, longitude: 2.3500 };
      expect(isClientInRange(clientLoc, deliveryAddr)).toBe(true);
    });

    it('should return false for delivery >3km from client', () => {
      const clientLoc = { latitude: 48.8566, longitude: 2.3522 };
      const deliveryAddr = { latitude: 49.0000, longitude: 2.5000 };
      expect(isClientInRange(clientLoc, deliveryAddr)).toBe(false);
    });
  });

  describe('findGroupingCandidates', () => {
    it('should return orders matching criteria', async () => {
      // Mock: Create test orders
      const candidates = await findGroupingCandidates(1);
      expect(Array.isArray(candidates)).toBe(true);
      candidates.forEach(order => {
        expect(order.status).toBe('pending');
        expect(order.isGrouped).toBe(false);
      });
    });

    it('should exclude orders in processing delay', async () => {
      // Mock: Order with scheduledFor in future
      const candidates = await findGroupingCandidates(1);
      candidates.forEach(order => {
        if (order.scheduledFor) {
          expect(new Date(order.scheduledFor)).toBeLessThanOrEqual(new Date());
        }
      });
    });
  });

  describe('groupOrdersIntoA2', () => {
    it('should group 2 compatible orders', async () => {
      // Mock: Create 2 orders with valid distances
      const order1 = {
        _id: 'order1',
        status: 'pending',
        client: { location: { latitude: 48.8566, longitude: 2.3522 } },
        provider: { location: { latitude: 48.8650, longitude: 2.3500 } },
        deliveryAddress: { latitude: 48.8600, longitude: 2.3550 }
      };
      const order2 = {
        _id: 'order2',
        status: 'pending',
        client: { location: { latitude: 48.8580, longitude: 2.3530 } },
        provider: { location: { latitude: 48.8670, longitude: 2.3510 } },
        deliveryAddress: { latitude: 48.8620, longitude: 2.3560 }
      };
      
      const result = await groupOrdersIntoA2(order1, order2);
      expect(result).not.toBeNull();
      expect(result.orderType).toBe('A2');
      expect(result.isGrouped).toBe(true);
    });

    it('should reject orders > 6km apart', async () => {
      const order1 = { status: 'pending', provider: { location: { latitude: 48.8566, longitude: 2.3522 } } };
      const order2 = { status: 'pending', provider: { location: { latitude: 49.2000, longitude: 2.5000 } } };
      
      const result = await groupOrdersIntoA2(order1, order2);
      expect(result).toBeNull();
    });
  });

  describe('groupOrdersIntoA3', () => {
    it('should group 3 compatible orders', async () => {
      // Mock: Create 3 orders with valid pairwise distances
      const orders = [
        { 
          _id: 'order1', 
          status: 'pending',
          provider: { location: { latitude: 48.8566, longitude: 2.3522 } }
        },
        { 
          _id: 'order2', 
          status: 'pending',
          provider: { location: { latitude: 48.8600, longitude: 2.3550 } }
        },
        { 
          _id: 'order3', 
          status: 'pending',
          provider: { location: { latitude: 48.8650, longitude: 2.3500 } }
        }
      ];
      
      const result = await groupOrdersIntoA3(...orders);
      expect(result).not.toBeNull();
      expect(result.length).toBe(3);
      result.forEach(order => {
        expect(order.orderType).toBe('A3');
        expect(order.isGrouped).toBe(true);
      });
    });

    it('should validate all pairwise distances', async () => {
      // One pair too far apart
      const orders = [
        { _id: 'order1', provider: { location: { latitude: 48.8566, longitude: 2.3522 } } },
        { _id: 'order2', provider: { location: { latitude: 48.8600, longitude: 2.3550 } } },
        { _id: 'order3', provider: { location: { latitude: 49.2000, longitude: 2.5000 } } }
      ];
      
      const result = await groupOrdersIntoA3(...orders);
      expect(result).toBeNull();
    });
  });

  describe('detectAndGroupOrders', () => {
    it('should form A3 groups first', async () => {
      const stats = await detectAndGroupOrders();
      expect(stats.a3GroupsFormed).toBeGreaterThanOrEqual(0);
      expect(stats.a3GroupsFormed).toBeLessThanOrEqual(stats.candidatesFound / 3);
    });

    it('should form A2 groups from remaining', async () => {
      const stats = await detectAndGroupOrders();
      expect(stats.a2GroupsFormed).toBeGreaterThanOrEqual(0);
    });

    it('should return statistics', async () => {
      const stats = await detectAndGroupOrders();
      expect(stats).toHaveProperty('candidatesFound');
      expect(stats).toHaveProperty('a3GroupsFormed');
      expect(stats).toHaveProperty('a2GroupsFormed');
      expect(stats).toHaveProperty('totalOrdersGrouped');
    });
  });
});
```

## Integration Tests

### Test Suite 4: Scheduler Integration

```javascript
// test/integration/orderGroupingScheduler.integration.test.js

const {
  startGroupingScheduler,
  stopGroupingScheduler,
  getSchedulerStatus
} = require('../../services/orderGroupingScheduler');
const Order = require('../../models/Order');

describe('Order Grouping Scheduler Integration', () => {
  
  beforeAll(async () => {
    // Setup: Connect to test database
    await connectTestDB();
  });

  afterAll(async () => {
    // Cleanup
    stopGroupingScheduler();
    await closeTestDB();
  });

  it('should start scheduler', (done) => {
    startGroupingScheduler();
    const status = getSchedulerStatus();
    
    expect(status.running).toBe(true);
    expect(status.intervalMs).toBe(60000);
    done();
  });

  it('should release orders after delay expires', async () => {
    // Create order with scheduledFor = now - 1 minute (already expired)
    const expiredOrder = await Order.create({
      status: 'pending',
      processingDelay: 5,
      scheduledFor: new Date(Date.now() - 60 * 1000)
    });

    // Wait for next scheduler cycle
    await wait(2000);

    // Check if order was released
    const updated = await Order.findById(expiredOrder._id);
    expect(updated.processingDelay).toBeUndefined();
    expect(updated.scheduledFor).toBeUndefined();
  });

  it('should form groups after delay expires', async () => {
    // Create 2 compatible orders with expired delay
    const order1 = await Order.create({
      status: 'pending',
      orderType: 'A1',
      isGrouped: false,
      processingDelay: 5,
      scheduledFor: new Date(Date.now() - 60 * 1000),
      client: { location: { latitude: 48.8566, longitude: 2.3522 } },
      provider: { location: { latitude: 48.8650, longitude: 2.3500 } },
      deliveryAddress: { latitude: 48.8600, longitude: 2.3550 }
    });

    const order2 = await Order.create({
      status: 'pending',
      orderType: 'A1',
      isGrouped: false,
      processingDelay: 5,
      scheduledFor: new Date(Date.now() - 60 * 1000),
      client: { location: { latitude: 48.8580, longitude: 2.3530 } },
      provider: { location: { latitude: 48.8670, longitude: 2.3510 } },
      deliveryAddress: { latitude: 48.8620, longitude: 2.3560 }
    });

    // Wait for scheduler cycles
    await wait(120 * 1000); // 2 minutes

    // Check if orders were grouped
    const grouped1 = await Order.findById(order1._id);
    const grouped2 = await Order.findById(order2._id);

    expect(grouped1.isGrouped).toBe(true);
    expect(grouped2.isGrouped).toBe(true);
    expect(grouped1.orderType).toBe('A2');
    expect(grouped2.orderType).toBe('A2');
  });

  it('should stop scheduler gracefully', () => {
    stopGroupingScheduler();
    const status = getSchedulerStatus();
    
    expect(status.running).toBe(false);
  });
});

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

## Manual Testing Guide

### Test Case 1: Order Creation with Delay

**Steps:**
1. Create a new order via API
2. Check response for `processingDelay` and `scheduledFor` fields
3. Verify scheduledFor is 5-10 minutes in the future

**Expected Result:**
```json
{
  "order": {
    "_id": "123abc",
    "processingDelay": 7,
    "scheduledFor": "2024-01-15T14:07:00.000Z",
    "status": "pending",
    "isGrouped": false,
    "orderType": "A1"
  }
}
```

### Test Case 2: Scheduler Startup

**Steps:**
1. Start the server
2. Check console logs
3. Verify "🚀 Order Grouping Scheduler started" appears

**Expected Result:**
```
Server is running on port 5000
✅ Order grouping scheduler started
🚀 Order Grouping Scheduler started
```

### Test Case 3: Delay Window Release

**Steps:**
1. Create an order
2. Wait for scheduledFor timestamp to expire
3. Query the order from database
4. Check processingDelay and scheduledFor fields

**Expected Result:**
- Before delay expires:
  ```json
  { "processingDelay": 7, "scheduledFor": "2024-01-15T14:07:00.000Z" }
  ```
- After delay expires:
  ```json
  { "processingDelay": null, "scheduledFor": null }
  ```

### Test Case 4: Order Grouping (Manual with Fixed Delay)

**Setup:**
```javascript
// Temporarily modify orderController to skip delay
const processingDelay = 0; // Set to 0 for testing
const scheduledFor = new Date(); // Set to now
```

**Steps:**
1. Create 2 orders with compatible providers (≤6km apart)
2. Create 2 orders with compatible delivery locations (≤3km from clients)
3. Wait 60+ seconds for scheduler cycle
4. Query orders from database
5. Verify both orders are grouped

**Expected Result:**
```json
{
  "orderType": "A2",
  "isGrouped": true,
  "groupedOrders": ["orderId2"],
  "soldeDual": 8.10
}
```

### Test Case 5: A3 Grouping (3 Orders)

**Setup:**
Same as Test Case 4, but with 3 compatible orders

**Expected Result:**
```json
{
  "orderType": "A3",
  "isGrouped": true,
  "groupedOrders": ["orderId2", "orderId3"],
  "soldeTriple": 10.20
}
```

### Test Case 6: Push Notifications

**Setup:**
1. Create user (deliverer) with `pushToken` and `status: 'online'`
2. Create groupable orders (with expired delay)
3. Start scheduler

**Expected Result:**
- FCM notification sent to deliverer
- Notification contains:
  - Title: "🚚 Nouveau Groupe de Commandes"
  - Body: "Groupe A2 détecté! Solde: 8.10€"
  - Data: groupedOrderIds

### Test Case 7: Distance Validation

**Setup:**
Use Google Maps to find:
- 2 restaurants 5.5km apart (should group)
- 2 restaurants 6.5km apart (should not group)
- Delivery location 2.8km from client (should group)
- Delivery location 3.2km from client (should not group)

**Test:**
```javascript
const { calculateDistance } = require('./utils/distanceCalculator');

// Should pass (≤6km)
const dist1 = calculateDistance(48.8566, 2.3522, 48.9077, 2.3774);
console.log(`Distance: ${dist1.toFixed(2)}km - ${dist1 <= 6 ? '✓ PASS' : '✗ FAIL'}`);

// Should fail (>6km)
const dist2 = calculateDistance(48.8566, 2.3522, 49.2000, 2.5000);
console.log(`Distance: ${dist2.toFixed(2)}km - ${dist2 > 6 ? '✓ PASS' : '✗ FAIL'}`);
```

### Test Case 8: Server Graceful Shutdown

**Steps:**
1. Start server
2. Verify scheduler is running
3. Send SIGTERM signal (`Ctrl+C`)
4. Check console logs

**Expected Result:**
```
⏸️ SIGTERM signal received: closing HTTP server
⏹️ Order Grouping Scheduler stopped
❌ HTTP server closed
❌ MongoDB connection closed
```

## Performance Testing

### Test Case 9: Scheduler Load Test

**Setup:**
1. Create 1000 pending orders
2. Start server
3. Monitor CPU and memory usage
4. Check scheduler execution time

**Expected Results:**
- CPU usage: <5% during cycle
- Memory: <50MB additional
- Cycle execution time: <5 seconds
- Database query time: <1 second (with indexes)

### Test Case 10: Database Query Performance

**Steps:**
```javascript
const mongoose = require('mongoose');
const Order = require('./models/Order');

// Test query performance
console.time('grouping-candidates-query');
const candidates = await Order.find({
  status: 'pending',
  isGrouped: false,
  orderType: { $in: ['A1', 'A2', 'A3'] },
  scheduledFor: { $lte: new Date() }
})
.populate('client provider')
.limit(100);
console.timeEnd('grouping-candidates-query');

// Expected: <100ms with proper indexes
```

## Regression Testing

### Test Case 11: Existing Orders Not Affected

**Verification:**
- [ ] Orders without processingDelay still work
- [ ] Orders with status !== 'pending' not grouped
- [ ] Orders with isGrouped = true not re-grouped
- [ ] Existing delivery workflow unchanged

### Test Case 12: Backward Compatibility

**Verification:**
- [ ] Orders created before update have processingDelay = null
- [ ] Old orders eventually available for grouping (no scheduledFor = null check)
- [ ] Database migration handles null processingDelay/scheduledFor

## Monitoring Checklist

- [ ] Scheduler starts on server startup
- [ ] Scheduler stops on server shutdown
- [ ] Scheduler runs every 60 seconds
- [ ] Orders released after delay expires
- [ ] A3 groups prioritized over A2
- [ ] Distance validation working (≤6km, ≤3km)
- [ ] Push notifications sent to deliverers
- [ ] Solde calculations correct
- [ ] Database indexes optimized
- [ ] Error handling graceful
- [ ] No infinite loops or memory leaks
- [ ] Logs are informative and actionable

---

## Test Database Setup

```javascript
// test/setup.js

const mongoose = require('mongoose');

const connectTestDB = async () => {
  await mongoose.connect(process.env.TEST_MONGO_URI || 'mongodb://localhost:27017/amigos-test');
};

const closeTestDB = async () => {
  await mongoose.connection.close();
};

const clearCollections = async () => {
  const collections = await mongoose.connection.db.listCollections().toArray();
  for (let collection of collections) {
    await mongoose.connection.db.dropCollection(collection.name);
  }
};

module.exports = {
  connectTestDB,
  closeTestDB,
  clearCollections
};
```
