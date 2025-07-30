// YouTube Shorts Auto-Scroll Content Script
// -----------------------------------------
// This script auto-scrolls to the next YouTube Short when the current one ends or the progress bar is full.
// It supports pausing on hover, only auto-scrolling when the tab is focused, and respects the comments panel.
// Fun toast notifications are shown for user feedback.

/**
 * UI-Controllable State Variables
 * These are controlled by the popup UI and chrome.storage. If you add a new setting,
 * update both this object and the popup UI.
 *
 * @property {boolean} enabled - Whether auto-scroll is enabled
 * @property {boolean} onlyWhenFocused - Only auto-scroll when tab is focused
 * @property {boolean} pauseOnHover - Pause auto-scroll on hover
 * @property {boolean} pauseOnComments - Pause auto-scroll when comments panel is open
 * @property {boolean} enableArrowComments - Enable ⬅️/➡️ to open/close comments
 */
const userPreferences = {
  enabled: true,
  onlyWhenFocused: false,
  pauseOnHover: true,
  pauseOnComments: true,
  enableArrowComments: true
};

// --- Internal State Variables ---
let lastVideoSrc = null;           // Current video src
let endedListener = null;          // Video ended event listener reference
let progressInterval = null;       // Progress bar polling interval
let videoEndPoll = null;           // Video end polling interval
let isPausedByHover = false;       // True if paused by hover
let isPausedByFocus = false;       // True if paused by tab focus
let hoverHandlers = { video: null, toast: null }; // Hover event handler references

// --- Debug Utilities (for manual testing) ---
window._ytShortsAutoScrollDebug = {
  getSettings: () => ({ ...userPreferences }),
  setSetting: (key, value) => { userPreferences[key] = value; },
  observeShort
};

// --- Settings Sync and Messaging ---

// --- Centralized Settings Update and Validation ---
const defaultSettings = { ...userPreferences };

function validateAndApplySettings(data) {
  // Runtime validation for settings
  for (const key in defaultSettings) {
    if (typeof data[key] !== typeof defaultSettings[key]) {
      console.warn(`[YTShortAutoScroll] Invalid type for setting '${key}', using default:`, defaultSettings[key]);
      userPreferences[key] = defaultSettings[key];
    } else {
      userPreferences[key] = data[key];
    }
  }
}

function updateSettingsFromStorage(callback) {
  chrome.storage.sync.get(defaultSettings, (data) => {
    validateAndApplySettings(data);
    if (typeof callback === 'function') callback();
    if (userPreferences.enabled) observeShort(true);
  });
}

// Listen for messages from the popup to update settings
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  let changed = false;
  if (msg.type === 'TOGGLE_ENABLED') {
    if (userPreferences.enabled !== msg.enabled) changed = true;
    userPreferences.enabled = msg.enabled;
    console.log('[YTShortAutoScroll] Received TOGGLE_ENABLED:', userPreferences.enabled);
    if (!userPreferences.enabled) {
      stopAllObservers();
      console.log('[YTShortAutoScroll] Auto-scroll disabled.');
    } else {
      observeShort(true);
      console.log('[YTShortAutoScroll] Auto-scroll enabled.');
    }
  }
  if (msg.type === 'UPDATE_SETTINGS') {
    // Only update if changed
    for (const key in defaultSettings) {
      if (typeof msg[key] !== 'undefined' && userPreferences[key] !== msg[key]) {
        userPreferences[key] = msg[key];
        changed = true;
      }
    }
    // If hover pause is disabled, clear any existing hover pause
    if (!userPreferences.pauseOnHover && isPausedByHover) {
      isPausedByHover = false;
      if (!PauseResume.isPaused()) Toast.hide();
    }
    if (userPreferences.enabled) {
      observeShort(true);
      console.log('[YTShortAutoScroll] Settings updated and auto-scroll enabled.');
    } else {
      stopAllObservers();
      console.log('[YTShortAutoScroll] Settings updated and auto-scroll disabled.');
    }
  }
  if (msg.type === 'TOGGLE_ONLY_WHEN_FOCUSED') {
    if (userPreferences.onlyWhenFocused !== msg.onlyWhenFocused) changed = true;
    userPreferences.onlyWhenFocused = msg.onlyWhenFocused;
    console.log('[YTShortAutoScroll] Received TOGGLE_ONLY_WHEN_FOCUSED:', userPreferences.onlyWhenFocused);
  }
  if (msg.type === 'TOGGLE_PAUSE_ON_HOVER') {
    if (userPreferences.pauseOnHover !== msg.pauseOnHover) changed = true;
    userPreferences.pauseOnHover = msg.pauseOnHover;
    console.log('[YTShortAutoScroll] Received TOGGLE_PAUSE_ON_HOVER:', userPreferences.pauseOnHover);
    // If hover pause is disabled, clear any existing hover pause
    if (!userPreferences.pauseOnHover && isPausedByHover) {
      isPausedByHover = false;
      if (!PauseResume.isPaused()) {
        Toast.hide();
      }
    }
    PauseResume.setupHoverPause();
  }
  if (msg.type === 'TOGGLE_PAUSE_ON_COMMENTS') {
    if (userPreferences.pauseOnComments !== msg.pauseOnComments) changed = true;
    userPreferences.pauseOnComments = msg.pauseOnComments;
    console.log('[YTShortAutoScroll] Received TOGGLE_PAUSE_ON_COMMENTS:', userPreferences.pauseOnComments);
  }
  // Optionally: log if settings changed
  if (changed) {
    console.log('[YTShortAutoScroll] Settings changed:', { ...userPreferences });
  }
});

