# Contributing to YTShortsFlow

> By contributing, you agree your contributions are licensed under the same CC BY-NC 4.0 license.

Thank you for your interest in contributing to this project! 🎉

## Getting Started

1. **Fork** the repository
2. **Clone** your fork locally
3. **Create** a feature branch: `git checkout -b feature/amazing-feature`
4. **Make** your changes
5. **Test** your changes thoroughly
6. **Commit** your changes: `git commit -m 'Add amazing feature'`
7. **Push** to your branch: `git push origin feature/amazing-feature`
8. **Open** a Pull Request

## Development Setup

### Prerequisites
- Chrome browser
- Basic knowledge of JavaScript and Chrome Extensions

### Local Development
1. Clone the repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the project folder
5. Make changes and reload the extension

### Project Structure
```
├── src/
│   ├── js/
│   │   ├── content.js      # Main content script
│   │   ├── popup.js        # Popup logic
│   │   └── background.js   # Service worker
│   ├── css/
│   │   └── popup.css       # Popup styles
│   └── html/
│       └── popup.html      # Popup UI
├── assets/
│   └── icons/              # Extension icons
├── manifest.json           # Extension manifest
└── README.md              # Project documentation
```

## Code Style

- Use **ES6+** JavaScript features
- Follow **Chrome Extension Manifest V3** guidelines
- Write **clear, descriptive** commit messages
- Add **comments** for complex logic
- Test on **YouTube Shorts** pages

## Testing

Before submitting a PR, please test:
- ✅ Auto-scroll functionality
- ✅ Pause on hover
- ✅ Tab focus detection
- ✅ Comments panel detection
- ✅ Settings persistence
- ✅ Toast notifications
- ✅ Popup UI functionality

## Feature Requests

Have an idea? Open an issue and describe:
- What the feature should do
- Why it would be useful
- Any implementation ideas

## Bug Reports

Found a bug? Please include:
- Steps to reproduce
- Expected vs actual behavior
- Browser version and OS
- Any error messages

## Questions?

Feel free to open an issue for any questions about contributing!

---

**Happy coding! 🚀** 