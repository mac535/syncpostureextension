/**
 * PostureSync Content Script
 *
 * Injected into active browser tabs (http/https).
 * Implements 3 strictly independent intervention systems:
 * 1. Progressive Reversible Blur & Posture Alert (sustained poor posture)
 * 2. Prominent Red Alert for Low Blink Rate (reliable eye tracking & sustained low BPM)
 * 3. Screen-Session Break Reminder (elapsed session timer with Dismiss & Snooze)
 */

(() => {
  const OVERLAY_ID = 'posturesync-intervention-overlay';
  const POSTURE_PILL_ID = 'posturesync-intervention-pill';
  const BLINK_CARD_ID = 'posturesync-blink-card';
  const BREAK_CARD_ID = 'posturesync-break-card';
  const TRACKING_PILL_ID = 'posturesync-tracking-pill';

  let overlayElement: HTMLDivElement | null = null;
  let posturePillElement: HTMLDivElement | null = null;
  let blinkCardElement: HTMLDivElement | null = null;
  let breakCardElement: HTMLDivElement | null = null;
  let trackingPillElement: HTMLDivElement | null = null;

  let postureRemoveTimeout: number | null = null;
  let postureRecoveryTimeout: number | null = null;
  let trackingPillTimeout: number | null = null;
  let isPostureAlertActive = false;

  // ---------- 1. Page & Overlay Blur Helpers ----------
  function setPageBlur(blurPx: number): void {
    if (blurPx > 0) {
      document.documentElement.style.setProperty('--posturesync-blur-amount', `${blurPx}px`);
      document.documentElement.classList.add('posturesync-page-blurred');
    } else {
      document.documentElement.style.removeProperty('--posturesync-blur-amount');
      document.documentElement.classList.remove('posturesync-page-blurred');
    }
  }

  function setOverlayFilter(elem: HTMLDivElement | null, filterVal: string): void {
    if (!elem) return;
    elem.style.setProperty('backdrop-filter', filterVal, 'important');
    elem.style.setProperty('-webkit-backdrop-filter', filterVal, 'important');
  }

  // Synthesize gentle ergonomic chime (self-contained Web Audio API)
  function playAudioChime(): void {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const notes = [
        { freq: 659.25, start: 0.00, dur: 0.8 }, // E5
        { freq: 830.61, start: 0.08, dur: 0.9 }, // G#5
        { freq: 987.77, start: 0.16, dur: 1.0 }  // B5
      ];

      notes.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0.0001, now + start);
        gain.gain.linearRampToValueAtTime(0.12, now + start + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + dur + 0.05);
      });
    } catch {
      // Audio playback restrictions safely handled
    }
  }

  function getOrCreateOverlay(): HTMLDivElement {
    let elem = document.getElementById(OVERLAY_ID) as HTMLDivElement | null;
    if (!elem) {
      elem = document.createElement('div');
      elem.id = OVERLAY_ID;
      elem.setAttribute('aria-hidden', 'true');
      document.documentElement.appendChild(elem);
    }
    overlayElement = elem;
    return elem;
  }

  function getOrCreatePosturePill(): HTMLDivElement {
    let elem = document.getElementById(POSTURE_PILL_ID) as HTMLDivElement | null;
    if (!elem) {
      elem = document.createElement('div');
      elem.id = POSTURE_PILL_ID;

      const dot = document.createElement('span');
      dot.className = 'posturesync-pill-dot dot-level-1';
      dot.id = 'posturesync-pill-dot';

      const badge = document.createElement('span');
      badge.className = 'posturesync-pill-badge';
      badge.id = 'posturesync-pill-badge';

      const text = document.createElement('span');
      text.className = 'posturesync-pill-text';
      text.id = 'posturesync-pill-desc';

      const hint = document.createElement('span');
      hint.className = 'posturesync-pill-hint';
      hint.id = 'posturesync-pill-hint';
      hint.textContent = 'Sit upright to unblur';

      elem.appendChild(dot);
      elem.appendChild(badge);
      elem.appendChild(text);
      elem.appendChild(hint);

      document.documentElement.appendChild(elem);
    }
    posturePillElement = elem;
    return elem;
  }

  // ---------- 2. Progressive Posture Blur Engine ----------
  function applyProgressiveBlur(
    alertLevel: number,
    blurPx: number,
    message: string,
    soundEnabled?: boolean,
    isRecovering?: boolean
  ): void {
    if (postureRemoveTimeout !== null) {
      window.clearTimeout(postureRemoveTimeout);
      postureRemoveTimeout = null;
    }
    if (postureRecoveryTimeout !== null) {
      window.clearTimeout(postureRecoveryTimeout);
      postureRecoveryTimeout = null;
    }

    // 1. Handling Recovery Transition (User straightened up into good posture)
    if (isRecovering) {
      // Step down blur progressively: 2px blur for 1.2s, then 0px
      setPageBlur(2);
      if (overlayElement) {
        setOverlayFilter(overlayElement, 'blur(2px)');
      }

      const pill = getOrCreatePosturePill();
      pill.className = 'level-recovery posturesync-active';

      const dot = pill.querySelector('#posturesync-pill-dot');
      if (dot) dot.className = 'posturesync-pill-dot dot-recovery';

      const badge = pill.querySelector('#posturesync-pill-badge') as HTMLElement | null;
      if (badge) {
        badge.style.display = 'inline-block';
        badge.textContent = 'Good Posture';
      }

      const desc = pill.querySelector('#posturesync-pill-desc');
      if (desc) desc.textContent = message || 'Good job! Your posture looks better. Keep comfortable and relaxed.';

      const hint = pill.querySelector('#posturesync-pill-hint') as HTMLElement | null;
      if (hint) hint.textContent = 'Recovered';

      // After 1.2s, completely remove blur
      setTimeout(() => {
        setPageBlur(0);
        if (overlayElement) {
          setOverlayFilter(overlayElement, 'none');
          overlayElement.classList.remove('posturesync-active');
        }
      }, 1200);

      // After 3.2s, dismiss recovery pill
      postureRecoveryTimeout = window.setTimeout(() => {
        removePostureIntervention();
        postureRecoveryTimeout = null;
      }, 3200);

      isPostureAlertActive = false;
      return;
    }

    if (alertLevel <= 0) {
      removePostureIntervention();
      return;
    }

    // 2. Progressive Blur Application
    const effectiveBlur = Math.max(2, blurPx);

    // Apply direct CSS blur to page body via root class
    setPageBlur(effectiveBlur);

    // Also apply backdrop-filter on full viewport overlay
    const overlay = getOrCreateOverlay();
    setOverlayFilter(overlay, `blur(${effectiveBlur}px)`);
    void overlay.offsetWidth;
    overlay.classList.add('posturesync-active');

    // 3. Escalating Alert Notification Card
    const pill = getOrCreatePosturePill();
    pill.className = `level-${alertLevel} posturesync-active`;

    const dot = pill.querySelector('#posturesync-pill-dot');
    if (dot) dot.className = `posturesync-pill-dot dot-level-${alertLevel}`;

    const badge = pill.querySelector('#posturesync-pill-badge') as HTMLElement | null;
    if (badge) {
      badge.style.display = 'inline-block';
      badge.textContent = `Alert L${alertLevel} (${effectiveBlur}px blur)`;
    }

    const desc = pill.querySelector('#posturesync-pill-desc');
    if (desc) {
      desc.textContent = message || 'Please adjust your posture to clear the screen blur.';
    }

    const hint = pill.querySelector('#posturesync-pill-hint') as HTMLElement | null;
    if (hint) {
      hint.textContent = 'Sit upright to unblur';
    }

    // 4. Play audio chime on new alert trigger / escalation
    if (!isPostureAlertActive && soundEnabled !== false) {
      playAudioChime();
    }

    isPostureAlertActive = true;
  }

  function removePostureIntervention(): void {
    isPostureAlertActive = false;
    setPageBlur(0);

    if (overlayElement) {
      setOverlayFilter(overlayElement, 'none');
      overlayElement.classList.remove('posturesync-active');
    }
    if (posturePillElement) {
      posturePillElement.classList.remove('posturesync-active');
    }

    if (postureRemoveTimeout !== null) {
      window.clearTimeout(postureRemoveTimeout);
    }

    postureRemoveTimeout = window.setTimeout(() => {
      if (overlayElement && overlayElement.parentNode) {
        overlayElement.parentNode.removeChild(overlayElement);
        overlayElement = null;
      }
      if (posturePillElement && posturePillElement.parentNode) {
        posturePillElement.parentNode.removeChild(posturePillElement);
        posturePillElement = null;
      }
      postureRemoveTimeout = null;
    }, 450);
  }

  // ---------- 3. Dedicated Red Alert for Low Blink Rate ----------
  function getOrCreateBlinkCard(): HTMLDivElement {
    let elem = document.getElementById(BLINK_CARD_ID) as HTMLDivElement | null;
    if (!elem) {
      elem = document.createElement('div');
      elem.id = BLINK_CARD_ID;
      elem.setAttribute('role', 'alert');

      const header = document.createElement('div');
      header.className = 'posturesync-blink-header';

      const tag = document.createElement('div');
      tag.className = 'posturesync-blink-tag';

      const dot = document.createElement('span');
      dot.className = 'posturesync-pill-dot dot-level-3';

      const badgeText = document.createElement('span');
      badgeText.id = 'posturesync-blink-rate-badge';
      badgeText.textContent = 'LOW BLINK RATE DETECTED';

      tag.appendChild(dot);
      tag.appendChild(badgeText);

      const closeBtn = document.createElement('button');
      closeBtn.className = 'posturesync-card-close';
      closeBtn.textContent = 'Dismiss';
      closeBtn.setAttribute('aria-label', 'Dismiss low blink alert');
      closeBtn.onclick = () => {
        hideBlinkCard();
      };

      header.appendChild(tag);
      header.appendChild(closeBtn);

      const body = document.createElement('div');
      body.className = 'posturesync-blink-body';
      body.id = 'posturesync-blink-message';
      body.textContent =
        'Low blink rate detected! Remember to blink naturally, relax your eyes, and take a moment to look away from the screen.';

      elem.appendChild(header);
      elem.appendChild(body);
      document.documentElement.appendChild(elem);
    }
    blinkCardElement = elem;
    return elem;
  }

  function showBlinkAlert(rate: number | null, message?: string): void {
    const card = getOrCreateBlinkCard();
    const badgeText = card.querySelector('#posturesync-blink-rate-badge');
    if (badgeText) {
      badgeText.textContent = rate !== null ? `LOW BLINK RATE · ${rate} BPM` : 'LOW BLINK RATE DETECTED';
    }

    const body = card.querySelector('#posturesync-blink-message');
    if (body) {
      body.textContent =
        message ||
        'Low blink rate detected! Remember to blink naturally, relax your eyes, and take a moment to look away from the screen.';
    }

    card.classList.add('posturesync-active');
  }

  function hideBlinkCard(): void {
    if (blinkCardElement) {
      blinkCardElement.classList.remove('posturesync-active');
      setTimeout(() => {
        if (blinkCardElement && !blinkCardElement.classList.contains('posturesync-active')) {
          if (blinkCardElement.parentNode) {
            blinkCardElement.parentNode.removeChild(blinkCardElement);
          }
          blinkCardElement = null;
        }
      }, 400);
    }
  }

  function showTrackingStatusPill(message: string): void {
    if (trackingPillTimeout !== null) {
      window.clearTimeout(trackingPillTimeout);
      trackingPillTimeout = null;
    }

    let elem = document.getElementById(TRACKING_PILL_ID) as HTMLDivElement | null;
    if (!elem) {
      elem = document.createElement('div');
      elem.id = TRACKING_PILL_ID;

      const dot = document.createElement('span');
      dot.className = 'posturesync-pill-dot dot-reminder';

      const text = document.createElement('span');
      text.id = 'posturesync-tracking-text';

      elem.appendChild(dot);
      elem.appendChild(text);
      document.documentElement.appendChild(elem);
    }
    trackingPillElement = elem;

    const text = elem.querySelector('#posturesync-tracking-text');
    if (text) text.textContent = message;

    elem.classList.add('posturesync-active');

    // Auto-dismiss tracking status pill after 4.5s
    trackingPillTimeout = window.setTimeout(() => {
      if (trackingPillElement) {
        trackingPillElement.classList.remove('posturesync-active');
        setTimeout(() => {
          if (trackingPillElement && trackingPillElement.parentNode) {
            trackingPillElement.parentNode.removeChild(trackingPillElement);
            trackingPillElement = null;
          }
        }, 350);
      }
      trackingPillTimeout = null;
    }, 4500);
  }

  // ---------- 4. Dedicated Screen-Session Break Reminder ----------
  function getOrCreateBreakCard(): HTMLDivElement {
    let elem = document.getElementById(BREAK_CARD_ID) as HTMLDivElement | null;
    if (!elem) {
      elem = document.createElement('div');
      elem.id = BREAK_CARD_ID;
      elem.setAttribute('role', 'alert');

      const header = document.createElement('div');
      header.className = 'posturesync-break-header';

      const dot = document.createElement('span');
      dot.className = 'posturesync-pill-dot dot-reminder';

      const badgeText = document.createElement('span');
      badgeText.id = 'posturesync-break-badge';
      badgeText.textContent = 'SCREEN SESSION BREAK';

      header.appendChild(dot);
      header.appendChild(badgeText);

      const body = document.createElement('div');
      body.className = 'posturesync-break-body';
      body.id = 'posturesync-break-message';
      body.textContent =
        "You've been looking at a screen for a while. Take a short break, look into the distance, stretch, and relax your eyes.";

      const actions = document.createElement('div');
      actions.className = 'posturesync-break-actions';

      const dismissBtn = document.createElement('button');
      dismissBtn.className = 'posturesync-btn-primary';
      dismissBtn.textContent = 'Take Break / Dismiss';
      dismissBtn.onclick = () => {
        hideBreakCard();
        try {
          chrome.runtime.sendMessage({ type: 'DISMISS_BREAK_REMINDER' });
        } catch {}
      };

      const snoozeBtn = document.createElement('button');
      snoozeBtn.className = 'posturesync-btn-secondary';
      snoozeBtn.textContent = 'Snooze 5m';
      snoozeBtn.onclick = () => {
        hideBreakCard();
        try {
          chrome.runtime.sendMessage({ type: 'SNOOZE_BREAK_REMINDER', snoozeMinutes: 5 });
        } catch {}
      };

      actions.appendChild(dismissBtn);
      actions.appendChild(snoozeBtn);

      elem.appendChild(header);
      elem.appendChild(body);
      elem.appendChild(actions);

      document.documentElement.appendChild(elem);
    }
    breakCardElement = elem;
    return elem;
  }

  function showBreakReminder(message?: string, intervalMinutes?: number): void {
    const card = getOrCreateBreakCard();
    const badge = card.querySelector('#posturesync-break-badge');
    if (badge && intervalMinutes) {
      badge.textContent = `SCREEN BREAK · ${intervalMinutes} MIN`;
    }

    const body = card.querySelector('#posturesync-break-message');
    if (body) {
      body.textContent =
        message ||
        "You've been looking at a screen for a while. Take a short break, look into the distance, stretch, and relax your eyes.";
    }

    card.classList.add('posturesync-active');
  }

  function hideBreakCard(): void {
    if (breakCardElement) {
      breakCardElement.classList.remove('posturesync-active');
      setTimeout(() => {
        if (breakCardElement && !breakCardElement.classList.contains('posturesync-active')) {
          if (breakCardElement.parentNode) {
            breakCardElement.parentNode.removeChild(breakCardElement);
          }
          breakCardElement = null;
        }
      }, 400);
    }
  }

  // ---------- 5. Global Cleanup ----------
  function clearAllInterventions(): void {
    removePostureIntervention();
    hideBlinkCard();
    hideBreakCard();
    if (trackingPillElement && trackingPillElement.parentNode) {
      trackingPillElement.parentNode.removeChild(trackingPillElement);
      trackingPillElement = null;
    }
  }

  // ---------- 6. Runtime Message Listener ----------
  chrome.runtime.onMessage.addListener((message: unknown) => {
    if (!message || typeof message !== 'object' || !('type' in message)) {
      return;
    }

    const msg = message as {
      type: string;
      alertLevel?: number;
      blurPx?: number;
      message?: string;
      status?: string;
      soundEnabled?: boolean;
      isRecovering?: boolean;
      isLowBlinkRate?: boolean;
      rate?: number | null;
      trackingStatus?: 'reliable' | 'unreliable' | 'lost';
      intervalMinutes?: number;
    };

    switch (msg.type) {
      case 'APPLY_PROGRESSIVE_BLUR':
        applyProgressiveBlur(
          msg.alertLevel ?? 1,
          msg.blurPx ?? 3,
          msg.message || '',
          msg.soundEnabled,
          msg.isRecovering
        );
        break;

      case 'POSTURE_ALERT':
        applyProgressiveBlur(
          msg.alertLevel ?? 1,
          msg.blurPx ?? 3,
          msg.message || 'Sustained poor posture detected — please sit upright.',
          msg.soundEnabled,
          false
        );
        break;

      case 'POSTURE_RESTORED':
        applyProgressiveBlur(
          0,
          0,
          'Good job! Your posture looks better. Keep comfortable and relaxed.',
          false,
          true
        );
        break;

      case 'BLINK_ALERT_UPDATE':
        if (msg.trackingStatus === 'lost' || msg.trackingStatus === 'unreliable') {
          // If eye tracking is lost or lighting is poor, never claim low blink rate
          hideBlinkCard();
          showTrackingStatusPill('Eye tracking temporarily unavailable — check lighting or camera angle.');
        } else if (msg.isLowBlinkRate) {
          // Reliable low blink rate alert
          showBlinkAlert(msg.rate ?? null, msg.message);
        } else {
          // Blink rate recovered
          hideBlinkCard();
        }
        break;

      case 'BLINK_REMINDER':
        showBlinkAlert(null, msg.message);
        break;

      case 'BREAK_REMINDER':
        showBreakReminder(msg.message, msg.intervalMinutes);
        break;

      case 'BREAK_REMINDER_CLEARED':
        hideBreakCard();
        break;

      case 'MONITORING_STOPPED':
        clearAllInterventions();
        break;

      case 'QUERY_TAB_VISIBILITY':
        try {
          chrome.runtime.sendMessage({
            type: 'TAB_VISIBILITY_CHANGE',
            visibilityState: document.visibilityState,
            timestamp: Date.now()
          }).catch(() => {});
        } catch {}
        break;
    }
  });

  // Query background on initial injection in case alerts are already active
  try {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (chrome.runtime.lastError || !response) return;
      if (response.monitoringActive) {
        if (response.isAlertActive && response.alertLevel > 0) {
          applyProgressiveBlur(
            response.alertLevel,
            response.blurPx ?? (response.alertLevel === 1 ? 3 : response.alertLevel === 2 ? 6 : 11),
            response.alertMessage || '',
            false,
            false
          );
        }
        if (response.isBreakActive) {
          showBreakReminder();
        }
        if (response.lowBlinkRate) {
          showBlinkAlert(response.blinksPerMinute ?? null);
        }
      }
    });
  } catch {}

  // Native window occlusion tracking:
  // When another application (Edge, WhatsApp, etc.) completely covers Chrome on Windows,
  // Chromium's NativeWindowOcclusionTracker sets document.visibilityState to 'hidden'.
  // When uncovered, it returns to 'visible'.
  document.addEventListener('visibilitychange', () => {
    try {
      chrome.runtime.sendMessage({
        type: 'TAB_VISIBILITY_CHANGE',
        visibilityState: document.visibilityState,
        timestamp: Date.now()
      }).catch(() => {});
    } catch {}
  });

  window.addEventListener('beforeunload', () => {
    clearAllInterventions();
  });
})();