function stopAllObservers() {
  if (endedListener && lastVideoSrc) {
    const video = document.querySelector('video');
    if (video) video.removeEventListener('ended', endedListener);
    endedListener = null;
  }
  if (progressInterval) { clearInterval(progressInterval); progressInterval = null; }
  if (videoEndPoll) { clearInterval(videoEndPoll); videoEndPoll = null; }
}

// Initial settings load
updateSettingsFromStorage();

// (No duplicate settings load; handled by updateSettingsFromStorage)


// --- Pause/Resume Logic Module ---
const PauseResume = (() => {
  // --- Helper for toast messages ---
  function getPauseToastMessage(reason) {
    switch (reason) {
      case 'hover': return '⏸️ Auto-scroll paused while hovering';
      case 'focus': return '⏸️ Auto-scroll paused (tab not focused)';
      case 'comments': return '⏸️ Waiting for comments panel to close...';
      case 'resume': return '⏸️ Auto-scroll paused, click to resume';
      default: return '';
    }
  }

  /**
   * Pauses auto-scroll for a given reason (hover, focus, or comments).
   * Shows a toast notification for the pause reason.
   * @param {('hover'|'focus'|'comments')} reason - The reason for pausing auto-scroll.
   */
  function pause(reason) {
    if (reason === 'hover' && userPreferences.pauseOnHover) {
      isPausedByHover = true;
      Toast.show(getPauseToastMessage('hover'));
    } else if (reason === 'focus') {
      isPausedByFocus = true;
      Toast.show(getPauseToastMessage('focus'), 2000);
    } else if (reason === 'comments') {
      Toast.show(getPauseToastMessage('comments'));
    }
  }

  /**
   * Resumes auto-scroll for a given reason (hover or focus).
   * Hides the toast if no pause reason is active.
   * @param {('hover'|'focus')} reason - The reason for resuming auto-scroll.
   */
  function resume(reason) {
    if (reason === 'hover') {
      isPausedByHover = false;
    } else if (reason === 'focus') {
      isPausedByFocus = false;
    }
    // Hide the toast if no pause reason is active
    if (!PauseResume.isPaused()) {
      Toast.hide();
    } else {
      Toast.show(getPauseToastMessage('resume'), 2000);
    }
  }

  /**
   * Returns whether auto-scroll is currently paused for any reason.
   * @returns {boolean} True if paused by hover or focus, false otherwise.
   */
  function isPaused() {
    return isPausedByHover || isPausedByFocus;
  }

  /**
   * Shows a pause toast for the current pause reason.
   * (No-op: This is now handled by pause() and resume() directly. Kept for API compatibility.)
   */
  function showPauseToast() {
    // No-op: handled by pause() and resume() to avoid duplicate toasts.
  }

  /**
   * Attaches hover listeners to the video and toast to pause/resume auto-scroll on hover.
   * Removes previous listeners before attaching new ones.
   */
  function setupHoverPause() {
    const video = document.querySelector('video');
    const toast = document.getElementById('yt-short-autoscroll-toast');

    // Remove previous listeners if any
    if (hoverHandlers.video && video) {
      video.removeEventListener('mouseenter', hoverHandlers.video.mouseenter);
      video.removeEventListener('mouseleave', hoverHandlers.video.mouseleave);
    }
    if (hoverHandlers.toast && toast) {
      toast.removeEventListener('mouseenter', hoverHandlers.toast.mouseenter);
      toast.removeEventListener('mouseleave', hoverHandlers.toast.mouseleave);
    }

    if (!userPreferences.pauseOnHover) {
      hoverHandlers = { video: null, toast: null };
      return;
    }

    // Define handlers
    const videoEnter = () => PauseResume.pause('hover');
    const videoLeave = () => PauseResume.resume('hover');
    const toastEnter = () => PauseResume.pause('hover');
    const toastLeave = () => PauseResume.resume('hover');

    if (video) {
      video.addEventListener('mouseenter', videoEnter);
      video.addEventListener('mouseleave', videoLeave);
      hoverHandlers.video = { mouseenter: videoEnter, mouseleave: videoLeave };
    }
    if (toast) {
      toast.addEventListener('mouseenter', toastEnter);
      toast.addEventListener('mouseleave', toastLeave);
      hoverHandlers.toast = { mouseenter: toastEnter, mouseleave: toastLeave };
    }
  }

  return { pause, resume, isPaused, showPauseToast, setupHoverPause };
})();

