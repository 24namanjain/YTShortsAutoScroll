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

// Check for double-skip prevention logic in content.js
console.log('\n🔎 Checking for double-skip prevention logic in content.js...');
try {
  const contentJs = fs.readFileSync('src/js/content.js', 'utf8');
  if (contentJs.includes('skipInProgress') && contentJs.match(/skipInProgress\s*=\s*false/) && contentJs.match(/skipInProgress\s*=\s*true/)) {
    console.log('✅ Double-skip prevention logic detected (skipInProgress flag found)');
  } else {
    console.log('⚠️  Double-skip prevention logic NOT detected! Please ensure skipInProgress flag and related logic are present.');
    allFilesExist = false;
  }
} catch (e) {
  console.log('⚠️  Could not read src/js/content.js to check for double-skip prevention logic.');
  allFilesExist = false;
}


// Check for forbidden APIs in JS files
console.log('\n🔒 Scanning for forbidden APIs in JS files...');
const forbiddenPatterns = [
  /eval\s*\(/,
  /new\s+Function\s*\(/,
  /setTimeout\s*\(\s*['"]/,
  /setInterval\s*\(\s*['"]/,
  /importScripts\s*\(/,
  /XMLHttpRequest\s*\(/,
  /fetch\s*\(/,
  /\.src\s*=\s*['"]/,
  /document\.write\s*\(/,
  /script\.src\s*=\s*['"]/,
  /require\s*\(/,
  /chrome\.webRequest/,
  /chrome\.cookies/
];
const jsFiles = [
  'src/js/content.js',
  'src/js/popup.js',
  'src/js/background.js'
];
let forbiddenFound = false;
jsFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const code = fs.readFileSync(file, 'utf8');
    forbiddenPatterns.forEach(pattern => {
      if (pattern.test(code)) {
        console.log(`❌ Forbidden API detected in ${file}: ${pattern}`);
        forbiddenFound = true;
        allFilesExist = false;
      }
    });
  }
});
if (!forbiddenFound) {
  console.log('✅ No forbidden APIs found in JS files');
}

// Check icon sizes
console.log('\n🖼️  Checking icon sizes...');
const iconFiles = [
  { path: 'assets/icons/autoplay_16dp_E3E3E3_FILL0_wght400_GRAD0_opsz20.png', size: 16 },
  { path: 'assets/icons/autoplay_48dp_E3E3E3_FILL0_wght400_GRAD0_opsz48.png', size: 48 },
  { path: 'assets/icons/autoplay_128dp_E3E3E3_FILL0_wght400_GRAD0_opsz48.png', size: 128 }
];
const { createCanvas, loadImage } = (() => {
  try { return require('canvas'); } catch { return {}; }
})();
iconFiles.forEach(icon => {
  if (fs.existsSync(icon.path)) {
    try {
      if (loadImage) {
        loadImage(icon.path).then(img => {
          if (img.width !== icon.size || img.height !== icon.size) {
            console.log(`⚠️  Icon ${icon.path} is ${img.width}x${img.height}, expected ${icon.size}x${icon.size}`);
            allFilesExist = false;
          } else {
            console.log(`✅ Icon ${icon.path} is correct size (${icon.size}x${icon.size})`);
          }
        }).catch(() => {
          console.log(`⚠️  Could not load icon ${icon.path} to check size`);
        });
      } else {
        // canvas not installed, skip size check
        console.log(`ℹ️  Skipping icon size check for ${icon.path} (canvas module not installed)`);
      }
    } catch {
      console.log(`⚠️  Could not check icon size for ${icon.path}`);
    }
  } else {
    console.log(`❌ Icon file missing: ${icon.path}`);
    allFilesExist = false;
  }
});

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