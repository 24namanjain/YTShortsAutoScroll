// popup.js
// Handles the settings UI for the extension (enable/disable, only auto-scroll when tab is focused)
// Syncs settings with chrome.storage and sends updates to the content script in real time.

document.addEventListener('DOMContentLoaded', () => {
  const enableToggle = document.getElementById('enableToggle');
  const focusToggle = document.getElementById('focusToggle');
  const hoverToggle = document.getElementById('hoverToggle');
  const commentsToggle = document.getElementById('commentsToggle');

  // Load settings from chrome.storage and update UI
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

  // Enable/disable auto-scroll immediately on switch
  enableToggle.addEventListener('change', () => {
    const enabled = enableToggle.checked;
    chrome.storage.sync.set({ enabled });
    // Notify content script to update immediately
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_ENABLED', enabled });
      }
    });
  });

  // Toggle "only auto-scroll when tab is focused" immediately on switch
  focusToggle.addEventListener('change', () => {
    const onlyWhenFocused = focusToggle.checked;
    chrome.storage.sync.set({ onlyWhenFocused });
    // Notify content script to update immediately
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_ONLY_WHEN_FOCUSED', onlyWhenFocused });
      }
    });
  });

  // Toggle "pause auto-scroll on hover" immediately on switch
  hoverToggle.addEventListener('change', () => {
    const pauseOnHover = hoverToggle.checked;
    chrome.storage.sync.set({ pauseOnHover });
    // Notify content script to update immediately
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_PAUSE_ON_HOVER', pauseOnHover });
      }
    });
  });

  // Toggle "pause auto-scroll when comments panel is open" immediately on switch
  commentsToggle.addEventListener('change', () => {
    const pauseOnComments = commentsToggle.checked;
    chrome.storage.sync.set({ pauseOnComments });
    // Notify content script to update immediately
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_PAUSE_ON_COMMENTS', pauseOnComments });
      }
    });
  });
}); 