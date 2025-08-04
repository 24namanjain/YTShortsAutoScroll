# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2025-08-03

### Fixed
- Fixed auto-scroll not triggering next video due to conditional video change check
- Improved ad-blocker skip handling to prevent double-skipping when ads are skipped
- Enhanced video change detection with better timing and fallback mechanisms
- Added comprehensive debugging for easier troubleshooting
- Prevented double-skipping when ads or ad-blockers skip a short

### Changed
- Removed conditional video change check that was preventing next button clicks
- Added 500ms delay before scrollToNextShort to let ad-blockers finish their work
- Improved skipInProgress flag management for better state handling
- Enhanced console logging for better debugging experience
- Major code refactor for readability: grouped logic, clarified comments, and improved sectioning
- Refactored settings object to `userPreferences` for clarity
- Improved modularization and internal documentation

### Added
- Persistent pause toasts: "Pause on hover" and "Pause for comments" toasts now remain visible until the pause condition is cleared
- Double-skip prevention: Handles ad-blocker/user skips to avoid skipping two shorts at once
- Debug utilities for manual testing

## [1.1.0] - 2025-07-23

### Added
- Arrow key comments control: Use ←/→ to open/close comments panel
- Info section in popup with tips and features
- Version display in popup UI
- Enhanced UI styling with better dark mode support

### Changed
- Updated version to 1.1.0 across all files
- Improved popup UI with better organization and styling
- Enhanced CSS with better responsive design

## [1.0.0] - 2025-07-23

### Added
- Initial release of YouTube Shorts Auto-Scroller
- Auto-scroll functionality when videos end or progress bar completes
- Pause on hover functionality
- Pause when tab is not focused
- Pause when comments panel is open
- Toast notifications for user feedback
- Material Design popup UI
- Chrome Storage API integration
- MutationObserver for DOM detection
- Service worker background script 
