import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Phase 1 & 3: Listener Deduplication and Calibration Guard Tests
 */
test('Calibration Deduplication: isCalibrating guard prevents overlapping calibration requests', () => {
  let calibrationRuns = 0;
  let isCalibrating = false;

  const triggerCalibration = () => {
    if (isCalibrating) {
      return false; // ignored
    }
    isCalibrating = true;
    calibrationRuns++;
    return true;
  };

  // First trigger succeeds
  const first = triggerCalibration();
  assert.equal(first, true, 'First calibration trigger must be accepted');
  assert.equal(calibrationRuns, 1);

  // Rapid second trigger (e.g. duplicate runtime message from popup) must be ignored
  const second = triggerCalibration();
  assert.equal(second, false, 'Duplicate calibration trigger must be ignored while calibrating');
  assert.equal(calibrationRuns, 1);

  // Once finished, new trigger is allowed
  isCalibrating = false;
  const third = triggerCalibration();
  assert.equal(third, true, 'Subsequent calibration trigger allowed after completion');
  assert.equal(calibrationRuns, 2);
});

/**
 * Phase 3: Telemetry Event-Driven vs Throttled Dispatch Logic
 */
test('Telemetry Throttling: dispatches immediately on meaningful state transitions', () => {
  let lastBroadcastTime = 1000;
  const lastState = {
    status: 'good',
    alertLevel: 0,
    blurPx: 0,
    isBreakActive: false,
    detectionMode: 'single_person',
    debouncerState: 'idle'
  };

  function shouldBroadcast(currentTime, newState) {
    const isMeaningfulChange =
      newState.status !== lastState.status ||
      newState.alertLevel !== lastState.alertLevel ||
      newState.blurPx !== lastState.blurPx ||
      newState.isBreakActive !== lastState.isBreakActive ||
      newState.detectionMode !== lastState.detectionMode ||
      newState.debouncerState !== lastState.debouncerState;

    const timeSinceLast = currentTime - lastBroadcastTime;
    const isRoutineIntervalElapsed = timeSinceLast >= 1000;

    return isMeaningfulChange || isRoutineIntervalElapsed;
  }

  // 1. Minor metric update 100ms later with no state change -> DO NOT broadcast
  const minorUpdate = { ...lastState };
  assert.equal(shouldBroadcast(1100, minorUpdate), false, 'Minor continuous metric fluctuation within 100ms must be throttled');

  // 2. State transition: status becomes 'slouching' at 1150ms -> BROADCAST IMMEDIATELY
  const slouchTransition = { ...lastState, status: 'slouching' };
  assert.equal(shouldBroadcast(1150, slouchTransition), true, 'State transition to slouching must broadcast immediately');

  // 3. Alert escalation: level becomes 1 at 1200ms -> BROADCAST IMMEDIATELY
  const alertEscalation = { ...lastState, alertLevel: 1, blurPx: 3 };
  assert.equal(shouldBroadcast(1200, alertEscalation), true, 'Progressive blur alert escalation must broadcast immediately');

  // 4. Break reminder active -> BROADCAST IMMEDIATELY
  const breakTrigger = { ...lastState, isBreakActive: true };
  assert.equal(shouldBroadcast(1250, breakTrigger), true, 'Break reminder event must broadcast immediately');

  // 5. Multi-person detection mode switch -> BROADCAST IMMEDIATELY
  const multiPersonMode = { ...lastState, detectionMode: 'multi_person' };
  assert.equal(shouldBroadcast(1300, multiPersonMode), true, 'Detection mode switch must broadcast immediately');

  // 6. Routine steady-state after 1000ms -> ROUTINE BROADCAST ALLOWED
  assert.equal(shouldBroadcast(2000, lastState), true, 'Routine steady-state telemetry allowed after 1000ms');
});

/**
 * Phase 4: Content Script & CSS Tab Injection Deduplication
 */
test('Tab Broadcasting: tracks injected tabs to eliminate redundant executeScript and insertCSS calls', () => {
  const injectedTabs = new Set();
  let scriptInjections = 0;
  let cssInjections = 0;

  function ensureInjected(tabId) {
    if (injectedTabs.has(tabId)) {
      return false; // already injected, skipped
    }
    injectedTabs.add(tabId);
    scriptInjections++;
    cssInjections++;
    return true;
  }

  // Tab 101 first message
  assert.equal(ensureInjected(101), true);
  assert.equal(scriptInjections, 1);
  assert.equal(cssInjections, 1);

  // Tab 101 second message (subsequent broadcast)
  assert.equal(ensureInjected(101), false, 'Tab 101 should not be reinjected');
  assert.equal(scriptInjections, 1);
  assert.equal(cssInjections, 1);

  // Tab 102 first message
  assert.equal(ensureInjected(102), true);
  assert.equal(scriptInjections, 2);
  assert.equal(cssInjections, 2);

  // Tab 101 closed
  injectedTabs.delete(101);
  assert.equal(injectedTabs.has(101), false);

  // Tab 101 reopened / navigated
  assert.equal(ensureInjected(101), true);
  assert.equal(scriptInjections, 3);
});

/**
 * Phase 4 & 5: Service Worker Telemetry Snapshot Persistence & Recovery
 */
