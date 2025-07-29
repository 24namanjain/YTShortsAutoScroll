// YouTube Shorts Auto-Scroll Content Script
// -----------------------------------------
// This script auto-scrolls to the next YouTube Short when the current one ends or the progress bar is full.
// It supports pausing on hover, only auto-scrolling when the tab is focused, and respects the comments panel.
// Fun toast notifications are shown for user feedback.

// --- State Variables ---
let timer = null; // (legacy, not used)
let enabled = true; // Whether auto-scroll is enabled
let lastVideoSrc = null; // Track the current video by src
let endedListener = null; // Reference to the video ended event listener
let progressInterval = null; // Interval for polling the progress bar
let videoEndPoll = null; // Interval for polling video end
let onlyWhenFocused = false; // User setting: only auto-scroll when tab is focused
let pauseOnHover = true; // User setting: pause auto-scroll on hover
let pauseOnComments = true; // User setting: pause auto-scroll when comments panel is open
let isPausedByHover = false; // Pause state for hover
let isPausedByFocus = false; // Pause state for tab focus

// --- Hover Event Handler References ---
let hoverHandlers = { video: null, toast: null };

// --- Settings Sync and Messaging ---
// Listen for messages from the popup to enable/disable and update settings
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'TOGGLE_ENABLED') {
    enabled = msg.enabled;
    console.log('[YTShortAutoScroll] Received TOGGLE_ENABLED:', enabled);
    if (!enabled) {
      // Stop all timers, listeners, and intervals
      if (endedListener && lastVideoSrc) {
        const video = document.querySelector('video');
        if (video) video.removeEventListener('ended', endedListener);
        endedListener = null;
      }
      if (progressInterval) { clearInterval(progressInterval); progressInterval = null; }
      if (videoEndPoll) { clearInterval(videoEndPoll); videoEndPoll = null; }
      console.log('[YTShortAutoScroll] Auto-scroll disabled.');
    } else {
      observeShort(true);
      console.log('[YTShortAutoScroll] Auto-scroll enabled.');
    }
  }
  if (msg.type === 'UPDATE_SETTINGS') {
    enabled = msg.enabled;
    onlyWhenFocused = msg.onlyWhenFocused;
    pauseOnHover = msg.pauseOnHover;
    pauseOnComments = msg.pauseOnComments;
    
    // If hover pause is disabled, clear any existing hover pause
    if (!pauseOnHover && isPausedByHover) {
      isPausedByHover = false;
      if (!isAutoScrollPaused()) {
        hideToast();
      }
    }
    
    if (enabled) {
      observeShort(true);
      console.log('[YTShortAutoScroll] Settings updated and auto-scroll enabled.');
    } else {
      if (endedListener && lastVideoSrc) {
        const video = document.querySelector('video');
        if (video) video.removeEventListener('ended', endedListener);
        endedListener = null;
      }
      if (progressInterval) { clearInterval(progressInterval); progressInterval = null; }
      if (videoEndPoll) { clearInterval(videoEndPoll); videoEndPoll = null; }
      console.log('[YTShortAutoScroll] Settings updated and auto-scroll disabled.');
    }
  }
  if (msg.type === 'TOGGLE_ONLY_WHEN_FOCUSED') {
    onlyWhenFocused = msg.onlyWhenFocused;
    console.log('[YTShortAutoScroll] Received TOGGLE_ONLY_WHEN_FOCUSED:', onlyWhenFocused);
  }
  if (msg.type === 'TOGGLE_PAUSE_ON_HOVER') {
    pauseOnHover = msg.pauseOnHover;
    console.log('[YTShortAutoScroll] Received TOGGLE_PAUSE_ON_HOVER:', pauseOnHover);
    // If hover pause is disabled, clear any existing hover pause
    if (!pauseOnHover && isPausedByHover) {
      isPausedByHover = false;
      if (!isAutoScrollPaused()) {
        hideToast();
      }
    }
    setupHoverPause();
  }
  if (msg.type === 'TOGGLE_PAUSE_ON_COMMENTS') {
    pauseOnComments = msg.pauseOnComments;
    console.log('[YTShortAutoScroll] Received TOGGLE_PAUSE_ON_COMMENTS:', pauseOnComments);
  }
});

// Load settings from storage on script load
chrome.storage.sync.get({ 
  enabled: true,
  onlyWhenFocused: false, 
  pauseOnHover: true, 
  pauseOnComments: true 
}, (data) => {
  enabled = data.enabled;
  onlyWhenFocused = data.onlyWhenFocused;
  pauseOnHover = data.pauseOnHover;
  pauseOnComments = data.pauseOnComments;
  
  // If enabled, start observing
  if (enabled) {
    observeShort(true);
  }
});

// --- Pause/Resume Logic ---

