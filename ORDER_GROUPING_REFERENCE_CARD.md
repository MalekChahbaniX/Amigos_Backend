# Order Grouping System - Reference Card

## Quick Command Reference

### Check System Status
```javascript
const scheduler = require('./services/orderGroupingScheduler');
console.log(scheduler.getSchedulerStatus());
```

### Test Order Creation
```bash
curl -X POST http://localhost:5000/api/orders/create \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "client_123",
    "providerId": "provider_456",
    "items": [...],
    "deliveryAddress": {...}
  }'
```

### Monitor Database Orders
```javascript
// Orders in delay window
db.orders.countDocuments({ processingDelay: { $exists: true } })

// Grouped orders
db.orders.countDocuments({ isGrouped: true })

// Pending ungrouped orders
db.orders.countDocuments({ status: 'pending', isGrouped: false })
```

---

## File Structure

```
BACKEND/
├── services/
│   ├── balanceCalculator.js ..................... Solde calculations
│   ├── orderGroupingService.js .................. Grouping logic
│   └── orderGroupingScheduler.js ................ 60-second scheduler
├── models/
│   └── Order.js ................................ Updated with 9 fields
├── controllers/
│   └── orderController.js ....................... Sets processingDelay
├── utils/
│   └── distanceCalculator.js .................... Haversine formula
├── server.js ................................... Scheduler integration
└── Documentation/
    ├── ORDER_GROUPING_IMPLEMENTATION.md ........ Full technical guide
    ├── ORDER_GROUPING_ARCHITECTURE.md ......... System design + diagrams
    ├── ORDER_GROUPING_QUICK_REFERENCE.md ..... Fast lookup
    ├── ORDER_GROUPING_TESTING.md ............. Test framework
    └── IMPLEMENTATION_COMPLETE.md ............. Completion summary
```

---

## Configuration Values

```javascript
// Processing Delay (orderController.js)
delayMinutes = Math.floor(Math.random() * 6) + 5;  // 5-10 minutes

// Scheduler Frequency (orderGroupingScheduler.js)
setInterval(runGroupingCycle, 60 * 1000);  // Every 60 seconds

// Distance Thresholds (orderGroupingService.js)
MAX_PROVIDER_DISTANCE = 6000;  // meters (6km)
MAX_CLIENT_DISTANCE = 3000;    // meters (3km)

// Balance Discounts (balanceCalculator.js)
A2_DISCOUNT = 0.90;  // 10% discount for pairs
A3_DISCOUNT = 0.85;  // 15% discount for triplets
```

---

## Status Codes & Responses

### Order Creation Response
```json
{
  "message": "Order created successfully",
  "order": {
    "_id": "507f1f77bcf86cd799439011",
    "status": "pending",
    "orderType": "A1",
    "isGrouped": false,
    "processingDelay": 7,
    "scheduledFor": "2024-01-15T14:07:00.000Z",
    "soldeSimple": 5.00,
    "soldeDual": 0,
    "soldeTriple": 0
  }
}
```

### Scheduler Status Response
```json
{
  "running": true,
  "intervalMs": 60000,
  "lastCycle": 1705334400000,
  "cycleCount": 42
}
```

---

## Scheduler Lifecycle Logs

### Startup
```
✅ Order grouping scheduler started
🚀 Order Grouping Scheduler started
```

### Normal Cycle
```
📦 Grouping cycle started
🔍 Found 5 candidates for grouping
✅ A3 group formed: 3 orders
✅ A2 group formed: 2 orders
🚚 Notified 8 deliverers
📦 Grouping cycle completed
```

### Shutdown
```
⏸️ SIGTERM signal received: closing HTTP server
⏹️ Order Grouping Scheduler stopped
❌ HTTP server closed
❌ MongoDB connection closed
```

---

## Error Scenarios & Recovery

