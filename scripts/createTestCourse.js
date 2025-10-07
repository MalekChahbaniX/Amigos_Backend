// Script to create test course providers
const mongoose = require('mongoose');
const Provider = require('../models/Provider');
const path = require('path');

// Load .env from the BACKEND directory
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const testCourses = [
  {
    name: 'Monoprix Centre Ville',
    type: 'course',
    phone: '+21620123456',
    address: 'Avenue Habib Bourguiba, Tunis',
    email: 'monoprix.tunis@email.com',
    description: 'Supermarché moderne avec tous vos produits essentiels',
    location: {
      latitude: 36.8065,
      longitude: 10.1815,
      address: 'Centre ville de Tunis'
    },
    status: 'active'
  },
  {
    name: 'Dragstore A',
    type: 'course',
    phone: '+21620765432',
    address: 'Rue de la Liberté, Sfax',
    email: 'dragstore.sfax@email.com',
    description: 'Magasin de proximité avec produits frais',
    location: {
      latitude: 34.7398,
      longitude: 10.7600,
      address: 'Centre ville de Sfax'
    },
    status: 'active'
  },
  {
    name: 'Dragstore B',
    type: 'course',
    phone: '+21620987654',
    address: 'Avenue de France, Sousse',
    email: 'dragstore.sousse@email.com',
    description: 'Supermarché avec parking et large sélection',
    location: {
      latitude: 35.8256,
      longitude: 10.6410,
      address: 'Centre ville de Sousse'
    },
    status: 'active'
  },
  {
    name: 'Bricola',
    type: 'course',
    phone: '+21620345678',
    address: 'Zone Industrielle, Charguia',
    email: 'bricola.tunis@email.com',
    description: 'Spécialiste en bricolage et matériaux de construction',
    location: {
      latitude: 36.8320,
      longitude: 10.1950,
      address: 'Zone industrielle Charguia'
    },
    status: 'active'
  },
  {
    name: 'Magasin Général',
    type: 'course',
    phone: '+21620567890',
    address: 'Route Nationale 1, Bizerte',
    email: 'magasin.bizert@email.com',
    description: 'Tout pour la maison et le jardin',
    location: {
      latitude: 37.2746,
      longitude: 9.8739,
      address: 'Centre ville de Bizerte'
    },
    status: 'active'
  }
];

async function createTestCourses() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing courses
    await Provider.deleteMany({ type: 'course' });
    console.log('🗑️ Cleared existing courses');

    // Create new test courses
    const createdCourses = await Provider.insertMany(testCourses);
    console.log(`✅ Created ${createdCourses.length} test courses:`);

    createdCourses.forEach((course, index) => {
      console.log(`${index + 1}. ${course.name} - ${course.address}`);
    });

    console.log('\n🎉 Test courses created successfully!');
    console.log('You can now test the mobile app CoursesScreen');

  } catch (error) {
    console.error('❌ Error creating test courses:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Connection closed');
  }
}

// Run the script
createTestCourses();