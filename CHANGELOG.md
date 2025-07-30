# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-07-23

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


## [1.2.0] - 2025-07-30

### Added
- Persistent pause toasts: "Pause on hover" and "Pause for comments" toasts now remain visible until the pause condition is cleared
- Double-skip prevention: Handles ad-blocker/user skips to avoid skipping two shorts at once
- Debug utilities for manual testing

### Changed
- Major code refactor for readability: grouped logic, clarified comments, and improved sectioning
- Refactored settings object to `userPreferences` for clarity
- Improved modularization and internal documentation

### Fixed
- Prevented double-skipping when ads or ad-blockers skip a short
- Minor bug fixes and UI consistency improvements