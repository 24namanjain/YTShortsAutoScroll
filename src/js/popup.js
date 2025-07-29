// popup.js
// Handles the settings UI for the extension (enable/disable, only auto-scroll when tab is focused)
// Syncs settings with chrome.storage and sends updates to the content script in real time.

document.addEventListener('DOMContentLoaded', () => {
  /**
   * Get references to toggle elements in the popup UI.
   * @type {HTMLInputElement}
   */
  const enableToggle = document.getElementById('enableToggle');
  const focusToggle = document.getElementById('focusToggle');
  const hoverToggle = document.getElementById('hoverToggle');
  const commentsToggle = document.getElementById('commentsToggle');

  /**
   * Loads extension settings from chrome.storage and updates the popup UI toggles.
   * @function
   */
  function loadSettings() {
    chrome.storage.sync.get({ 
      enabled: true, 
      onlyWhenFocused: false, 
      pauseOnHover: true, 
      pauseOnComments: true 
    }, (data) => {
      enableToggle.checked = data.enabled;
      focusToggle.checked = data.onlyWhenFocused;
      hoverToggle.checked = data.pauseOnHover;
      commentsToggle.checked = data.pauseOnComments;
    });
  }
  loadSettings();

  /**
   * Handles the enable/disable toggle change event.
   * Updates chrome.storage and notifies the content script.
   * @function
   */
  function onEnableToggleChange() {
    const enabled = enableToggle.checked;
    chrome.storage.sync.set({ enabled });
    // Notify content script to update immediately
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_ENABLED', enabled });
      }
    });
  }
  enableToggle.addEventListener('change', onEnableToggleChange);

  /**
   * Handles the "only auto-scroll when tab is focused" toggle change event.
   * Updates chrome.storage and notifies the content script.
   * @function
   */
  function onFocusToggleChange() {
    const onlyWhenFocused = focusToggle.checked;
    chrome.storage.sync.set({ onlyWhenFocused });
    // Notify content script to update immediately
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_ONLY_WHEN_FOCUSED', onlyWhenFocused });
      }
    });
  }
  focusToggle.addEventListener('change', onFocusToggleChange);

  /**
   * Handles the "pause auto-scroll on hover" toggle change event.
   * Updates chrome.storage and notifies the content script.
   * @function
   */
  function onHoverToggleChange() {
    const pauseOnHover = hoverToggle.checked;
    chrome.storage.sync.set({ pauseOnHover });
    // Notify content script to update immediately
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_PAUSE_ON_HOVER', pauseOnHover });
      }
    });
  }
  hoverToggle.addEventListener('change', onHoverToggleChange);

  /**
   * Handles the "pause auto-scroll when comments panel is open" toggle change event.
   * Updates chrome.storage and notifies the content script.
   * @function
   */
  function onCommentsToggleChange() {
    const pauseOnComments = commentsToggle.checked;
    chrome.storage.sync.set({ pauseOnComments });
    // Notify content script to update immediately
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_PAUSE_ON_COMMENTS', pauseOnComments });
      }
    });
  }
  commentsToggle.addEventListener('change', onCommentsToggleChange);
}); 