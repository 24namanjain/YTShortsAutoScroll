# Developer Guide: YTShortsFlow

## 1. Local Setup
- Clone the repository
- Run `npm install` (if you add dev tools)
- Load the extension in Chrome:
  1. Go to `chrome://extensions`
  2. Enable Developer Mode
  3. Click 'Load unpacked' and select the project root
- Make changes in `src/` and `assets/` as needed
- Reload the extension and refresh YouTube Shorts to test changes

## 2. Contributing
- Fork the repo and create a feature branch
- Follow the code style (ES6+, modular, well-commented)
- Test all features before submitting a PR
- Write clear commit messages
- Update documentation if needed

## 3. Testing
- Test on multiple YouTube Shorts videos
- Test all toggles in the popup
- Test in both dark and light mode
- Check for console errors or warnings
- Run `node validate.js` before submitting

## 4. Code Style
- Use ES6+ features
- Keep logic modular (separate files for content, popup, background)
- Use clear variable/function names
- Add comments for complex logic
- Remove debug logs before release

## 5. Support
- Open an issue for bugs or feature requests
- See `CONTRIBUTING.md` for more details 