// --- Focus Pause Module ---
(function FocusPauseModule() {
  window.addEventListener('blur', () => {
    if (userPreferences.onlyWhenFocused) PauseResume.pause('focus');
  });
  window.addEventListener('focus', () => {
    if (userPreferences.onlyWhenFocused) PauseResume.resume('focus');
  });
})();

// --- Arrow Key Comments Control Module ---
(function ArrowKeyCommentsModule() {
  document.addEventListener('keydown', function(e) {
    if (!userPreferences.enableArrowComments) return;
    // Ignore if typing in input/textarea or using modifier keys
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.ctrlKey || e.altKey || e.metaKey) return;
    // Right Arrow: Open comments
    if (e.key === 'ArrowRight') {
      if (!isCommentsPanelOpen()) {
        // Try to find and click the comments button
        let commentsBtn = document.querySelector('#comments-button button')
          || document.querySelector('button[aria-label^="View"][aria-label$="comments"]')
          || document.querySelector('button[aria-label="Comments"], button[aria-label="Show comments"]');
        if (commentsBtn) {
          commentsBtn.click();
          Toast.show('💬 Opening comments...', 2000);
        } else {
          Toast.show('❓ Comments button not found', 2000);
        }
      }
    }
    // Left Arrow: Close comments
    if (e.key === 'ArrowLeft') {
      if (isCommentsPanelOpen()) {
        // Try to find and click the close button in the comments panel
        let closeBtn = document.querySelector('ytd-engagement-panel-section-list-renderer[shorts-panel][visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"] button[aria-label="Close"]')
          || document.querySelector('#comments-button button')
          || document.querySelector('button[aria-label^="View"][aria-label$="comments"]')
          || document.querySelector('button[aria-label="Comments"], button[aria-label="Show comments"]');
        if (closeBtn) {
          closeBtn.click();
          Toast.show('❌ Closing comments...', 2000);
        } else {
          Toast.show('❓ Close button not found', 2000);
        }
      }
    }
  }, true);
})();


