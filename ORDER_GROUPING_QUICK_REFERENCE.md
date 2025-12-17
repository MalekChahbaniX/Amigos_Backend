# Order Grouping System - Quick Reference

## Files Modified/Created

### ✅ **Created:**
1. `services/balanceCalculator.js` - Solde calculation functions
2. `services/orderGroupingService.js` - Distance-based grouping logic
3. `services/orderGroupingScheduler.js` - 60-second scheduling cycle
4. `ORDER_GROUPING_IMPLEMENTATION.md` - Complete documentation

### ✅ **Modified:**
1. `models/Order.js` - Added 9 fields + 2 indexes
2. `controllers/orderController.js` - Set processingDelay & scheduledFor on creation
3. `server.js` - Initialize scheduler on startup, handle graceful shutdown

---

## Core Concepts

### Order Processing Delay
- **What:** Orders wait 5-10 minutes before grouping eligibility
- **Why:** Allows order accumulation, improves grouping likelihood
- **When:** Set at creation time
- **Where:** `orderController.createOrder()` sets `processingDelay` & `scheduledFor`

### Grouping Distance Rules
- **Provider-to-Provider:** ≤ 6km (same service area)
- **Client-to-Delivery:** ≤ 3km (nearby location)
- **Implementation:** Haversine formula in `orderGroupingService.js`

### Grouping Priorities
1. **A3 Groups:** 3 orders preferred (max efficiency)
2. **A2 Groups:** 2 orders if A3 not possible
3. **A1 Orders:** Ungrouped orders (single delivery)

### Scheduler Cycle (Every 60 seconds)
```
1. releaseOrdersFromDelay()
   ↓ Clears processingDelay for orders where scheduledFor ≤ now
   ↓
2. detectAndGroupOrders()
   ├─ Phase 1: Find & form A3 groups
   ├─ Phase 2: Find & form A2 groups
   └─ Notify deliverers for each group
```

---

## API Integration Points

### 1. Create Order
```javascript
POST /api/orders/create
{
  // ... order data ...
}

// Response includes:
{
  order: {
    _id: "...",
    processingDelay: 7,        // e.g., 7 minutes
    scheduledFor: "2024-01-15T14:07:00Z",  // delay expiry time
    orderType: "A1",           // default type
    isGrouped: false,          // not grouped yet
    // ... other fields ...
  }
}
```

### 2. Order Becomes Eligible
```javascript
// After scheduledFor timestamp passes
// Scheduler automatically calls releaseOrdersFromDelay()
// Order fields cleared:
{
  processingDelay: undefined,
  scheduledFor: undefined
}
```

### 3. Grouping Detected
```javascript
// Scheduler finds compatible orders
// Updates both orders:
{
  orderType: "A2",           // changed from A1
  isGrouped: true,           // now grouped
  groupedOrders: ["{orderId2}"],  // reference to partner
  soldeDual: 4.50            // balance calculated
}
```

### 4. Group Notification
```javascript
// Server sends FCM push to online deliverers:
{
  title: "🚚 Nouveau Groupe de Commandes",
  body: "Groupe A2 détecté! Solde: 4.50€",
  data: {
    groupedOrderIds: ["orderId1", "orderId2"]
  }
}
```

---

## Scheduler Health

### Start Message
```
✅ Order grouping scheduler started
🚀 Order Grouping Scheduler started
```

### Cycle Output
```
📦 Grouping cycle started
🔍 Found X candidates for grouping
✅ A3 group formed: 3 orders
✅ A2 group formed: 2 orders
🚚 Notified X deliverers
📦 Grouping cycle completed
```

### Stop Message
```
⏹️ Order Grouping Scheduler stopped
❌ HTTP server closed
❌ MongoDB connection closed
```

---

## Testing Commands

### Check Scheduler Status
```javascript
const { getSchedulerStatus } = require('./services/orderGroupingScheduler');
console.log(getSchedulerStatus());
// { running: true, intervalMs: 60000, ... }
```

### View Grouped Orders
```javascript
const Order = require('./models/Order');
const grouped = await Order.find({ isGrouped: true })
  .populate('groupedOrders');
console.log(grouped);
```

### Check Pending Orders
```javascript
const pending = await Order.find({ 
  status: 'pending',
  isGrouped: false,
  scheduledFor: { $gt: new Date() }
});
console.log(`${pending.length} orders still in delay window`);
```

### Verify Distance Calculation
```javascript
const { calculateDistance } = require('./utils/distanceCalculator');
const distance = calculateDistance(lat1, lon1, lat2, lon2);
console.log(`Distance: ${distance.toFixed(2)} km`);
```

---

## Troubleshooting

### Orders Not Grouping?
```
✓ Check processingDelay has expired (scheduledFor ≤ now)
✓ Verify provider distance ≤ 6km
✓ Verify delivery distance ≤ 3km
✓ Ensure status = 'pending' on both orders
✓ Check scheduler is running: getSchedulerStatus()
```

