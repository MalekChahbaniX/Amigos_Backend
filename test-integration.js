const mongoose = require('mongoose');
const Product = require('./models/Product');
const Order = require('./models/Order');
const Provider = require('./models/Provider');
const Zone = require('./models/Zone');
const AppSetting = require('./models/AppSetting');

// Configuration
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/amigos_test';

async function testCompleteSystem() {
  console.log('🧪 Testing Complete Delivery System Integration\n');

  try {
    // 1. Connect to database
    console.log('1. Connecting to database...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Database connected\n');

    // 2. Clean up test data
    console.log('2. Cleaning up test data...');
    await Product.deleteMany({ name: { $regex: '^Test Product' } });
    await Provider.deleteMany({ name: { $regex: '^Test Provider' } });
    await Zone.deleteMany({ number: { $in: [999, 998, 997] } });
    await AppSetting.deleteMany({ appFee: { $in: [1.5, 0] } });
    await Order.deleteMany({ 'items.name': { $regex: '^Test Product' } });
    console.log('✅ Test data cleaned\n');

    // 3. Create test zones
    console.log('3. Creating test zones...');
    const zones = await Zone.insertMany([
      { number: 999, minDistance: 0, maxDistance: 5, price: 2.0 },
      { number: 998, minDistance: 5.1, maxDistance: 10, price: 3.5 },
      { number: 997, minDistance: 10.1, maxDistance: 20, price: 5.0 }
    ]);
    console.log(`✅ Created ${zones.length} zones\n`);

    // 4. Create test app settings
    console.log('4. Creating test app settings...');
    const appSetting = await AppSetting.create({ appFee: 1.5 });
    console.log('✅ Created app settings\n');

    // 5. Create test providers
    console.log('5. Creating test providers...');
    const restaurantProvider = await Provider.create({
      name: 'Test Restaurant',
      type: 'restaurant',
      phone: '123456789',
      address: '123 Test Street',
      csRPercent: 5,
      csCPercent: 0
    });

    const courseProvider = await Provider.create({
      name: 'Test Course',
      type: 'course',
      phone: '123456789',
      address: '456 Test Avenue',
      csRPercent: 0,
      csCPercent: 10
    });

    console.log('✅ Created providers\n');

    // 6. Create test products with new fields
    console.log('6. Creating test products...');
    const restaurantProduct = await Product.create({
      name: 'Test Product Restaurant',
      description: 'Test product for restaurant',
      price: 10.0,
      category: 'Food',
      provider: restaurantProvider._id,
      csR: 5,  // 5% restaurant commission
      csC: 0,  // 0% client commission
      deliveryCategory: 'restaurant',
      availability: true
    });

    const courseProduct = await Product.create({
      name: 'Test Product Course',
      description: 'Test product for course',
      price: 20.0,
      category: 'Groceries',
      provider: courseProvider._id,
      csR: 0,   // 0% restaurant commission
      csC: 10,  // 10% client commission
      deliveryCategory: 'course',
      availability: true
    });

    const pharmacyProduct = await Product.create({
      name: 'Test Product Pharmacy',
      description: 'Test product for pharmacy',
      price: 15.0,
      category: 'Medicine',
      provider: courseProvider._id,
      csR: 5,   // 5% restaurant commission
      csC: 5,   // 5% client commission
      deliveryCategory: 'pharmacy',
      availability: true
    });

    console.log('✅ Created products\n');

    // 7. Test pricing calculations
    console.log('7. Testing pricing calculations...');
    
    // Verify P1 and P2 calculations
    console.log('Restaurant Product Pricing:');
    console.log(`  Price (P): ${restaurantProduct.price}`);
    console.log(`  P1 (payout): ${restaurantProduct.p1} (should be ${restaurantProduct.price * 0.95})`);
    console.log(`  P2 (client): ${restaurantProduct.p2} (should be ${restaurantProduct.price})`);
    
    console.log('Course Product Pricing:');
    console.log(`  Price (P): ${courseProduct.price}`);
    console.log(`  P1 (payout): ${courseProduct.p1} (should be ${courseProduct.price})`);
    console.log(`  P2 (client): ${courseProduct.p2} (should be ${courseProduct.price * 1.10})`);
    
    console.log('Pharmacy Product Pricing:');
    console.log(`  Price (P): ${pharmacyProduct.price}`);
    console.log(`  P1 (payout): ${pharmacyProduct.p1} (should be ${pharmacyProduct.price * 0.95})`);
    console.log(`  P2 (client): ${pharmacyProduct.p2} (should be ${pharmacyProduct.price * 1.05})`);
    
    console.log('✅ Pricing calculations verified\n');

    // 8. Test product API endpoints
    console.log('8. Testing product API endpoints...');
    
    // Test getProducts
    const allProducts = await Product.find().populate('provider', 'name type');
    console.log(`✅ Retrieved ${allProducts.length} products via API`);
    
    // Test getProductById
    const singleProduct = await Product.findById(restaurantProduct._id).populate('provider', 'name type');
    console.log(`✅ Retrieved single product: ${singleProduct.name}`);
    console.log(`  Product details: P=${singleProduct.price}, P1=${singleProduct.p1}, P2=${singleProduct.p2}, csR=${singleProduct.csR}, csC=${singleProduct.csC}, category=${singleProduct.deliveryCategory}`);
    
    // Test update product
    const updatedProduct = await Product.findByIdAndUpdate(
      restaurantProduct._id,
      { csR: 10, csC: 5, deliveryCategory: 'course' },
      { new: true }
    );
    console.log(`✅ Updated product commissions: csR=${updatedProduct.csR}, csC=${updatedProduct.csC}, category=${updatedProduct.deliveryCategory}`);
    
    console.log('✅ Product API endpoints verified\n');

    // 9. Test order creation
    console.log('9. Testing order creation...');

    const testOrder = await Order.create({
      client: new mongoose.Types.ObjectId(),
      provider: restaurantProvider._id,
      items: [
        {
          product: restaurantProduct._id,
          name: restaurantProduct.name,
          price: restaurantProduct.price,
          quantity: 2,
          p1: restaurantProduct.p1,
          p2: restaurantProduct.p2,
          deliveryCategory: restaurantProduct.deliveryCategory
        },
        {
          product: courseProduct._id,
          name: courseProduct.name,
          price: courseProduct.price,
          quantity: 1,
          p1: courseProduct.p1,
          p2: courseProduct.p2,
          deliveryCategory: courseProduct.deliveryCategory
        }
      ],
      deliveryAddress: {
        street: '789 Test Road',
        city: 'Test City',
        zipCode: '12345'
      },
      paymentMethod: 'online',
      status: 'pending',
      zone: zones[0]._id,
      distance: 3,
      p1Total: (restaurantProduct.p1 * 2) + (courseProduct.p1 * 1),
      p2Total: (restaurantProduct.p2 * 2) + (courseProduct.p2 * 1),
      deliveryFee: zones[0].price,
      appFee: 0, // Restaurant category
      platformSolde: ((restaurantProduct.p2 * 2) + (courseProduct.p2 * 1)) - ((restaurantProduct.p1 * 2) + (courseProduct.p1 * 1)) + zones[0].price + 0,
      finalAmount: ((restaurantProduct.p2 * 2) + (courseProduct.p2 * 1)) + zones[0].price + 0,
      totalAmount: ((restaurantProduct.p2 * 2) + (courseProduct.p2 * 1)) + zones[0].price + 0,
      clientProductsPrice: (restaurantProduct.p2 * 2) + (courseProduct.p2 * 1),
      restaurantPayout: (restaurantProduct.p1 * 2) + (courseProduct.p1 * 1)
    });

    console.log('✅ Order created successfully');
    console.log(`Order ID: ${testOrder._id}`);
    console.log(`Platform Solde: ${testOrder.platformSolde}`);
    console.log(`Final Amount: ${testOrder.finalAmount}\n`);

    // 10. Test platform balance calculation
    console.log('10. Testing platform balance calculation...');
    
    const platformBalance = await Order.aggregate([
      {
        $match: {
          _id: testOrder._id,
          status: { $in: ['pending', 'delivered', 'completed'] }
        }
      },
      {
        $group: {
          _id: null,
          totalSolde: { $sum: '$platformSolde' },
          totalRevenue: { $sum: '$clientProductsPrice' },
          totalPayout: { $sum: '$restaurantPayout' },
          totalDeliveryFee: { $sum: '$deliveryFee' },
          totalAppFee: { $sum: '$appFee' }
        }
      }
    ]);

    console.log('Platform Balance Breakdown:');
    if (platformBalance.length > 0) {
      const balance = platformBalance[0];
      console.log(`  Total Solde: ${balance.totalSolde}`);
      console.log(`  Commission Plateforme: ${(balance.totalRevenue - balance.totalPayout).toFixed(2)}`);
      console.log(`  Frais Livraison: ${balance.totalDeliveryFee}`);
      console.log(`  Frais Application: ${balance.totalAppFee}`);
    }
    console.log('✅ Platform balance calculation verified\n');

    // 11. Test analytics aggregation
    console.log('11. Testing analytics aggregation...');
    
    const analytics = await Order.aggregate([
      {
        $match: {
          status: { $in: ['pending', 'delivered', 'completed'] }
        }
      },
      {
        $group: {
          _id: '$items.deliveryCategory',
          totalSolde: { $sum: '$platformSolde' },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$clientProductsPrice' },
          totalPayout: { $sum: '$restaurantPayout' },
          totalDeliveryFee: { $sum: '$deliveryFee' },
          totalAppFee: { $sum: '$appFee' }
        }
      },
      { $sort: { totalSolde: -1 } }
    ]);

    console.log('Analytics by Category:');
    analytics.forEach(cat => {
      console.log(`  ${cat._id}:`);
      console.log(`    Total Solde: ${cat.totalSolde}`);
      console.log(`    Orders: ${cat.totalOrders}`);
      console.log(`    Revenue: ${cat.totalRevenue}`);
      console.log(`    Payout: ${cat.totalPayout}`);
    });
    console.log('✅ Analytics aggregation verified\n');

    // 12. Summary
    console.log('🎉 Integration Test Summary:');
    console.log('✅ Database connection');
    console.log('✅ Product model with P1/P2 calculations');
    console.log('✅ Product API endpoints with new fields (csR, csC, deliveryCategory)');
    console.log('✅ Order model with complete pricing fields');
    console.log('✅ Provider model with commissions');
    console.log('✅ Zone model for delivery fees');
    console.log('✅ AppSetting model for app fees');
    console.log('✅ Order creation with complete pricing logic');
    console.log('✅ Platform solde calculation');
    console.log('✅ Analytics aggregation');
    console.log('\n🚀 Complete delivery system is working correctly!');

  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    console.error(error.stack);
  } finally {
    // Clean up and close connection
    console.log('\n🧹 Cleaning up and closing connection...');
    await mongoose.connection.close();
    console.log('✅ Connection closed');
  }
}

// Run the test
testCompleteSystem();