// --- Main Observer Logic Module ---
function observeShort(force = false) {
  const video = document.querySelector('video');
  if (!video) {
    console.error('[YTShortAutoScroll] No video element found.');
    return;
  }
  // Use video src to detect new video
  if (!force && video.src === lastVideoSrc) {
    // Already observing this video, do nothing
    return;
  }
  console.log('[YTShortAutoScroll] New video detected, setting up observer.');
  lastVideoSrc = video.src;

  // Remove previous listeners and intervals
  if (endedListener) {
    video.removeEventListener('ended', endedListener);
    endedListener = null;
  }
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
    console.log('[YTShortAutoScroll] Cleared previous progress interval.');
  }
  if (videoEndPoll) {
    clearInterval(videoEndPoll);
    videoEndPoll = null;
    console.log('[YTShortAutoScroll] Cleared previous video end poll.');
  }

  // Handler to move to next short and cleanup
  const moveNext = (reason) => {
    if (endedListener) {
      video.removeEventListener('ended', endedListener);
      endedListener = null;
    }
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
      console.log('[YTShortAutoScroll] Cleared progress interval after', reason);
    }
    if (videoEndPoll) {
      clearInterval(videoEndPoll);
      videoEndPoll = null;
      console.log('[YTShortAutoScroll] Cleared video end poll after', reason);
    }
    if (!PauseResume.isPaused()) {
      scrollToNextShort();
    } else {
      console.log('[YTShortAutoScroll] Auto-scroll paused, skipping scrollToNextShort.');
    }
  };

  // Listen for video end event
  endedListener = () => {
    console.log('[YTShortAutoScroll] Video ended, calling scrollToNextShort.');
    moveNext('video ended');
  };
  video.addEventListener('ended', endedListener);
  console.log('[YTShortAutoScroll] Added ended event listener.');

  // Poll the progress bar for completion (width >= 99%)
  progressInterval = setInterval(() => {
    if (PauseResume.isPaused()) return;
    const played = document.querySelector('.ytProgressBarLineProgressBarPlayed');
    if (played) {
      const width = parseFloat(played.style.width);
      if (!isNaN(width) && width >= 99) {
        console.log('[YTShortAutoScroll] Progress bar at or above 99%, moving to next short.');
        moveNext('progress bar');
      }
    }
  }, 500);

  // Fallback: Poll for video end (in case 'ended' event is missed)
  videoEndPoll = setInterval(() => {
    if (PauseResume.isPaused()) return;
    if (video.duration && video.currentTime && (video.duration - video.currentTime < 0.5)) {
      console.log('[YTShortAutoScroll] Video end detected by polling, moving to next short.');
      moveNext('video end poll');
    }
  }, 500);

  PauseResume.setupHoverPause(); // Attach hover pause listeners after all timers/intervals are set up
}

// --- Comments Panel Detection ---
/**
 * Returns true if the comments panel is currently open in Shorts view.
 * @returns {boolean}
 */
function isCommentsPanelOpen() {
  return !!document.querySelector('ytd-engagement-panel-section-list-renderer[shorts-panel][visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"]');
}

// --- Main Scroll Logic ---
/**
 * Attempts to click the Next button to move to the next Short.
 * Waits for comments panel to close if needed, and shows a toast notification.
 * Retries for up to 6 seconds if the button is not found.
 */
function scrollToNextShort() {
  let attempts = 0;
  const maxAttempts = 12; // 12 * 500ms = 6 seconds
  let waitingForComments = false;

  // Tries to find and click the Next button, or waits for comments panel to close.
  function tryClick() {
    if (userPreferences.pauseOnComments && isCommentsPanelOpen()) {
      if (!waitingForComments) {
        PauseResume.pause('comments');
        waitingForComments = true;
      }
      setTimeout(tryClick, 500);
      return;
    } else if (waitingForComments) {
      // Comments panel just closed
      waitingForComments = false;
      Toast.hide();
    }
    const navDown = document.getElementById('navigation-button-down');
    if (!navDown) {
      console.log(`[YTShortAutoScroll] Attempt ${attempts + 1}: #navigation-button-down not found.`);
    } else {
      console.log(`[YTShortAutoScroll] Attempt ${attempts + 1}: #navigation-button-down found.`);
      const btn = navDown.querySelector('button[aria-label="Next video"]');
      if (btn) {
        console.log('[YTShortAutoScroll] Next button found, clicking:', btn);
        Toast.show('🚀 Zooming to the next Short!', 2000);
        setTimeout(() => {
          btn.click();
          console.log('[YTShortAutoScroll] Moved to next short. Will re-attach listeners.');
          setTimeout(() => {
            Toast.hide();
            console.log('[YTShortAutoScroll] Re-attaching listeners for new video.');
            observeShort();
          }, 1000); // Wait for next video to load and hide toast
        }, 1000); // 1 second delay before moving to next
        return;
      } else {
        const allBtns = Array.from(navDown.querySelectorAll('button'));
        console.log('[YTShortAutoScroll] No button[aria-label="Next video"] found. Buttons inside #navigation-button-down:', allBtns.map(b => b.outerHTML));
      }
    }
    if (++attempts < maxAttempts) {
      setTimeout(tryClick, 500);
    } else {
      console.log('[YTShortAutoScroll] Next button not found after retries.');
    }
  }
  console.log('[YTShortAutoScroll] scrollToNextShort called.');
  tryClick();
}