/**
 * Pauses auto-scroll for a given reason (hover, focus, or comments).
 * Shows a toast notification for the pause reason.
 * @param {('hover'|'focus'|'comments')} reason - The reason for pausing auto-scroll.
 */
function pauseAutoScroll(reason) {
  if (reason === 'hover') {
    if (pauseOnHover) {
      isPausedByHover = true;
      showToast('⏸️ Auto-scroll paused while hovering', 2000);
    }
  } else if (reason === 'focus') {
    isPausedByFocus = true;
    showToast('⏸️ Auto-scroll paused (tab not focused)', 2000);
  } else if (reason === 'comments') {
    showToast('⏸️ Waiting for comments panel to close...', 2000);
  }
}

/**
 * Resumes auto-scroll for a given reason (hover or focus).
 * Hides the toast if no pause reason is active.
 * @param {('hover'|'focus')} reason - The reason for resuming auto-scroll.
 */
function resumeAutoScroll(reason) {
  if (reason === 'hover') {
    isPausedByHover = false;
  } else if (reason === 'focus') {
    isPausedByFocus = false;
  }
  // Only hide the toast if no pause reason is active
  if (!isAutoScrollPaused()) {
    hideToast();
  } else {
    showToast('⏸️ Auto-scroll paused, click to resume', 2000);
  }
}

/**
 * Returns whether auto-scroll is currently paused for any reason.
 * @returns {boolean} True if paused by hover or focus, false otherwise.
 */
function isAutoScrollPaused() {
  return isPausedByHover || isPausedByFocus;
}

/**
 * Shows a pause toast for the current pause reason.
 */
function showPauseToast() {
  if (isPausedByHover) {
    showToast('⏸️ Auto-scroll paused while hovering', 2000);
  } else if (isPausedByFocus) {
    showToast('⏸️ Auto-scroll paused (tab not focused)', 2000);
  }
}

/**
 * Attaches hover listeners to the video and toast to pause/resume auto-scroll on hover.
 * Removes previous listeners before attaching new ones.
 */
function setupHoverPause() {
  const video = document.querySelector('video');
  let toast = document.getElementById('yt-short-autoscroll-toast');

  // Remove previous listeners if any
  if (hoverHandlers.video && video) {
    video.removeEventListener('mouseenter', hoverHandlers.video.mouseenter);
    video.removeEventListener('mouseleave', hoverHandlers.video.mouseleave);
  }
  if (hoverHandlers.toast && toast) {
    toast.removeEventListener('mouseenter', hoverHandlers.toast.mouseenter);
    toast.removeEventListener('mouseleave', hoverHandlers.toast.mouseleave);
  }

  if (!pauseOnHover) {
    hoverHandlers = { video: null, toast: null };
    return;
  }

  // Define handlers
  const videoEnter = () => { pauseAutoScroll('hover'); };
  const videoLeave = () => { resumeAutoScroll('hover'); };
  const toastEnter = () => { pauseAutoScroll('hover'); };
  const toastLeave = () => { resumeAutoScroll('hover'); };

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

// Pause when tab is not focused (if enabled)
window.addEventListener('blur', () => {
  if (onlyWhenFocused) pauseAutoScroll('focus');
});
window.addEventListener('focus', () => {
  if (onlyWhenFocused) resumeAutoScroll('focus');
});

// --- Keyboard Arrow Event for Comments Panel ---
(function setupArrowKeyCommentsControl() {
  document.addEventListener('keydown', function(e) {
    // Ignore if typing in input/textarea or using modifier keys
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.ctrlKey || e.altKey || e.metaKey) return;
    // Right Arrow: Open comments
    if (e.key === 'ArrowRight') {
      if (!isCommentsPanelOpen()) {
        // Try to find and click the comments button
        let commentsBtn = document.querySelector('#comments-button button');
        if (!commentsBtn) {
          commentsBtn = document.querySelector('button[aria-label^="View"][aria-label$="comments"]');
        }
        if (!commentsBtn) {
          commentsBtn = document.querySelector('button[aria-label="Comments"], button[aria-label="Show comments"]');
        }
        if (commentsBtn) {
          commentsBtn.click();
          showToast('💬 Opening comments...', 2000);
        } else {
          showToast('❓ Comments button not found', 2000);
        }
      }
    }
    // Left Arrow: Close comments
    if (e.key === 'ArrowLeft') {
      if (isCommentsPanelOpen()) {
        // Try to find and click the close button in the comments panel
        let closeBtn = document.querySelector('ytd-engagement-panel-section-list-renderer[shorts-panel][visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"] button[aria-label="Close"]');
        if (!closeBtn) {
          // Fallback: try clicking the comments button again if it toggles
          closeBtn = document.querySelector('#comments-button button');
        }
        if (!closeBtn) {
          closeBtn = document.querySelector('button[aria-label^="View"][aria-label$="comments"]');
        }
        if (!closeBtn) {
          closeBtn = document.querySelector('button[aria-label="Comments"], button[aria-label="Show comments"]');
        }
        if (closeBtn) {
          closeBtn.click();
          showToast('❌ Closing comments...', 2000);
        } else {
          showToast('❓ Close button not found', 2000);
        }
      }
    }
  }, true);
})();

