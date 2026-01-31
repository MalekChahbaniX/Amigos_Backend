const io = require('socket.io-client');

const PRODUCTION_URL = 'https://amigosdelivery25.com';
const DEV_URL = 'http://192.168.1.104:5000';

console.log('🧪 Testing WebSocket connections...\n');

// Test 1: Production WebSocket
console.log('📡 Test 1: Production WebSocket');
const prodSocket = io(PRODUCTION_URL, {
  transports: ['websocket'],
  timeout: 10000
});

prodSocket.on('connect', () => {
  console.log('✅ Production WebSocket connected');
  console.log(`   Socket ID: ${prodSocket.id}`);
  console.log(`   Transport: ${prodSocket.io.engine.transport.name}`);
  prodSocket.disconnect();
});

prodSocket.on('connect_error', (error) => {
  console.error('❌ Production WebSocket failed:', error.message);
});

// Test 2: Production Polling
setTimeout(() => {
  console.log('\n📡 Test 2: Production Polling');
  const pollSocket = io(PRODUCTION_URL, {
    transports: ['polling'],
    timeout: 10000
  });

  pollSocket.on('connect', () => {
    console.log('✅ Production Polling connected');
    console.log(`   Socket ID: ${pollSocket.id}`);
    console.log(`   Transport: ${pollSocket.io.engine.transport.name}`);
    pollSocket.disconnect();
  });

  pollSocket.on('connect_error', (error) => {
    console.error('❌ Production Polling failed:', error.message);
  });
}, 2000);

// Test 3: Auto-upgrade (polling → websocket)
setTimeout(() => {
  console.log('\n📡 Test 3: Auto-upgrade (polling → websocket)');
  const upgradeSocket = io(PRODUCTION_URL, {
    transports: ['polling', 'websocket'],
    timeout: 10000
  });

  upgradeSocket.on('connect', () => {
    console.log('✅ Connected with auto-upgrade');
    console.log(`   Initial transport: ${upgradeSocket.io.engine.transport.name}`);
  });

  upgradeSocket.io.engine.on('upgrade', (transport) => {
    console.log(`🔄 Upgraded to: ${transport.name}`);
    setTimeout(() => upgradeSocket.disconnect(), 1000);
  });

  upgradeSocket.on('connect_error', (error) => {
    console.error('❌ Auto-upgrade failed:', error.message);
  });
}, 4000);

// Exit after all tests
setTimeout(() => {
  console.log('\n✅ All tests completed');
  process.exit(0);
}, 8000);