| Error | Cause | Recovery |
|-------|-------|----------|
| No candidates found | Orders in delay window | Automatic after delay expires |
| Distance validation fails | Providers >6km apart | Try different order pair |
| Notification fails | FCM token invalid | Continue grouping, retry on next cycle |
| Database query slow | Missing index | Recreate indexes: `{status, orderType, isGrouped, scheduledFor}` |
| Scheduler not running | Not started in server.js | Restart server, check logs |

---

## Performance Targets

| Metric | Target | Actual |
|--------|--------|--------|
| Grouping Success Rate | >70% | Monitor |
| Scheduler Cycle Time | <5 sec | Monitor |
| Database Query Time | <1 sec | With indexes ✓ |
| CPU Usage | <5% | Monitor |
| Memory Overhead | <50MB | Monitor |
| Cost Savings | >20% | Track |

---

## Debugging Queries

### Find Orders Pending Grouping
```javascript
db.orders.find({
  status: 'pending',
  isGrouped: false,
  processingDelay: { $exists: false },
  scheduledFor: { $exists: false }
}).limit(10)
```

### Find Grouped Orders
```javascript
db.orders.find({
  isGrouped: true
}).populate('groupedOrders').limit(10)
```

### Check Order Balance Calculation
```javascript
db.orders.findOne({ _id: ObjectId("...") }, {
  orderType: 1,
  soldeSimple: 1,
  soldeDual: 1,
  soldeTriple: 1,
  appFee: 1
})
```

### Verify Distance Calculation
```javascript
// In Node.js
const { calculateDistance } = require('./utils/distanceCalculator');
const dist = calculateDistance(lat1, lon1, lat2, lon2);
console.log(`Distance: ${dist.toFixed(2)}km`);
```

---

## Integration Points

### Order Creation
```javascript
// When: POST /api/orders/create
// Does: Sets processingDelay and scheduledFor
// Impact: Orders queued for grouping after delay expires
```

### Scheduler Startup
```javascript
// When: server.listen()
// Does: Calls startGroupingScheduler()
// Impact: 60-second grouping cycle begins
```

### Order Grouping
```javascript
// When: Every 60 seconds (scheduler)
// Does: Finds partners and updates orders
// Impact: orderType changed, isGrouped=true, groupedOrders populated
```

### Deliverer Notification
```javascript
// When: Group successfully formed
// Does: Sends FCM push notification
// Impact: Deliverer sees "Nouveau Groupe de Commandes" notification
```

---

## Database Maintenance

### Create Indexes
```javascript
db.orders.createIndex({
  status: 1,
  orderType: 1,
  isGrouped: 1,
  scheduledFor: 1
})

db.orders.createIndex({
  provider: 1,
  zone: 1,
  scheduledFor: 1
})
```

### Reset Orders (Testing Only)
```javascript
// WARNING: Use only in development
db.orders.updateMany(
  { isGrouped: true },
  {
    $set: { isGrouped: false, orderType: 'A1' },
    $unset: { groupedOrders: 1 }
  }
)
```

### Monitor Index Performance
```javascript
db.orders.explain("executionStats").find({
  status: 'pending',
  isGrouped: false,
  scheduledFor: { $lte: new Date() }
})
```

---

## Operational Checklist (Daily)

- [ ] Check scheduler logs for errors
- [ ] Monitor grouping success rate
- [ ] Verify push notifications sent
- [ ] Check database performance
- [ ] Review solde calculations
- [ ] Confirm no memory leaks
- [ ] Validate cost savings

---

## Emergency Procedures

### If Scheduler Not Running
```bash
# 1. Check logs
tail -f logs.txt | grep "Scheduler"

# 2. Verify server.js has startGroupingScheduler
grep -n "startGroupingScheduler" server.js

# 3. Restart server
pm2 restart amigos-backend
# or
npm start
```

### If Orders Not Grouping
```javascript
// 1. Check for eligible orders
db.orders.countDocuments({
  status: 'pending',
  isGrouped: false,
  processingDelay: { $exists: false }
})

// 2. Check distance calculation
const dist = calculateDistance(...);
console.log(dist > 6000 ? 'TOO FAR' : 'OK');

// 3. Check scheduler status
getSchedulerStatus()
```