### Scheduler Not Starting?
```
✓ Verify server.js imports orderGroupingScheduler
✓ Check startGroupingScheduler() called in listen()
✓ Look for "🚀 Order Grouping Scheduler started" in logs
```

### Wrong Solde Values?
```
✓ Verify balanceCalculator functions loaded
✓ Check appFee field populated on orders
✓ Ensure solde percentages correct (9-15% discount)
```

---

## Database State Examples

### New Order (Before Delay Expires)
```javascript
{
  _id: ObjectId("123"),
  status: "pending",
  orderType: "A1",
  isGrouped: false,
  processingDelay: 7,
  scheduledFor: ISODate("2024-01-15T14:07:00Z"),  // 7 min from now
  groupedOrders: [],
  soldeSimple: 2.50,
  soldeDual: 0,
  soldeTriple: 0,
  // ... other fields ...
}
```

### Released Order (After Delay Expires)
```javascript
{
  _id: ObjectId("123"),
  status: "pending",
  orderType: "A1",
  isGrouped: false,
  processingDelay: null,      // cleared by scheduler
  scheduledFor: null,         // cleared by scheduler
  groupedOrders: [],
  soldeSimple: 2.50,
  // ... ready for grouping ...
}
```

### Grouped Order (A2)
```javascript
{
  _id: ObjectId("123"),
  status: "pending",
  orderType: "A2",            // changed
  isGrouped: true,            // grouped
  processingDelay: null,
  scheduledFor: null,
  groupedOrders: [ObjectId("456")],  // partner order
  soldeSimple: 2.50,
  soldeDual: 4.50,            // calculated for pair
  soldeTriple: 0,
  // ... other fields ...
}
```

---

## Performance Tips

### 1. Optimize Scheduler Frequency
- **Default:** Every 60 seconds
- **Adjust:** Change to 30s for faster grouping or 120s to reduce load

### 2. Monitor Database Load
- Check indexes: `db.orders.getIndexes()`
- Verify `{status, orderType, isGrouped, scheduledFor}` index exists

### 3. Tune Processing Delay
- **Current:** 5-10 minutes random
- **Increase:** Better order accumulation, slower grouping
- **Decrease:** Faster grouping, fewer candidates

### 4. Log Grouping Activity
- Set `NODE_ENV=debug` to see detailed cycle logs
- Monitor scheduler status every 5 minutes

---

## Implementation Checklist

- [x] Order model updated with grouping fields
- [x] Balance calculator service created
- [x] Order grouping service created
- [x] Scheduler service created
- [x] Processing delay set on order creation
- [x] Scheduler integrated into server startup
- [x] Graceful shutdown implemented
- [x] Distance validation working
- [x] A3 grouping logic implemented
- [x] A2 grouping logic implemented
- [x] Deliverer notifications configured
- [x] Documentation complete

---

## Next Steps (Optional Enhancements)

1. **Add A4 Grouping:** Extend for 4-order groups during peak times
2. **Zone-Aware Grouping:** Group across zone boundaries with surcharge
3. **Real-time Dashboard:** WebSocket updates for live grouping events
4. **Performance Analytics:** Track grouping success rates and cost savings
5. **Fraud Detection:** Prevent order manipulation via suspicious grouping patterns
6. **Dynamic Pricing:** Adjust solde based on demand and grouping efficiency

---

## Support Commands

### View Scheduler Logs
```bash
# Linux/Mac
tail -f /path/to/logs | grep "📦\|✅\|🚀"

# Windows PowerShell
Get-Content logs.txt -Tail 20 -Wait
```

### Database Query to Count Groups
```javascript
db.orders.aggregate([
  { $match: { isGrouped: true } },
  { $group: { 
      _id: "$orderType", 
      count: { $sum: 1 },
      avgSolde: { $avg: { $cond: [
        { $eq: ["$orderType", "A2"] }, 
        "$soldeDual", 
        "$soldeTriple"
      ]} }
  }}
])
```

### Reset Orders to Ungrouped State (Debug)
```javascript
// WARNING: Use only for testing
db.orders.updateMany(
  { isGrouped: true },
  { 
    $set: { 
      isGrouped: false,
      orderType: "A1"
    },
    $unset: { 
      groupedOrders: 1,
      soldeDual: 1,
      soldeTriple: 1
    }
  }
)
```

---

## Key Metrics to Monitor

| Metric | Target | Unit |
|--------|--------|------|
| Grouping Success Rate | >70% | % |
| Average Group Size | 2.5+ | orders |
| Time to Group | <90 | sec |
| Missed Grouping Attempts | <10% | % |
| Scheduler Uptime | 99.9% | % |
| Cost Savings | >20% | % vs A1 |

---

## Emergency Contacts

- **Scheduler Not Running?** Check `server.js` startup logs
- **Orders Not Grouping?** Check scheduler cycle logs and distance values
- **Database Issue?** Verify connection and indexes
- **Notification Failures?** Check `pushNotificationService` and FCM credentials
