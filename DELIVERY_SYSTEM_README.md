# Amigos Delivery System - Backend Documentation

## 🎯 System Overview

Complete delivery system backend for Amigos with:
- Restaurants
- Special categories (Achat/Course/Pharmacie)
- Zone-based deliveries
- Variable commissions (client/restaurant)
- Automatic P1/P2 pricing management
- Platform balance calculation
- Deliverer balance calculation

## 📋 Table of Contents

1. [System Architecture](#system-architecture)
2. [Database Models](#database-models)
3. [Pricing Logic](#pricing-logic)
4. [API Endpoints](#api-endpoints)
5. [Dashboard Features](#dashboard-features)
6. [Analytics](#analytics)
7. [Testing](#testing)
8. [Setup Instructions](#setup-instructions)
9. [Product Management](#product-management)

## 🏗️ System Architecture

### Core Components

```
models/
├── Product.js          # Product with P1/P2 pricing
├── Order.js            # Order with complete pricing
├── Provider.js         # Provider with commissions
├── Zone.js             # Delivery zones
├── AppSetting.js       # Application fees
└── User.js             # Users (clients, deliverers)

controllers/
├── orderController.js      # Order management
├── dashboardController.js  # Dashboard operations
├── analyticsController.js  # Analytics endpoints
└── productsController.js   # Product management

routes/
├── orderRoutes.js          # Order endpoints
├── dashboardRoutes.js      # Dashboard endpoints
├── analyticsRoutes.js      # Analytics endpoints
└── productsRoutes.js       # Product endpoints
```

## 🗃️ Database Models

### Product Model

```javascript
{
  name: String,
  price: Number,           // P - Base price
  csR: Number,            // Commission restaurant (0%, 5%, 10%)
  csC: Number,            // Commission client (0%, 5%, 10%)
  p1: Number,             // Payout restaurant (calculated)
  p2: Number,             // Client price (calculated)
  deliveryCategory: String, // 'restaurant' | 'course' | 'pharmacy'
  availability: Boolean,   // Product availability
  // ... other fields
}
```

**Auto-calculation (pre-save hook):**
- `p1 = P × (1 - csR/100)`
- `p2 = P × (1 + csC/100)`

### Order Model

```javascript
{
  client: ObjectId,
  provider: ObjectId,
  items: [{
    product: ObjectId,
    name: String,
    price: Number,
    quantity: Number,
    p1: Number,              // Product payout
    p2: Number,              // Product client price
    deliveryCategory: String
  }],
  // Totals
  p1Total: Number,           // Sum of all P1
  p2Total: Number,           // Sum of all P2
  deliveryFee: Number,       // Based on zone
  appFee: Number,            // Based on category
  platformSolde: Number,     // (P2_total - P1_total) + deliveryFee + appFee
  finalAmount: Number,       // P2_total + deliveryFee + appFee
  // ... other fields
}
```

### Provider Model

```javascript
{
  name: String,
  type: 'restaurant' | 'course' | 'pharmacy',
  csRPercent: Number,        // Restaurant commission
  csCPercent: Number,        // Client commission
  // ... other fields
}
```

### Zone Model

```javascript
{
  number: Number,
  minDistance: Number,
  maxDistance: Number,
  price: Number              // Delivery fee
}
```

### AppSetting Model

```javascript
{
  appFee: Number,            // Default app fee (1.5 DT)
  // ... other fields
}
```

## 💰 Pricing Logic

### Commission Calculations

#### Restaurant Commission (CsR)
| CsR | P1 Formula | P2 |
|-----|------------|-----|
| 10% | P × 0.90   | P   |
| 5%  | P × 0.95   | P   |
| 0%  | P          | P   |

#### Client Commission (CsC)
| CsC | P1 | P2 Formula |
|-----|-----|------------|
| 10% | P   | P × 1.10   |
| 5%  | P   | P × 1.05   |
| 0%  | P   | P          |

#### Combined Commissions
P1 and P2 are calculated independently based on each commission.

### Category-based App Fees

| Category | App Fee |
|----------|---------|
| Restaurant | 0 DT |
| Course | 1.5 DT |
| Pharmacy | 1.5 DT |

### Platform Solde Formula

```
Solde = (P2_total - P1_total) + deliveryFee + appFee
```

Where:
- `P2_total`: Sum of client prices
- `P1_total`: Sum of restaurant payouts
- `deliveryFee`: Based on delivery zone
- `appFee`: Based on delivery category

## 🌐 API Endpoints

### Order Management

#### Create Order
```http
POST /api/orders
```

**Request Body:**
```json
{
  "client": "user_id",
  "provider": "provider_id",
  "items": [
    {
      "product": "product_id",
      "name": "Product Name",
      "price": 10.0,
      "quantity": 2
    }
  ],
  "deliveryAddress": {
    "street": "123 Test St",
    "city": "Test City",
    "zipCode": "12345"
  },
  "paymentMethod": "online",
  "zoneId": "zone_id",
  "distance": 5.5
}
```

**Response:**
```json
{
  "message": "Commande créée",
  "order": {
    "id": "order_id",
    "p1Total": 19.0,
    "p2Total": 20.0,
    "deliveryFee": 2.0,
    "appFee": 0.0,
    "platformSolde": 3.0,
    "finalAmount": 22.0
  }
}
```

### Dashboard Endpoints

#### Platform Balance
```http
GET /api/dashboard/platform-balance?startDate=2024-01-01&endDate=2024-01-31&category=restaurant
```

**Response:**
```json
{
  "totalSolde": "1500.000",
  "totalOrders": 50,
  "totalRevenue": "5000.000",
  "totalPayout": "4500.000",
  "totalDeliveryFee": "100.000",
  "totalAppFee": "0.000",
  "breakdown": {
    "commissionPlateforme": "500.000",
    "fraisLivraison": "100.000",
    "fraisApplication": "0.000"
  }
}
```

#### Deliverer Balance
```http
GET /api/dashboard/deliverer-balance?delivererId=deliverer_id
```

**Response:**
```json
{
  "delivererId": "deliverer_id",
  "delivererName": "John Doe",
  "totalSolde": "250.000",
  "totalOrders": 20,
  "breakdown": {
    "commissionPlateforme": "50.000",
    "fraisLivraison": "200.000",
    "fraisApplication": "0.000"
  }
}
```

### Analytics Endpoints

#### Comprehensive Overview
```http
GET /api/analytics/overview?period=30
```

**Response:**
```json
{
  "overview": {
    "totalClients": 1000,
    "totalProviders": 50,
    "totalProducts": 500,
    "totalDeliverers": 20
  },
  "platform": {
    "balance": {
      "totalSolde": 1500.0,
      "totalRevenue": 5000.0,
      "totalPayout": 4500.0
    },
    "delivererPerformance": [
      {
        "name": "John Doe",
        "totalOrders": 50,
        "totalSolde": 250.0
      }
    ]
  }
}
```

#### Balance Analytics
```http
GET /api/analytics/balances?period=7&category=restaurant
```

**Response:**
```json
{
  "platformBalanceOverTime": [
    {
      "_id": "2024-01-01",
      "totalSolde": 100.0,
      "totalOrders": 10
    }
  ],
  "balanceByCategory": [
    {
      "_id": "restaurant",
      "totalSolde": 1000.0,
      "totalOrders": 100
    }
  ],
  "commissionBreakdown": {
    "commissionPlateforme": 500.0,
    "fraisLivraison": 300.0,
    "fraisApplication": 200.0
  }
}
```

### Product Management Endpoints

#### Get Products
```http
GET /api/products?search=burger&category=Food&page=1&limit=12
```

**Response:**
```json
{
  "products": [
    {
      "id": "product_id",
      "name": "Cheeseburger",
      "category": "Food",
      "provider": "Restaurant Name",
      "price": 8.0,
      "p1": 7.6,
      "p2": 8.0,
      "csR": 5,
      "csC": 0,
      "deliveryCategory": "restaurant",
      "stock": 50,
      "status": "available",
      "availability": true,
      "options": [
        {
          "name": "Size",
          "required": false,
          "maxSelections": 1,
          "subOptions": [
            {
              "name": "Regular",
              "price": 0.0
            },
            {
              "name": "Large",
              "price": 2.0
            }
          ]
        }
      ]
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 12,
  "totalPages": 1
}
```

#### Create Product
```http
POST /api/products
```

**Request Body:**
```json
{
  "name": "New Product",
  "description": "Product description",
  "price": 10.0,
  "category": "Food",
  "stock": 100,
  "status": "available",
  "providerId": "provider_id",
  "csR": 5,
  "csC": 0,
  "deliveryCategory": "restaurant",
  "availability": true,
  "optionGroups": ["option_group_id"]
}
```

**Response:**
```json
{
  "message": "Produit créé avec succès",
  "product": {
    "id": "product_id",
    "name": "New Product",
    "category": "Food",
    "provider": "Restaurant Name",
    "price": 10.0,
    "p1": 9.5,
    "p2": 10.0,
    "csR": 5,
    "csC": 0,
    "deliveryCategory": "restaurant",
    "stock": 100,
    "status": "available",
    "availability": true,
    "optionGroups": ["option_group_id"],
    "options": []
  }
}
```

#### Update Product
```http
PUT /api/products/:id
```

**Request Body:**
```json
{
  "csR": 10,
  "csC": 5,
  "deliveryCategory": "course",
  "availability": false
}
```

**Response:**
```json
{
  "message": "Produit mis à jour avec succès",
  "product": {
    "id": "product_id",
    "name": "New Product",
    "category": "Food",
    "provider": "Restaurant Name",
    "price": 10.0,
    "p1": 9.0,
    "p2": 10.5,
    "csR": 10,
    "csC": 5,
    "deliveryCategory": "course",
    "stock": 100,
    "status": "available",
    "availability": false,
    "optionGroups": ["option_group_id"],
    "options": []
  }
}
```

## 📊 Dashboard Features

### Platform Balance Management

1. **Total Platform Solde**: Sum of all completed orders
2. **Commission Breakdown**: Platform commission, delivery fees, app fees
3. **Category Analysis**: Performance by restaurant/course/pharmacy
4. **Time-based Reports**: Daily, weekly, monthly views

### Deliverer Balance Management

1. **Individual Balance**: Per deliverer solde calculation
2. **Performance Metrics**: Orders count, average solde
3. **Order History**: Detailed view of all assigned orders
4. **Earnings Breakdown**: Commission, delivery fees, app fees

### Product Management Features

1. **Product Catalog**: Complete list of all products
2. **Commission Management**: Set csR and csC per product
3. **Category Assignment**: Assign delivery categories (restaurant/course/pharmacy)
4. **Availability Control**: Toggle product availability
5. **Pricing Display**: View P, P1, P2 values for each product
6. **Search & Filter**: Search by name, filter by category
7. **Stock Management**: Track inventory levels
8. **Option Groups**: Manage product customization options

## 📈 Analytics

### Available Reports

1. **Overview Analytics**: Basic metrics and trends
2. **Revenue Analytics**: Detailed revenue analysis
3. **User Analytics**: User registration and activity
4. **Product Analytics**: Product performance and inventory
5. **Balance Analytics**: Platform and deliverer balances

### Key Metrics

- **Platform Solde**: Total platform earnings
- **Commission Rate**: Average commission percentage
- **Delivery Efficiency**: Orders per deliverer
- **Category Performance**: Revenue by category
- **User Growth**: New registrations over time
- **Product Performance**: Best-selling products by category

## 🧪 Testing

### Integration Test

Run the complete system test:

```bash
node test-integration.js
```

**Test Coverage:**
- ✅ Database connection
- ✅ Product model with P1/P2 calculations
- ✅ Product API endpoints with new fields (csR, csC, deliveryCategory)
- ✅ Order model with complete pricing fields
- ✅ Provider model with commissions
- ✅ Zone model for delivery fees
- ✅ AppSetting model for app fees
- ✅ Order creation with complete pricing logic
- ✅ Platform solde calculation
- ✅ Analytics aggregation

### Test Output Example

```
🧪 Testing Complete Delivery System Integration

1. Connecting to database...
✅ Database connected

2. Cleaning up test data...
✅ Test data cleaned

3. Creating test zones...
✅ Created 3 zones

[...]

🎉 Integration Test Summary:
✅ Database connection
✅ Product model with P1/P2 calculations
✅ Product API endpoints with new fields (csR, csC, deliveryCategory)
✅ Order model with complete pricing fields
✅ Provider model with commissions
✅ Zone model for delivery fees
✅ AppSetting model for app fees
✅ Order creation with complete pricing logic
✅ Platform solde calculation
✅ Analytics aggregation

🚀 Complete delivery system is working correctly!
```

## ⚙️ Setup Instructions

### Prerequisites

- Node.js (v14+)
- MongoDB
- npm or yarn

### Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd BACKEND
```

2. **Install dependencies:**
```bash
npm install
```

3. **Environment setup:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Run the server:**
```bash
npm start
```

5. **Run integration test:**
```bash
node test-integration.js
```

### Environment Variables

```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/amigos
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=30d
```

## 🔧 Configuration

### Commission Rates

Default commission rates in Provider model:
- `csRPercent`: [0, 5, 10] (default: 5)
- `csCPercent`: [0, 5, 10] (default: 0)

### App Fees

Default app fees:
- Restaurant: 0 DT
- Course: 1.5 DT
- Pharmacy: 1.5 DT

### Zone Pricing

Configure delivery zones in Zone model:
- `minDistance`: Minimum distance (km)
- `maxDistance`: Maximum distance (km)
- `price`: Delivery fee for the zone

## 🚀 Usage Examples

### Creating a Restaurant Order

```javascript
const order = {
  client: "client_id",
  provider: "restaurant_provider_id",
  items: [
    {
      product: "burger_id",
      name: "Cheeseburger",
      price: 8.0,
      quantity: 2
    }
  ],
  deliveryAddress: {
    street: "123 Main St",
    city: "Tunis",
    zipCode: "1000"
  },
  paymentMethod: "online",
  zoneId: "zone_1_id",
  distance: 3.5
};
```

**Expected Results:**
- P1 = 8.0 × 0.95 = 7.6 (5% restaurant commission)
- P2 = 8.0 (0% client commission)
- App Fee = 0 DT (restaurant category)
- Platform Solde = (8.0 - 7.6) × 2 + deliveryFee + 0

### Creating a Course Order

```javascript
const order = {
  client: "client_id",
  provider: "course_provider_id",
  items: [
    {
      product: "grocery_id",
      name: "Milk",
      price: 2.5,
      quantity: 4
    }
  ],
  deliveryAddress: {
    street: "456 Side St",
    city: "Tunis",
    zipCode: "1000"
  },
  paymentMethod: "online",
  zoneId: "zone_2_id",
  distance: 8.2
};
```

**Expected Results:**
- P1 = 2.5 (0% restaurant commission)
- P2 = 2.5 (0% client commission)
- App Fee = 1.5 DT (course category)
- Platform Solde = (2.5 - 2.5) × 4 + deliveryFee + 1.5

### Product Management Example

```javascript
// Create a new product with commissions
const product = {
  name: "Cheeseburger",
  description: "Delicious cheeseburger",
  price: 8.0,
  category: "Food",
  providerId: "restaurant_id",
  csR: 5,           // 5% restaurant commission
  csC: 0,           // 0% client commission
  deliveryCategory: "restaurant",
  availability: true,
  stock: 100,
  status: "available"
};

// After creation, the system automatically calculates:
// P1 = 8.0 × (1 - 5/100) = 7.6
// P2 = 8.0 × (1 + 0/100) = 8.0
```

## 📞 Support

For questions or support, please contact the development team.

---

**Amigos Delivery System** - Complete backend solution for modern delivery applications.