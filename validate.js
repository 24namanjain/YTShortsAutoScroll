#!/usr/bin/env node

/**
 * Validation script for YouTube Shorts Auto-Scroller
 * Checks all files and paths for Chrome Web Store readiness
 */

const fs = require('fs');

console.log('🔍 Validating YouTube Shorts Auto-Scroller for Chrome Web Store...\n');

// Required files for Chrome Web Store
const requiredFiles = [
  'manifest.json',
  'src/js/background.js',
  'src/js/content.js',
  'src/js/popup.js',
  'src/css/popup.css',
  'src/html/popup.html',
  'assets/icons/autoplay_16dp_E3E3E3_FILL0_wght400_GRAD0_opsz20.png',
  'assets/icons/autoplay_48dp_E3E3E3_FILL0_wght400_GRAD0_opsz48.png',
  'assets/icons/autoplay_128dp_E3E3E3_FILL0_wght400_GRAD0_opsz48.png'
];

// Required files for open source
const openSourceFiles = [
  'README.md',
  'LICENSE',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'PRIVACY.md',
  '.gitignore',
  'package.json'
];

// Check required files
console.log('📁 Checking required files...');
let allFilesExist = true;

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

console.log('\n📚 Checking open source files...');
openSourceFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

// Validate manifest.json
console.log('\n🔧 Validating manifest.json...');
try {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  
  // Check required manifest fields
  const requiredFields = ['manifest_version', 'name', 'version', 'description'];
  requiredFields.forEach(field => {
    if (manifest[field]) {
      console.log(`✅ ${field}: ${manifest[field]}`);
    } else {
      console.log(`❌ ${field} - MISSING`);
      allFilesExist = false;
    }
  });
  
  // Check manifest version
  if (manifest.manifest_version === 3) {
    console.log('✅ Manifest V3 compliant');
  } else {
    console.log('❌ Must use Manifest V3 for Chrome Web Store');
    allFilesExist = false;
  }
  
  // Check icon paths
  if (manifest.action && manifest.action.default_icon) {
    console.log('✅ Icons configured');
  } else {
    console.log('❌ Icons not configured');
    allFilesExist = false;
  }
  
} catch (error) {
  console.log('❌ manifest.json is invalid JSON');
  allFilesExist = false;
}

// Check file sizes
console.log('\n📊 Checking file sizes...');
const maxSize = 10 * 1024 * 1024; // 10MB limit for Chrome Web Store
let totalSize = 0;

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const stats = fs.statSync(file);
    totalSize += stats.size;
    const sizeKB = (stats.size / 1024).toFixed(1);
    console.log(`📄 ${file}: ${sizeKB}KB`);
  }
});

console.log(`📦 Total size: ${(totalSize / 1024 / 1024).toFixed(1)}MB`);

if (totalSize > maxSize) {
  console.log('⚠️  Total size exceeds 10MB limit');
  allFilesExist = false;
} else {
  console.log('✅ Size within limits');
}

// Final validation
console.log('\n🎯 Final Validation Results:');
if (allFilesExist) {
  console.log('✅ READY for Chrome Web Store and open source!');
  console.log('\n📋 Next steps:');
  console.log('1. Update package.json with your details');
  console.log('2. Create GitHub repository');
  console.log('3. Take screenshots for Chrome Web Store');
  console.log('4. Submit to Chrome Web Store');
  console.log('5. Publish as open source');
} else {
  console.log('❌ Issues found - please fix before publishing');
}

console.log('\n🚀 Happy publishing!'); 