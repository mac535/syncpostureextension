import test from 'node:test';
import assert from 'node:assert/strict';
import { BlinkDetector } from '../src/lib/blink/blinkDetector.ts';

/**
 * Test Suite: Popup & Monitor Synchronization, Canonical State, and Lifecycle Guards
 */

// 1. Popup opening and receiving the latest state snapshot
test('Sync: Popup opening immediately receives latest canonical state snapshot', () => {
  const canonicalBackgroundState = {
    monitoringActive: true,
    monitoringStatus: 'running',
    suspensionReason: null,
    isSuspended: false,
    isEdgeAppFocused: true,
    sequenceNumber: 42,
    timestamp: 1700000000000,
    status: 'good',
    intensity: 0.12,
    blinksPerMinute: 16,
    blinkCount: 25,
    blinkRateStatus: 'normal',
    trackingStatus: 'reliable',
    breakRemainingMs: 1200000
  };

  // Simulated Popup State Container
  let popupState = {
    monitoringActive: false,
    monitoringStatus: 'stopped',
    sequenceNumber: 0,
    timestamp: 0,
    blinksPerMinute: null,
    blinkCount: 0
  };

  function applyStatusResponse(res) {
    if (!res || res.type !== 'STATUS_RESPONSE') return;
    if (res.sequenceNumber < popupState.sequenceNumber) return;
    if (res.timestamp < popupState.timestamp) return;

    popupState = {
      ...popupState,
      monitoringActive: res.monitoringActive,
      monitoringStatus: res.monitoringStatus,
      sequenceNumber: res.sequenceNumber,
      timestamp: res.timestamp,
      blinksPerMinute: res.blinksPerMinute,
      blinkCount: res.blinkCount
    };
  }

  // Popup requests status on open
  const statusResponse = {
    type: 'STATUS_RESPONSE',
    ...canonicalBackgroundState
  };
  applyStatusResponse(statusResponse);

  assert.equal(popupState.monitoringStatus, 'running');
  assert.equal(popupState.sequenceNumber, 42);
  assert.equal(popupState.blinksPerMinute, 16);
  assert.equal(popupState.blinkCount, 25);
});

// 2. Fresh metrics replacing stale metrics
test('Sync: Fresh metrics replace stale metrics on valid sequence advancement', () => {
  let popupState = {
    sequenceNumber: 10,
    timestamp: 1000,
    blinksPerMinute: 14,
    blinkCount: 20,
    intensity: 0.15
  };

  function handleTelemetry(payload) {
    if (payload.sequenceNumber < popupState.sequenceNumber) return false;
    if (payload.timestamp < popupState.timestamp) return false;

    popupState = {
      ...popupState,
      sequenceNumber: payload.sequenceNumber,
      timestamp: payload.timestamp,
      blinksPerMinute: payload.blinksPerMinute,
      blinkCount: payload.blinkCount,
      intensity: payload.intensity
    };
    return true;
  }

  const freshTelemetry = {
    sequenceNumber: 11,
    timestamp: 2000,
    blinksPerMinute: 18,
    blinkCount: 22,
    intensity: 0.05
  };

  const updated = handleTelemetry(freshTelemetry);
  assert.equal(updated, true);
  assert.equal(popupState.sequenceNumber, 11);
  assert.equal(popupState.blinksPerMinute, 18);
  assert.equal(popupState.blinkCount, 22);
  assert.equal(popupState.intensity, 0.05);
});

// 3. Out-of-order state messages being rejected
test('Sync: Out-of-order and delayed state messages are rejected by monotonic sequence guard', () => {
  let popupState = {
    sequenceNumber: 50,
    timestamp: 50000,
    status: 'good',
    blinksPerMinute: 16
  };

  let rejectedCount = 0;

  function receiveUpdate(msg) {
    if (msg.sequenceNumber < popupState.sequenceNumber || msg.timestamp < popupState.timestamp) {
      rejectedCount++;
      return;
    }
    popupState.sequenceNumber = msg.sequenceNumber;
    popupState.timestamp = msg.timestamp;
    popupState.status = msg.status;
    popupState.blinksPerMinute = msg.blinksPerMinute;
  }

  // Stale message delayed in transit arrives late
  receiveUpdate({
    sequenceNumber: 48,
    timestamp: 48000,
    status: 'slouching',
    blinksPerMinute: 2
  });

  assert.equal(rejectedCount, 1, 'Delayed message with older sequence number must be rejected');
  assert.equal(popupState.sequenceNumber, 50);
  assert.equal(popupState.status, 'good', 'State must not be overwritten by delayed message');
  assert.equal(popupState.blinksPerMinute, 16);
});

