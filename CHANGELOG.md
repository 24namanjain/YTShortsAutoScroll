# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-12-19

### Added
- Initial release of YouTube Shorts Auto-Scroller
- Auto-scroll functionality when videos end or progress bar completes
- Smart pause on hover and tab focus
- Comments panel detection and pause
- Material Design popup UI with settings
- Toast notifications for user feedback
- Chrome storage for settings persistence
- Manifest V3 compliance
- Responsive design with glassy UI elements

### Features
- 🎬 Smart auto-scroll to next Short
- ⏸️ Pause on hover functionality
- 👁️ Tab focus awareness
- 💬 Comments panel detection
- 🎨 Beautiful Material Design UI
- 🔄 Real-time settings sync
- 🎪 Fun toast notifications

### Technical
- Chrome Extension Manifest V3
- Content script injection
- MutationObserver for DOM detection
- Chrome Storage API integration
- Service worker background script 

## [1.1.0] - 2025-05-29

### Added
- Keyboard shortcuts: Right arrow opens comments, Left arrow closes comments
- Parameterized toast duration (showToast now accepts a timeout)
- Improved comments button detection for YouTube Shorts

### Changed
- Updated manifest and package version to 1.1.0 