// == YouTube Shorts Auto-Scroll Content Script ==
// ----------------------------------------------
// Main features:
//   - Auto-scrolls to the next Short when the current one ends or the progress bar is full
//   - Pauses on hover, tab unfocus, or comments panel open
//   - Keyboard shortcuts for comments panel (←/→)
//   - Toast notifications for user feedback
//   - Settings sync with popup UI

// == 1. USER SETTINGS & STATE ==

/**
 * == User Preferences ==
 * Controlled by popup UI and chrome.storage. Update both here and in popup for new settings.
 */
const userPreferences = {
  enabled: true,              // Auto-scroll enabled
  onlyWhenFocused: false,     // Only auto-scroll when tab is focused
  pauseOnHover: true,         // Pause auto-scroll on hover
  pauseOnComments: true,      // Pause when comments panel is open
  enableArrowComments: true   // Enable ←/→ to open/close comments
};

// == Internal State ==
let lastVideoSrc = null;           // Current video src
let endedListener = null;          // Video ended event listener
let progressInterval = null;       // Progress bar polling interval
let videoEndPoll = null;           // Video end polling interval
let isPausedByHover = false;       // Pause state for hover
let isPausedByFocus = false;       // Pause state for tab focus
let hoverHandlers = { video: null, toast: null }; // Hover event handler refs
let skipInProgress = false;        // Prevent double-skipping

// == Debug Utilities ==
window._ytShortsAutoScrollDebug = {
  getSettings: () => ({ ...userPreferences }),
  setSetting: (key, value) => { userPreferences[key] = value; },
  observeShort
};

// == Settings Sync & Validation ==
const defaultSettings = { ...userPreferences };

