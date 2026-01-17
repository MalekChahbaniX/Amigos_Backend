/**
 * Migration script to rewrite provider image URLs from HTTP to HTTPS
 * Handles three cases:
 * 1. HTTP absolute URLs -> convert to HTTPS
 * 2. Old domain URLs -> rewrite to production domain
 * 3. Relative paths -> keep as-is
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Import Provider model
const Provider = require('../models/Provider');

const PRODUCTION_DOMAIN = 'https://amigosdelivery25.com';
//const PRODUCTION_DOMAIN = 'http://192.168.1.104:5000';

async function migrateImagesToHttps() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find all providers with image URLs
    const providers = await Provider.find({
      $or: [
        { image: { $exists: true, $ne: null } },
        { profileImage: { $exists: true, $ne: null } }
      ]
    });

    console.log(`Found ${providers.length} providers with images`);

    let updatedCount = 0;
    const updates = [];

    for (const provider of providers) {
      let updated = false;
      const updateFields = {};

      // Migrate image field
      if (provider.image) {
        const normalizedImage = normalizeUrl(provider.image);
        if (normalizedImage !== provider.image) {
          updateFields.image = normalizedImage;
          updated = true;
          console.log(`Provider ${provider._id}: image ${provider.image} -> ${normalizedImage}`);
        }
      }

      // Migrate profileImage field
      if (provider.profileImage) {
        const normalizedProfileImage = normalizeUrl(provider.profileImage);
        if (normalizedProfileImage !== provider.profileImage) {
          updateFields.profileImage = normalizedProfileImage;
          updated = true;
          console.log(`Provider ${provider._id}: profileImage ${provider.profileImage} -> ${normalizedProfileImage}`);
        }
      }

      if (updated) {
        updates.push({
          updateOne: {
            filter: { _id: provider._id },
            update: { $set: updateFields }
          }
        });
        updatedCount++;
      }
    }

    // Execute bulk updates
    if (updates.length > 0) {
      const result = await Provider.bulkWrite(updates);
      console.log(`\nMigration completed!`);
      console.log(`Updated ${result.modifiedCount} providers`);
      console.log(`Upserted ${result.upsertedCount} providers`);
    } else {
      console.log('\nNo providers needed migration');
    }

  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

/**
 * Normalize image URL to HTTPS
 * - Converts HTTP to HTTPS
 * - Rewrites old domains to production domain
 * - Keeps relative paths as-is
 */
function normalizeUrl(url) {
  if (!url) return url;

  // If it's already HTTPS, return as-is (but check for old domain)
  if (url.startsWith('https://')) {
    // Rewrite old domains to production domain
    if (!url.includes('amigosdelivery25.com') && !url.includes('localhost')) {
      const relativePath = url.split('.com')[1] || url;
      return `${PRODUCTION_DOMAIN}${relativePath}`;
    }
    return url;
  }

  // If it's HTTP, convert to HTTPS
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }

  // If it's a relative path, return as-is
  if (url.startsWith('/')) {
    return url;
  }

  // Default: assume it's relative and prepend HTTPS domain
  return `${PRODUCTION_DOMAIN}/${url}`;
}

// Run migration
migrateImagesToHttps().catch(console.error);