// --- Main Observer Logic ---

/**
 * Observes the Shorts video and attaches event listeners for auto-scroll.
 * Cleans up previous listeners and intervals, and sets up new ones for the current video.
 * @param {boolean} [force=false] - If true, always re-attach listeners even if the video src hasn't changed.
 */
function observeShort(force = false) {
  const video = document.querySelector('video');
  if (!video) {
    console.log('[YTShortAutoScroll] No video element found.');
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
  /**
   * Moves to the next Short and cleans up listeners/intervals.
   * @param {string} reason - The reason for moving to the next Short.
   */
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
    if (!isAutoScrollPaused()) {
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
    if (isAutoScrollPaused()) {
      console.log('[YTShortAutoScroll] Progress bar polling paused.');
      return;
    }
    const played = document.querySelector('.ytProgressBarLineProgressBarPlayed');
    if (played) {
      const widthStr = played.style.width;
      const width = parseFloat(widthStr);
      if (!isNaN(width)) {
        if (width >= 99) {
          console.log('[YTShortAutoScroll] Progress bar at or above 99%, moving to next short.');
          moveNext('progress bar');
        }
      }
    }
  }, 500);

  // Fallback: Poll for video end (in case 'ended' event is missed)
  videoEndPoll = setInterval(() => {
    if (isAutoScrollPaused()) {
      console.log('[YTShortAutoScroll] Video end polling paused.');
      return;
    }
    if (video.duration && video.currentTime && (video.duration - video.currentTime < 0.5)) {
      console.log('[YTShortAutoScroll] Video end detected by polling, moving to next short.');
      moveNext('video end poll');
    }
  }, 500);

  setupHoverPause(); // Attach hover pause listeners after all timers/intervals are set up
}

// --- Comments Panel Detection ---

/**
 * Returns true if the comments panel is currently open in Shorts view.
 * @returns {boolean} True if comments panel is open, false otherwise.
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

  /**
   * Tries to find and click the Next button, or waits for comments panel to close.
   */
  function tryClick() {
    if (pauseOnComments && isCommentsPanelOpen()) {
      if (!waitingForComments) {
        pauseAutoScroll('comments');
        waitingForComments = true;
      }
      setTimeout(tryClick, 500);
      return;
    } else if (waitingForComments) {
      // Comments panel just closed
      waitingForComments = false;
      hideToast();
    }
    const navDown = document.getElementById('navigation-button-down');
    if (!navDown) {
      console.log(`[YTShortAutoScroll] Attempt ${attempts + 1}: #navigation-button-down not found.`);
    } else {
      console.log(`[YTShortAutoScroll] Attempt ${attempts + 1}: #navigation-button-down found.`);
      const btn = navDown.querySelector('button[aria-label="Next video"]');
      if (btn) {
        console.log('[YTShortAutoScroll] Next button found, clicking:', btn);
        showToast('🚀 Zooming to the next Short!', 2000);
        setTimeout(() => {
          btn.click();
          console.log('[YTShortAutoScroll] Moved to next short. Will re-attach listeners.');
          setTimeout(() => {
            hideToast();
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

// --- Toast Notification ---

/**
 * Shows a toast message in the bottom right of the screen.
 * Creates the toast element if it doesn't exist, and adapts to light/dark theme.
 * @param {string} message - The message to display in the toast.
 * @param {number} [timeout] - Optional timeout in ms to auto-hide the toast.
 */
function showToast(message, timeout) {
  let toast = document.getElementById('yt-short-autoscroll-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'yt-short-autoscroll-toast';
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
    setTimeout(() => { hideToast(); }, timeout);
  }
}

/**
 * Hides the toast notification if it is visible.
 */
function hideToast() {
  const toast = document.getElementById('yt-short-autoscroll-toast');
  if (toast) {
    toast.style.opacity = '0';
    setTimeout(() => { toast.style.display = 'none'; }, 350);
  }
}

// --- Shorts Container Observer ---

/**
 * Observes the Shorts area for navigation changes and attaches observers to new videos.
 * Uses a MutationObserver to detect navigation and re-attach listeners as needed.
 */
function setupShortsMutationObserver() {
  const shortsArea = document.querySelector('ytd-reel-video-renderer')?.parentElement || document.querySelector('ytd-reel-video-renderer') || document.body;
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
setupShortsMutationObserver();