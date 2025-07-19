# Project Structure

```
YTShortAutoScroll/
├── 📁 src/                          # Source code directory
│   ├── 📁 js/                       # JavaScript files
│   │   ├── background.js            # Service worker (Manifest V3)
│   │   ├── content.js               # Main content script
│   │   └── popup.js                 # Popup logic
│   ├── 📁 css/                      # Stylesheets
│   │   └── popup.css                # Popup styles (Material Design)
│   └── 📁 html/                     # HTML files
│       └── popup.html               # Popup UI
├── 📁 assets/                       # Static assets
│   └── 📁 icons/                    # Extension icons
│       ├── autoplay_16dp_*.png      # 16x16 toolbar icon
│       ├── autoplay_48dp_*.png      # 48x48 store icon
│       └── autoplay_128dp_*.png     # 128x128 store icon
├── 📄 manifest.json                 # Chrome extension manifest
├── 📄 README.md                     # Project documentation
├── 📄 LICENSE                       # MIT License
├── 📄 CHANGELOG.md                  # Version history
├── 📄 CONTRIBUTING.md               # Contribution guidelines
├── 📄 PRIVACY.md                    # Privacy policy
├── 📄 package.json                  # Project metadata
├── 📄 .gitignore                    # Git ignore rules
├── 📄 store-listing.md              # Chrome Web Store listing
├── 📄 validate.js                   # Validation script
└── 📄 PROJECT_STRUCTURE.md          # This file
```

## File Descriptions

### Core Extension Files
- **manifest.json**: Chrome extension configuration (Manifest V3)
- **src/js/content.js**: Main logic for auto-scrolling YouTube Shorts
- **src/js/popup.js**: Popup UI logic and settings management
- **src/js/background.js**: Service worker for Manifest V3 compliance
- **src/html/popup.html**: Popup UI markup
- **src/css/popup.css**: Material Design styles for popup

### Documentation
- **README.md**: Main project documentation with features and installation
- **LICENSE**: MIT License for open source
- **CHANGELOG.md**: Version history and release notes
- **CONTRIBUTING.md**: Guidelines for contributors
- **PRIVACY.md**: Privacy policy for Chrome Web Store

### Assets
- **assets/icons/**: Extension icons in required sizes (16x16, 48x48, 128x128)

### Development
- **package.json**: Project metadata and scripts
- **.gitignore**: Git ignore patterns
- **validate.js**: Validation script for Chrome Web Store readiness
- **store-listing.md**: Chrome Web Store listing template

## Key Features

### Auto-Scroll Logic (content.js)
- Detects video end events
- Monitors progress bar completion
- Handles YouTube's dynamic DOM
- Smart pause on hover and tab focus
- Comments panel detection

### UI Components (popup.js/css/html)
- Material Design switches
- Settings persistence
- Real-time messaging with content script
- Responsive design

### Chrome Integration
- Manifest V3 compliance
- Service worker background script
- Content script injection
- Chrome storage API usage

## Development Workflow

1. **Local Testing**: Load unpacked extension in Chrome
2. **Validation**: Run `node validate.js` to check readiness
3. **Publishing**: Submit to Chrome Web Store and GitHub 