### If Push Notifications Failing
```javascript
// 1. Verify deliverer has pushToken
db.users.findOne({ role: 'deliverer', _id: "..." }, { pushToken: 1 })

// 2. Check FCM credentials
console.log(process.env.FCM_KEY);

// 3. Test notification service
const { sendPushNotification } = require('./services/pushNotificationService');
await sendPushNotification(userId, { title: 'Test', body: 'Test' });
```

---

## Service Dependencies Graph

```
orderGroupingScheduler
├── orderGroupingService
│   ├── balanceCalculator
│   ├── Order (model)
│   ├── User (model)
│   ├── distanceCalculator
│   └── pushNotificationService
│
orderController
├── balanceCalculator
└── Order (model)

server.js
├── orderGroupingScheduler
├── orderController
└── mongoose (MongoDB)
```

---

## Documentation Hierarchy

```
START HERE
↓
QUICK_REFERENCE.md (5 min read)
├─ Overview
├─ Core concepts
├─ Troubleshooting
└─ Quick tests
↓
IMPLEMENTATION.md (20 min read)
├─ Detailed architecture
├─ Service descriptions
├─ Configuration
└─ Monitoring
↓
ARCHITECTURE.md (30 min read)
├─ Workflow diagrams
├─ Component interactions
├─ State transitions
└─ Performance metrics
↓
TESTING.md (15 min read)
├─ Unit tests
├─ Integration tests
├─ Manual test cases
└─ Performance procedures
```

---

## Performance Optimization Tips

### 1. Increase Scheduler Frequency
```javascript
// Current: 60 seconds
// Option: 30 seconds for faster grouping (more CPU)
setInterval(runGroupingCycle, 30 * 1000);
```

### 2. Adjust Processing Delay
```javascript
// Current: 5-10 minutes
// Option: 2-5 minutes for faster availability
const delayMinutes = Math.floor(Math.random() * 4) + 2;
```

### 3. Tune Distance Thresholds
```javascript
// Current: 6km providers, 3km delivery
// Option: 8km providers for larger groups
MAX_PROVIDER_DISTANCE = 8000;
```

### 4. Add Caching
```javascript
// Cache deliverers list instead of querying each cycle
let cachedDeliverers = [];
// Update cache every 5 minutes
```

---

## Monitoring Dashboard Queries

### Grouping Success Rate
```javascript
db.orders.aggregate([
  { $match: { createdAt: { $gte: ISODate("2024-01-15") } } },
  { $group: {
      _id: null,
      total: { $sum: 1 },
      grouped: { $sum: { $cond: ["$isGrouped", 1, 0] } }
  } }
])
```

### Average Group Size
```javascript
db.orders.aggregate([
  { $match: { isGrouped: true } },
  { $group: {
      _id: "$orderType",
      count: { $sum: 1 }
  } }
])
```

### Cost Savings Calculation
```javascript
db.orders.aggregate([
  { $group: {
      _id: "$orderType",
      totalFees: { $sum: { $cond: [
        { $eq: ["$orderType", "A1"] },
        "$soldeSimple",
        { $cond: [{ $eq: ["$orderType", "A2"] }, "$soldeDual", "$soldeTriple"] }
      ]} }
  } }
])
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01-15 | Initial implementation |
| 1.1 | TBD | Performance optimization |
| 2.0 | TBD | A4 grouping support |
| 2.1 | TBD | Dynamic thresholds |
| 3.0 | TBD | ML-based scheduling |

---

## Support Channels

- **Logs:** Check `/var/log/amigos-backend.log` for scheduler activity
- **Database:** MongoDB connection status in server startup logs
- **Notifications:** Check `pushNotificationService` logs for FCM errors
- **Performance:** Monitor with `getSchedulerStatus()` every hour

---

**Last Updated:** 2024-01-15
**Status:** Production Ready
**Support:** Contact development team