// --- Toast Notification Module (Accessible, Encapsulated) ---
const Toast = (() => {
  /**
   * Shows a toast message in the bottom right of the screen.
   * Creates the toast element if it doesn't exist, and adapts to light/dark theme.
   * @param {string} message - The message to display in the toast.
   * @param {number} [timeout] - Optional timeout in ms to auto-hide the toast.
   */
  function show(message, timeout) {
    let toast = document.getElementById('yt-short-autoscroll-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'yt-short-autoscroll-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      toast.style.position = 'fixed';
      toast.style.bottom = '32px';
      toast.style.right = '32px';
      toast.style.left = 'auto';
      toast.style.transform = 'none';
      toast.style.minWidth = '180px';
      toast.style.maxWidth = '70vw';
      toast.style.padding = '12px 28px';
      toast.style.borderRadius = '18px';
      toast.style.fontSize = '1em';
      toast.style.fontWeight = '500';
      toast.style.letterSpacing = '0.01em';
      toast.style.zIndex = '99999';
      toast.style.boxShadow = '0 6px 32px 0 rgba(31, 38, 135, 0.18)';
      toast.style.backdropFilter = 'blur(18px) saturate(180%)';
      toast.style.webkitBackdropFilter = 'blur(18px) saturate(180%)';
      toast.style.display = 'block';
      toast.style.transition = 'opacity 0.3s cubic-bezier(.4,0,.2,1)';
      toast.style.opacity = '0';
      toast.style.pointerEvents = 'none';
      toast.style.background = 'var(--yt-short-autoscroll-toast-bg, rgba(255,255,255,0.38))';
      toast.style.color = 'var(--yt-short-autoscroll-toast-fg, #222)';
      toast.style.border = '1.5px solid var(--yt-short-autoscroll-toast-border, rgba(255,255,255,0.45))';
      setTimeout(() => { toast.style.opacity = '1'; }, 10);
      document.body.appendChild(toast);
      // Theme adaptation
      const setTheme = () => {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        toast.style.setProperty('--yt-short-autoscroll-toast-bg', isDark ? 'rgba(30,32,40,0.38)' : 'rgba(255,255,255,0.38)');
        toast.style.setProperty('--yt-short-autoscroll-toast-fg', isDark ? '#fff' : '#23272f');
        toast.style.setProperty('--yt-short-autoscroll-toast-border', isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.45)');
      };
      setTheme();
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', setTheme);
    }
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.opacity = '1'; }, 10);
    if (typeof timeout === 'number' && timeout > 0) {
      setTimeout(hide, timeout);
    }
  }
  /**
   * Hides the toast notification if it is visible.
   */
  function hide() {
    const toast = document.getElementById('yt-short-autoscroll-toast');
    if (toast) {
      toast.style.opacity = '0';
      setTimeout(() => { toast.style.display = 'none'; }, 350);
    }
  }
  return { show, hide };
})();

// --- Shorts Container Observer ---
/**
 * Observes the Shorts area for navigation changes and attaches observers to new videos.
 * Uses a MutationObserver to detect navigation and re-attach listeners as needed.
 */
function setupShortsMutationObserver() {
  const shortsArea = document.querySelector('ytd-reel-video-renderer')?.parentElement
    || document.querySelector('ytd-reel-video-renderer')
    || document.body;
  if (!shortsArea) {
    console.log('[YTShortAutoScroll] Shorts area not found, retrying...');
    setTimeout(setupShortsMutationObserver, 1000);
    return;
  }
  console.log('[YTShortAutoScroll] Setting up MutationObserver on Shorts area.');
  const observer = new MutationObserver(() => {
    observeShort(true); // Always force re-attach
  });
  observer.observe(shortsArea, { childList: true, subtree: true });
  // Initial call
  observeShort(true);
}
window.setupShortsMutationObserver = setupShortsMutationObserver;
setupShortsMutationObserver();