function validateAndApplySettings(data) {
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
    console.log('[YTShortAutoScroll] Loading settings from storage:', data);
    validateAndApplySettings(data);
    console.log('[YTShortAutoScroll] Settings after validation:', { ...userPreferences });
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
    console.log('[YTShortAutoScroll] Received UPDATE_SETTINGS message:', msg);
    // Only update if changed
    for (const key in defaultSettings) {
      if (typeof msg[key] !== 'undefined' && userPreferences[key] !== msg[key]) {
        console.log('[YTShortAutoScroll] Updating setting:', key, 'from', userPreferences[key], 'to', msg[key]);
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

  return { pause, resume, isPaused, setupHoverPause };
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
    console.log('[YTShortAutoScroll] Arrow key pressed:', e.key, 'enableArrowComments:', userPreferences.enableArrowComments);
    if (!userPreferences.enableArrowComments) {
      console.log('[YTShortAutoScroll] Arrow comments disabled, ignoring key press');
      return;
    }
    // Ignore if typing in input/textarea or using modifier keys
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.ctrlKey || e.altKey || e.metaKey) {
      console.log('[YTShortAutoScroll] Ignoring key press in input/textarea or with modifier keys');
      return;
    }
    // Right Arrow: Open comments
    if (e.key === 'ArrowRight') {
      console.log('[YTShortAutoScroll] Right arrow pressed, checking if comments panel is open');
      if (!isCommentsPanelOpen()) {
        console.log('[YTShortAutoScroll] Comments panel not open, trying to find comments button');
        // Try multiple selectors for comments button
        const possibleSelectors = [
          '#comments-button button',
          'button[aria-label^="View"][aria-label$="comments"]',
          'button[aria-label="Comments"]',
          'button[aria-label="Show comments"]',
          'button[aria-label*="comment"]',
          'button[aria-label*="Comment"]',
          'ytd-button-renderer[aria-label*="comment"]',
          'ytd-button-renderer[aria-label*="Comment"]'
        ];
        
        let commentsBtn = null;
        for (const selector of possibleSelectors) {
          const found = document.querySelector(selector);
          if (found) {
            console.log('[YTShortAutoScroll] Found comments button with selector:', selector, found);
            commentsBtn = found;
            break;
          }
        }
        
        if (commentsBtn) {
          console.log('[YTShortAutoScroll] Comments button found, clicking:', commentsBtn);
          commentsBtn.click();
          Toast.show('💬 Opening comments...', 2000);
        } else {
          console.log('[YTShortAutoScroll] Comments button not found with any selector');
          // Log all buttons on the page for debugging
          const allButtons = document.querySelectorAll('button');
          console.log('[YTShortAutoScroll] All buttons on page:', Array.from(allButtons).map(b => ({
            ariaLabel: b.getAttribute('aria-label'),
            id: b.id,
            className: b.className,
            text: b.textContent.trim()
          })));
          Toast.show('❓ Comments button not found', 2000);
        }
      } else {
        console.log('[YTShortAutoScroll] Comments panel already open');
      }
    }
    // Left Arrow: Close comments
    if (e.key === 'ArrowLeft') {
      console.log('[YTShortAutoScroll] Left arrow pressed, checking if comments panel is open');
      if (isCommentsPanelOpen()) {
        console.log('[YTShortAutoScroll] Comments panel is open, trying to find close button');
        // Try multiple selectors for close button
        const possibleCloseSelectors = [
          'ytd-engagement-panel-section-list-renderer[shorts-panel][visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"] button[aria-label="Close"]',
          '#comments-button button',
          'button[aria-label^="View"][aria-label$="comments"]',
          'button[aria-label="Comments"]',
          'button[aria-label="Show comments"]',
          'button[aria-label="Hide comments"]',
          'button[aria-label="Close comments"]',
          'button[aria-label*="close"]',
          'button[aria-label*="Close"]'
        ];
        
        let closeBtn = null;
        for (const selector of possibleCloseSelectors) {
          const found = document.querySelector(selector);
          if (found) {
            console.log('[YTShortAutoScroll] Found close button with selector:', selector, found);
            closeBtn = found;
            break;
          }
        }
        
        if (closeBtn) {
          console.log('[YTShortAutoScroll] Close button found, clicking:', closeBtn);
          closeBtn.click();
          Toast.show('❌ Closing comments...', 2000);
        } else {
          console.log('[YTShortAutoScroll] Close button not found with any selector');
          Toast.show('❓ Close button not found', 2000);
        }
      } else {
        console.log('[YTShortAutoScroll] Comments panel not open');
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
  
  // Check if this is a new video
  if (!force && !isNewVideo(video)) {
    console.log('[YTShortAutoScroll] Same video, skipping setup.');
    return;
  }
  
  console.log('[YTShortAutoScroll] New video detected, setting up observer.');
  
  // Update tracking variables
  lastVideoSrc = video.src;
  skipInProgress = false; // Reset skip flag for new video

  // Clean up previous listeners and intervals
  cleanupCurrentVideo();

  // Handler to move to next short and cleanup
  const moveNext = (reason) => {
    console.log('[YTShortAutoScroll] moveNext called with reason:', reason);
    if (skipInProgress) {
      console.log('[YTShortAutoScroll] Skip already in progress, ignoring moveNext.');
      return;
    }
    console.log('[YTShortAutoScroll] Setting skipInProgress to true');
    skipInProgress = true;
    if (endedListener) {
      video.removeEventListener('ended', endedListener);
      endedListener = null;
      console.log('[YTShortAutoScroll] Removed ended event listener');
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
      console.log('[YTShortAutoScroll] Auto-scroll not paused, calling scrollToNextShort');
      // Add a small delay to let ad-blockers finish their work
      setTimeout(() => {
        scrollToNextShort();
      }, 500);
    } else {
      console.log('[YTShortAutoScroll] Auto-scroll paused, skipping scrollToNextShort. Pause reasons:', {
        isPausedByHover,
        isPausedByFocus,
        pauseOnComments: userPreferences.pauseOnComments,
        isCommentsPanelOpen: isCommentsPanelOpen()
      });
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
    if (PauseResume.isPaused()) {
      console.log('[YTShortAutoScroll] Auto-scroll paused, skipping progress check');
      return;
    }
    const played = document.querySelector('.ytProgressBarLineProgressBarPlayed');
    if (played) {
      const width = parseFloat(played.style.width);
      console.log('[YTShortAutoScroll] Progress bar width:', width, 'target: >= 99');
      if (!isNaN(width) && width >= 99) {
        console.log('[YTShortAutoScroll] Progress bar at or above 99%, moving to next short.');
        moveNext('progress bar');
      }
    } else {
      console.log('[YTShortAutoScroll] Progress bar element not found');
      // Try alternative selectors
      const altSelectors = [
        '.ytProgressBarLineProgressBarPlayed',
        '[class*="progress"]',
        '[class*="Progress"]',
        '.ytp-progress-bar .ytp-play-progress'
      ];
      for (const selector of altSelectors) {
        const found = document.querySelector(selector);
        if (found) {
          console.log('[YTShortAutoScroll] Found progress bar with selector:', selector, found);
          break;
        }
      }
    }
  }, 500);

  // Fallback: Poll for video end (in case 'ended' event is missed)
  videoEndPoll = setInterval(() => {
    if (PauseResume.isPaused()) {
      console.log('[YTShortAutoScroll] Auto-scroll paused, skipping video end poll');
      return;
    }
    if (video.duration && video.currentTime) {
      const timeLeft = video.duration - video.currentTime;
      console.log('[YTShortAutoScroll] Video time left:', timeLeft, 'seconds, target: < 0.5');
      if (timeLeft < 0.5) {
        console.log('[YTShortAutoScroll] Video end detected by polling, moving to next short.');
        moveNext('video end poll');
      }
    } else {
      console.log('[YTShortAutoScroll] Video duration or currentTime not available:', {
        duration: video.duration,
        currentTime: video.currentTime
      });
    }
    
    // Check if video has changed unexpectedly (ad-blocker skip)
    if (shouldSkipDueToAdBlocker()) {
      console.log('[YTShortAutoScroll] Unexpected video change detected, likely ad-blocker skip');
      skipInProgress = false;
      setTimeout(() => {
        observeShort(true);
      }, 1000);
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
  const commentsPanel = document.querySelector('ytd-engagement-panel-section-list-renderer[shorts-panel][visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"]');
  const isOpen = !!commentsPanel;
  console.log('[YTShortAutoScroll] Checking if comments panel is open:', isOpen, commentsPanel);
  return isOpen;
}

// --- Main Scroll Logic ---
/**
 * Attempts to click the Next button to move to the next Short.
 * Waits for comments panel to close if needed, and shows a toast notification.
 * Retries for up to 6 seconds if the button is not found.
 */
function scrollToNextShort() {
  console.log('[YTShortAutoScroll] scrollToNextShort called.');
  let attempts = 0;
  const maxAttempts = 15; // Increased from 12 to 15 attempts
  let waitingForComments = false;

  // Tries to find and click the Next button, or waits for comments panel to close.
  function tryClick() {
    console.log('[YTShortAutoScroll] tryClick attempt:', attempts + 1);
    
    // Check if ad-blocker has already advanced the video
    if (shouldSkipDueToAdBlocker()) {
      console.log('[YTShortAutoScroll] Ad-blocker detected, skipping manual click and re-attaching listeners');
      skipInProgress = false;
      setTimeout(() => {
        observeShort(true);
      }, 1000);
      return;
    }
    
    if (userPreferences.pauseOnComments && isCommentsPanelOpen()) {
      if (!waitingForComments) {
        console.log('[YTShortAutoScroll] Comments panel open, pausing auto-scroll');
        PauseResume.pause('comments');
        waitingForComments = true;
      }
      setTimeout(tryClick, 500);
      return;
    } else if (waitingForComments) {
      // Comments panel just closed
      console.log('[YTShortAutoScroll] Comments panel just closed');
      waitingForComments = false;
      Toast.hide();
    }
    
    // Try multiple selectors for the navigation button - be more specific to avoid interfering with keyboard navigation
    const navDown = document.getElementById('navigation-button-down') || 
                   document.querySelector('[data-a11y-order="2"]') ||
                   document.querySelector('button[aria-label="Next video"]')?.closest('[data-a11y-order]');
    
    if (!navDown) {
      console.log(`[YTShortAutoScroll] Attempt ${attempts + 1}: Navigation button not found.`);
      // Log all elements with data-a11y-order for debugging
      const allA11yElements = document.querySelectorAll('[data-a11y-order]');
      console.log('[YTShortAutoScroll] All elements with data-a11y-order:', Array.from(allA11yElements).map(el => ({
        order: el.getAttribute('data-a11y-order'),
        tagName: el.tagName,
        ariaLabel: el.getAttribute('aria-label')
      })));
    } else {
      console.log(`[YTShortAutoScroll] Attempt ${attempts + 1}: Navigation button found:`, navDown);
      const btn = navDown.querySelector('button[aria-label="Next video"]') || 
                 navDown.querySelector('button');
      
      if (btn) {
        console.log('[YTShortAutoScroll] Next button found:', btn);
        const prevSrc = lastVideoSrc;
        const video = document.querySelector('video');
        
        // Always click the button to ensure next video is triggered
        console.log('[YTShortAutoScroll] Next button found, clicking:', btn);
        Toast.show('🚀 Zooming to the next Short!', 2000);
        setTimeout(() => {
          btn.click();
          console.log('[YTShortAutoScroll] Moved to next short. Will re-attach listeners.');
          setTimeout(() => {
            Toast.hide();
            observeShort(true);
          }, 1000); // Wait for next video to load and hide toast
        }, 1000); // 1 second delay before moving to next
        return;
      } else {
        const allBtns = Array.from(navDown.querySelectorAll('button'));
        console.log('[YTShortAutoScroll] No button found. Buttons inside navigation:', allBtns.map(b => ({
          ariaLabel: b.getAttribute('aria-label'),
          text: b.textContent.trim(),
          className: b.className
        })));
      }
    }
    if (++attempts < maxAttempts) {
      setTimeout(tryClick, 500);
    } else {
      console.log('[YTShortAutoScroll] Next button not found after retries.');
      Toast.show('❌ Could not find next button');
      setTimeout(() => Toast.hide(), 2000);
    }
  }
  tryClick();
}


// == Toast Notification Module ==
const Toast = (() => {
  // --- Helper: Set all toast styles ---
  function applyToastStyles(toast) {
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '32px',
      right: '32px',
      left: 'auto',
      transform: 'none',
      minWidth: '180px',
      maxWidth: '70vw',
      padding: '12px 28px',
      borderRadius: '18px',
      fontSize: '1em',
      fontWeight: '500',
      letterSpacing: '0.01em',
      zIndex: '99999',
      boxShadow: '0 6px 32px 0 rgba(31, 38, 135, 0.18)',
      backdropFilter: 'blur(18px) saturate(180%)',
      webkitBackdropFilter: 'blur(18px) saturate(180%)',
      display: 'block',
      transition: 'opacity 0.3s cubic-bezier(.4,0,.2,1)',
      opacity: '0',
      pointerEvents: 'none',
      background: 'var(--yt-short-autoscroll-toast-bg, rgba(255,255,255,0.38))',
      color: 'var(--yt-short-autoscroll-toast-fg, #222)',
      border: '1.5px solid var(--yt-short-autoscroll-toast-border, rgba(255,255,255,0.45))'
    });
  }

  // --- Helper: Adapt toast to theme ---
  function adaptToastTheme(toast) {
    const setTheme = () => {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      toast.style.setProperty('--yt-short-autoscroll-toast-bg', isDark ? 'rgba(30,32,40,0.38)' : 'rgba(255,255,255,0.38)');
      toast.style.setProperty('--yt-short-autoscroll-toast-fg', isDark ? '#fff' : '#23272f');
      toast.style.setProperty('--yt-short-autoscroll-toast-border', isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.45)');
    };
    setTheme();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', setTheme);
  }

  /**
   * Show a toast message in the bottom right of the screen.
   * @param {string} message - The message to display.
   * @param {number} [timeout] - Optional timeout in ms to auto-hide the toast.
   */
  function show(message, timeout) {
    let toast = document.getElementById('yt-short-autoscroll-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'yt-short-autoscroll-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      applyToastStyles(toast);
      document.body.appendChild(toast);
      adaptToastTheme(toast);
    }
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.opacity = '1'; }, 10);
    if (typeof timeout === 'number' && timeout > 0) {
      setTimeout(hide, timeout);
    }
  }

  /**
   * Hide the toast notification if it is visible.
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
  const observer = new MutationObserver((mutations) => {
    // Check if any mutations are relevant to video changes
    const hasRelevantChanges = mutations.some(mutation => {
      return mutation.type === 'childList' && 
             (mutation.target.tagName === 'YTD-REEL-VIDEO-RENDERER' ||
              mutation.addedNodes.length > 0 ||
              mutation.removedNodes.length > 0);
    });
    
    if (hasRelevantChanges) {
      console.log('[YTShortAutoScroll] DOM changes detected, re-observing short.');
      setTimeout(() => observeShort(true), 100); // Small delay to ensure DOM is stable
    }
  });
  
  observer.observe(shortsArea, { 
    childList: true, 
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'href']
  });
  
  // Initial call
  observeShort(true);
}

// Helper functions for video detection
function isNewVideo(video) {
  if (!video) return false;
  const currentSrc = video.src;
  if (currentSrc !== lastVideoSrc) {
    console.log('[YTShortAutoScroll] Video src changed:', lastVideoSrc, '->', currentSrc);
    // Reset skipInProgress when a new video is detected
    skipInProgress = false;
    return true;
  }
  return false;
}

// Helper function to check if we should skip due to ad-blocker
function shouldSkipDueToAdBlocker() {
  const video = document.querySelector('video');
  if (!video || !lastVideoSrc) return false;
  
  // If the video src has changed, it might be due to ad-blocker
  if (video.src !== lastVideoSrc) {
    console.log('[YTShortAutoScroll] Video changed, likely due to ad-blocker');
    return true;
  }
  return false;
}

function cleanupCurrentVideo() {
  console.log('[YTShortAutoScroll] Cleaning up current video');
  if (endedListener && lastVideoSrc) {
    const video = document.querySelector('video');
    if (video) video.removeEventListener('ended', endedListener);
    endedListener = null;
  }
  if (progressInterval) { 
    clearInterval(progressInterval); 
    progressInterval = null; 
  }
  if (videoEndPoll) { 
    clearInterval(videoEndPoll); 
    videoEndPoll = null; 
  }
  lastVideoSrc = null;
}

window.setupShortsMutationObserver = setupShortsMutationObserver;
setupShortsMutationObserver(); 