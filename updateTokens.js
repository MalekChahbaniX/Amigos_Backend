const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://malek:22161450@ac-qvbogbc-shard-00-02.gyjfezc.mongodb.net/amigos?retryWrites=true&w=majority&appName=Cluster0')
.then(async () => {
  console.log('✅ Connected to MongoDB');
  
  const User = require('./models/User');
  
  // Update deliverer push tokens with valid Expo format
  const result = await User.updateMany(
    { role: 'deliverer' },
    { 
      $set: { 
        pushToken: 'ExponentPushToken[' + Math.random().toString(36).substr(2, 16) + ']'
      } 
    }
  );
  
  console.log(`✅ Updated ${result.modifiedCount} deliverer push tokens`);
  
  // Show updated tokens
  const deliverers = await User.find({ role: 'deliverer' });
  deliverers.forEach(d => {
    console.log(`📱 ${d.firstName}: ${d.pushToken}`);
  });
  
  await mongoose.disconnect();
  console.log('✅ Disconnected from MongoDB');
})
.catch(console.error);
