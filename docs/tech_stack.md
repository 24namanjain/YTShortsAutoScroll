# Technical Stack & Methods (YTShortsFlow)

## 1. Technologies Used
- **Chrome Extension Manifest V3**
- **JavaScript (ES6+)**
- **HTML5/CSS3** (Material-inspired, glassy UI)
- **Chrome Storage API** (sync settings)
- **MutationObserver** (detect Shorts navigation)
- **Event Listeners** (video end, hover, focus, etc.)
- **Toast Notifications** (custom, adaptive to dark/light mode)

## 2. Key Methods & Patterns
- **Content Script**: Injected on Shorts pages, manages auto-scroll logic, DOM observation, and user interaction
- **Popup Script**: Handles UI, settings toggles, and syncs with storage
- **Background Script**: Minimal, for Manifest V3 compliance
- **Settings Sync**: Uses `chrome.storage.sync` for persistence and cross-device sync
- **Messaging**: Popup and content script communicate via `chrome.runtime.sendMessage`
- **MutationObserver**: Watches for DOM changes to re-attach logic on new Shorts
- **Robust Event Handling**: Cleans up all listeners/intervals to avoid memory leaks

## 3. UI/UX
- **Material-style switches**
- **Glassy, modern popup**
- **Logo and icons**
- **Responsive and accessible**

## 4. Privacy & Security
- No data collection or tracking
- Only runs on YouTube Shorts pages
- Minimal permissions
- Open source (MIT License) 