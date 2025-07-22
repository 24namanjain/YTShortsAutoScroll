# Project Requirements: YTShortsFlow

## 1. User-Facing Requirements
- Auto-scrolls to the next YouTube Short when the current one ends or progress bar completes
- Option to enable/disable auto-scroll
- Option to pause auto-scroll when:
  - Hovering over the video or toast (toggleable)
  - Comments panel is open (toggleable)
  - Tab is not focused (toggleable)
- Glassy, modern popup UI with logo and Material-style switches
- Fun, non-intrusive toast notifications for actions and pause states
- Popup and toasts must support dark and light mode
- All settings must persist and sync across browser sessions
- Extension must work on all YouTube Shorts pages

## 2. Chrome/Store Requirements
- Manifest V3 compliance
- Only request minimal permissions: `storage`, and host permissions for Shorts
- Provide 16x16, 48x48, 128x128 icons
- Include a privacy policy (no data collection)
- README, LICENSE, and store listing documentation
- Pass Chrome Web Store validation (no errors/warnings)

## 3. Non-Functional Requirements
- Responsive and visually appealing UI
- No performance impact on YouTube Shorts
- No memory leaks (clean up all listeners/intervals)
- Code must be modular, maintainable, and well-commented
- Open source (MIT License)
- Documentation for users and developers 

## 4. Demo Samples
- Sample demo videos and screenshots are stored in the `samples/` directory:
  - `samples/mp4/ytshortsflow-demo-1.mov`, `ytshortsflow-demo-2.mov`
  - `samples/png/ytshortsflow-popup.png`, `ytshortsflow-autoscroll.png`
- Use these for documentation, GitHub, and Chrome Web Store listing. 