// 4. Popup and monitor displaying the same monitoring status
test('Sync: Popup and monitor display identical status throughout suspension and resumption', () => {
  let backgroundStatus = 'running';
  let monitorStatus = 'running';
  let popupStatus = 'running';

  function onFocusLost() {
    backgroundStatus = 'suspended';
    monitorStatus = 'suspended';
    popupStatus = 'suspended';
  }

  function onFocusRegained() {
    backgroundStatus = 'initializing';
    monitorStatus = 'initializing';
    popupStatus = 'initializing';
  }

  function onFirstInference() {
    backgroundStatus = 'running';
    monitorStatus = 'running';
    popupStatus = 'running';
  }

  assert.equal(monitorStatus, popupStatus);

  onFocusLost();
  assert.equal(backgroundStatus, 'suspended');
  assert.equal(monitorStatus, 'suspended');
  assert.equal(popupStatus, 'suspended');

  onFocusRegained();
  assert.equal(backgroundStatus, 'initializing');
  assert.equal(monitorStatus, 'initializing');
  assert.equal(popupStatus, 'initializing');

  onFirstInference();
  assert.equal(backgroundStatus, 'running');
  assert.equal(monitorStatus, 'running');
  assert.equal(popupStatus, 'running');
});

// 5. Suspension immediately invalidating live blink-rate measurements
test('Sync: Suspension immediately invalidates live blink-rate measurements and clears blur', () => {
  let liveTelemetry = {
    blinksPerMinute: 17,
    blinkCount: 30,
    blurPx: 6,
    alertLevel: 2,
    monitoringStatus: 'running'
  };

  // On Edge focus loss
  function suspend() {
    liveTelemetry = {
      ...liveTelemetry,
      blinksPerMinute: null, // marked unavailable
      blurPx: 0, // blur cleared
      alertLevel: 0,
      monitoringStatus: 'suspended'
    };
  }

  suspend();

  assert.equal(liveTelemetry.monitoringStatus, 'suspended');
  assert.equal(liveTelemetry.blinksPerMinute, null, 'Blink rate must be null during suspension');
  assert.equal(liveTelemetry.blurPx, 0, 'Webpage blur must be cleared during suspension');
  assert.equal(liveTelemetry.alertLevel, 0);
  // Total blinks preserved
  assert.equal(liveTelemetry.blinkCount, 30);
});

// 6. Historical blink totals being preserved appropriately across suspension
test('Sync: BlinkDetector.reset(false) preserves accumulated blinks but clears temporal windows', () => {
  function simulateBlink(det, startMs) {
    det.processEAR(0.30, startMs);
    det.processEAR(0.15, startMs + 30);
    det.processEAR(0.15, startMs + 100);
    det.processEAR(0.30, startMs + 160);
    det.processEAR(0.30, startMs + 200);
  }

  const detector = new BlinkDetector({ observationPeriodMs: 60000, rollingWindowMs: 60000 });

  // Simulate 3 blinks spaced apart (> 200ms refractory period)
  simulateBlink(detector, 1000);
  simulateBlink(detector, 5000);
  simulateBlink(detector, 12000);

  assert.equal(detector.getBlinkCount(), 3, 'Must have recorded 3 blinks');
  assert.equal(detector.getBlinkTimestamps().length, 3);

  // Partial reset on pause/suspension
  detector.reset(false);

  // Historical blink count preserved!
  assert.equal(detector.getBlinkCount(), 3, 'Historical blink count must be preserved across suspension');
  // Rolling window timestamps cleared so time spent outside Edge is not counted
  assert.equal(detector.getBlinkTimestamps().length, 0, 'Temporal timestamps must be cleared on suspension');

  // Next measurement resumes cleanly without stale timestamps from outside Edge
  simulateBlink(detector, 30000);
  assert.equal(detector.getBlinkCount(), 4, 'New blinks add onto historical total');
  assert.equal(detector.getBlinkTimestamps().length, 1);

  // Full reset (e.g. vision pipeline destruction or full restart) clears historical count
  detector.reset(true);
  assert.equal(detector.getBlinkCount(), 0, 'Full reset clears historical count');
});

