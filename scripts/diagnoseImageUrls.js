/**
 * Diagnostic script to check image URL status in database
 * and verify which images are accessible
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Provider = require('../models/Provider');
const fetch = require('node-fetch');

async function diagnoseImageUrls() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected to MongoDB\n');

    const providers = await Provider.find({
      $or: [
        { image: { $exists: true, $ne: null } },
        { profileImage: { $exists: true, $ne: null } }
      ]
    }).limit(10);

    console.log(`Found ${providers.length} providers with images\n`);

    const results = {
      http: 0,
      https: 0,
      relative: 0,
      malformed: 0,
      accessible: 0,
      inaccessible: 0
    };

    for (const provider of providers) {
      const url = provider.image || provider.profileImage;
      if (!url) continue;

      console.log(`\nProvider: ${provider.name}`);
      console.log(`  URL: ${url}`);

      // Categorize
      if (url.startsWith('http://')) {
        results.http++;
        console.log(`  ⚠️  HTTP URL (needs HTTPS conversion)`);
      } else if (url.startsWith('https://')) {
        results.https++;
        console.log(`  ✓ HTTPS URL`);
      } else if (url.startsWith('/')) {
        results.relative++;
        console.log(`  ℹ️  Relative path`);
      } else {
        results.malformed++;
        console.log(`  ❌ Malformed URL`);
      }

      // Check accessibility (for production URLs only)
      if (url.startsWith('https://')) {
        try {
          const response = await fetch(url, { method: 'HEAD', timeout: 5000 });
          if (response.ok) {
            results.accessible++;
            console.log(`  ✓ Accessible (${response.status})`);
          } else {
            results.inaccessible++;
            console.log(`  ❌ Inaccessible (${response.status})`);
          }
        } catch (error) {
          results.inaccessible++;
          console.log(`  ❌ Error: ${error.message}`);
        }
      }
    }

    console.log('\n\n=== SUMMARY ===');
    console.log(`HTTP URLs: ${results.http}`);
    console.log(`HTTPS URLs: ${results.https}`);
    console.log(`Relative paths: ${results.relative}`);
    console.log(`Malformed: ${results.malformed}`);
    console.log(`Accessible: ${results.accessible}`);
    console.log(`Inaccessible: ${results.inaccessible}`);

    if (results.http > 0) {
      console.log('\n⚠️  ACTION NEEDED: Run migration to convert HTTP URLs to HTTPS');
      console.log('   npm run migrate:images');
    }

    if (results.inaccessible > 0) {
      console.log('\n⚠️  ACTION NEEDED: Upload files are missing from production server');
      console.log('   Check that files exist in BACKEND/uploads/ directory');
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

diagnoseImageUrls();