test('Snapshot Persistence: stores latest telemetry snapshot and recovers state on worker restart', () => {
  const mockStorage = {};

  const saveSnapshot = (snapshot) => {
    mockStorage['latest_telemetry_snapshot'] = JSON.stringify(snapshot);
  };

  const restoreSnapshot = () => {
    const raw = mockStorage['latest_telemetry_snapshot'];
    return raw ? JSON.parse(raw) : null;
  };

  const sampleTelemetry = {
    monitoringActive: true,
    status: 'slouching',
    alertLevel: 2,
    blurPx: 6,
    blinkCount: 18,
    blinksPerMinute: 14,
    trackingStatus: 'reliable'
  };

  saveSnapshot(sampleTelemetry);

  // Simulate worker termination and restart
  const restored = restoreSnapshot();
  assert.deepEqual(restored, sampleTelemetry, 'Restored snapshot must match saved state');
  assert.equal(restored.blurPx, 6);
  assert.equal(restored.alertLevel, 2);
});

/**
 * Phase 6: Independence Guarantees
 */
test('System Independence: Low blink alerts and break reminders never trigger webpage blur', () => {
  const evaluateWebpageBlur = ({ postureAlertLevel, _isLowBlinkAlert, _isBreakAlert }) => {
    // Only postureAlertLevel can determine blurPx
    if (postureAlertLevel === 1) return 3;
    if (postureAlertLevel === 2) return 6;
    if (postureAlertLevel === 3) return 11;
    return 0;
  };

  // Low blink alert active, but good posture
  const blinkAlertOnly = evaluateWebpageBlur({
    postureAlertLevel: 0,
    isLowBlinkAlert: true,
    isBreakAlert: false
  });
  assert.equal(blinkAlertOnly, 0, 'Low blink alert must never produce webpage blur');

  // Break alert active, but good posture
  const breakAlertOnly = evaluateWebpageBlur({
    postureAlertLevel: 0,
    isLowBlinkAlert: false,
    isBreakAlert: true
  });
  assert.equal(breakAlertOnly, 0, 'Break alert must never produce webpage blur');

  // Both blink and break alerts active, good posture
  const bothAlerts = evaluateWebpageBlur({
    postureAlertLevel: 0,
    isLowBlinkAlert: true,
    isBreakAlert: true
  });
  assert.equal(bothAlerts, 0, 'Combined non-posture alerts must never produce webpage blur');

  // Slouch alert level 2
  const slouchAlert = evaluateWebpageBlur({
    postureAlertLevel: 2,
    _isLowBlinkAlert: false,
    _isBreakAlert: false
  });
  assert.equal(slouchAlert, 6, 'Posture alert level 2 produces exactly 6px blur');
});

/**
 * Microsoft Edge Compatibility Tests
 */
test('Microsoft Edge Compatibility: Filters Edge-specific internal URLs and add-ons marketplace', () => {
  function isRestrictedUrl(url) {
    if (!url) return true;
    return (
      url.startsWith('chrome://') ||
      url.startsWith('edge://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('extension://') ||
      url.startsWith('about:') ||
      url.startsWith('view-source:') ||
      url.startsWith('data:') ||
      url.startsWith('javascript:') ||
      url.includes('microsoftedge.microsoft.com') ||
      url.includes('chromewebstore.google.com') ||
      url.includes('chrome.google.com')
    );
  }

  // Edge internal system pages
  assert.equal(isRestrictedUrl('edge://extensions'), true, 'edge://extensions must be restricted');
  assert.equal(isRestrictedUrl('edge://settings'), true, 'edge://settings must be restricted');
  assert.equal(isRestrictedUrl('edge://flags'), true, 'edge://flags must be restricted');

  // Edge extension schemes
  assert.equal(isRestrictedUrl('extension://abcd1234efgh/options.html'), true, 'extension:// scheme must be restricted');
  assert.equal(isRestrictedUrl('chrome-extension://abcd1234efgh/popup.html'), true, 'chrome-extension:// scheme must be restricted');

  // Edge Add-ons marketplace
  assert.equal(
    isRestrictedUrl('https://microsoftedge.microsoft.com/addons/detail/posturesync'),
    true,
    'microsoftedge.microsoft.com store pages must be restricted'
  );

  // Data / JavaScript URLs
  assert.equal(isRestrictedUrl('data:text/html,<h1>Hello</h1>'), true, 'data: URLs must be restricted');
  assert.equal(isRestrictedUrl('javascript:void(0)'), true, 'javascript: URLs must be restricted');

  // Standard user websites must NOT be restricted
  assert.equal(isRestrictedUrl('https://example.com/article'), false, 'https://example.com must be eligible');
  assert.equal(isRestrictedUrl('http://localhost:3000/dashboard'), false, 'http://localhost must be eligible');
  assert.equal(isRestrictedUrl('https://learn.microsoft.com/docs'), false, 'https://learn.microsoft.com must be eligible');
});

test('Microsoft Edge Compatibility: MediaPipe GPU delegate gracefully falls back to CPU', async () => {
  let createdDelegate = null;
  const mockVision = {};

  const createModel = async (_vision, options) => {
    createdDelegate = options.baseOptions.delegate;
    if (options.baseOptions.delegate === 'GPU') {
      throw new Error('WebGL context creation failed on Edge');
    }
    return { name: 'PoseLandmarker', delegate: options.baseOptions.delegate };
  };

  async function loadPoseWithFallback(vision) {
    try {
      return await createModel(vision, { baseOptions: { delegate: 'GPU' } });
    } catch {
      return await createModel(vision, { baseOptions: { delegate: 'CPU' } });
    }
  }

  const result = await loadPoseWithFallback(mockVision);
  assert.equal(createdDelegate, 'CPU', 'Should fall back to CPU when GPU delegate fails');
  assert.equal(result.delegate, 'CPU', 'Returned model instance must use CPU delegate');
});