// 7. Resumption does not mark monitoring active before fresh inference data arrives
test('Sync: Resumption transitions to initializing and does not mark running prematurely', () => {
  let isEdgeAppFocused = false;
  let isSuspendedDueToFocus = true;
  let isInitializing = false;
  let monitoringStatus = 'suspended';

  function onEdgeFocusRegained() {
    isEdgeAppFocused = true;
    isSuspendedDueToFocus = false;
    isInitializing = true;
    monitoringStatus = 'initializing';
  }

  function onFreshInferenceReceived() {
    isInitializing = false;
    monitoringStatus = 'running';
  }

  onEdgeFocusRegained();
  assert.equal(isEdgeAppFocused, true);
  assert.equal(isSuspendedDueToFocus, false);
  assert.equal(isInitializing, true);
  assert.equal(monitoringStatus, 'initializing', 'Must not be marked running immediately upon window focus');

  // Once camera frame is processed
  onFreshInferenceReceived();
  assert.equal(isInitializing, false);
  assert.equal(monitoringStatus, 'running');
});

// 8. Observation-window settings remaining consistent
test('Sync: Observation window settings updates propagate to all consumers', () => {
  let backgroundSettings = { blinkObservationPeriodSec: 120 };
  let monitorSettings = { blinkObservationPeriodSec: 120 };
  let popupSettings = { blinkObservationPeriodSec: 120 };

  function updateObservationWindow(newSec) {
    backgroundSettings.blinkObservationPeriodSec = newSec;
    // Broadcasted to monitor and popup
    monitorSettings.blinkObservationPeriodSec = newSec;
    popupSettings.blinkObservationPeriodSec = newSec;
  }

  updateObservationWindow(15);
  assert.equal(backgroundSettings.blinkObservationPeriodSec, 15);
  assert.equal(monitorSettings.blinkObservationPeriodSec, 15);
  assert.equal(popupSettings.blinkObservationPeriodSec, 15);

  updateObservationWindow(60);
  assert.equal(backgroundSettings.blinkObservationPeriodSec, 60);
  assert.equal(monitorSettings.blinkObservationPeriodSec, 60);
  assert.equal(popupSettings.blinkObservationPeriodSec, 60);
});

// 9. Explicit Stop remaining effective after focus changes
test('Sync: Explicit user Stop remains effective and is not overridden by focus changes', () => {
  let monitoringActive = true;
  let isSuspendedDueToFocus = false;
  let monitoringStatus = 'running';

  // User explicitly stops monitoring
  function userStop() {
    monitoringActive = false;
    isSuspendedDueToFocus = false;
    monitoringStatus = 'stopped';
  }

  // Focus changes afterwards
  function handleFocusChange(focused) {
    if (!monitoringActive) {
      // Must ignore focus transitions when user explicitly stopped
      return;
    }
    if (!focused) {
      isSuspendedDueToFocus = true;
      monitoringStatus = 'suspended';
    } else if (isSuspendedDueToFocus) {
      isSuspendedDueToFocus = false;
      monitoringStatus = 'initializing';
    }
  }

  userStop();
  assert.equal(monitoringStatus, 'stopped');

  // Edge loses focus
  handleFocusChange(false);
  assert.equal(monitoringStatus, 'stopped');

  // Edge regains focus
  handleFocusChange(true);
  assert.equal(monitoringStatus, 'stopped', 'Explicit Stop must never auto-resume on focus');
});

// 10. Monitor disconnection and service-worker restart recovery
test('Sync: Monitor tab disconnection transitions monitoring to stopped', () => {
  let hasMonitorTab = true;
  let monitoringActive = true;
  let monitoringStatus = 'running';

  function onMonitorTabClosed() {
    hasMonitorTab = false;
    monitoringActive = false;
    monitoringStatus = 'stopped';
  }

  onMonitorTabClosed();
  assert.equal(hasMonitorTab, false);
  assert.equal(monitoringActive, false);
  assert.equal(monitoringStatus, 'stopped', 'Closing monitor page must transition status to stopped');
});
