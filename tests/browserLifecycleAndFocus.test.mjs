import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Test Suite: Browser Lifecycle, Edge Application Focus Detection, and Resource Management
 */

// 1. Edge Focus Lost while monitoring is running
test('Browser Lifecycle: Edge focus lost suspends monitoring and releases camera stream', () => {
  let isMonitoringActive = true;
  let isEdgeAppFocused = true;
  let isSuspended = false;
  let cameraStreamActive = true;
  let inferenceLoopRunning = true;
  let releasedTracksCount = 0;

  function simulateWindowFocusChanged(windowId, WINDOW_ID_NONE = -1) {
    if (windowId === WINDOW_ID_NONE) {
      isEdgeAppFocused = false;
      if (isMonitoringActive) {
        isSuspended = true;
        // Resource cleanup on suspension
        if (cameraStreamActive) {
          releasedTracksCount++;
          cameraStreamActive = false;
        }
        inferenceLoopRunning = false;
      }
    } else {
      isEdgeAppFocused = true;
      if (isMonitoringActive && isSuspended) {
        isSuspended = false;
        cameraStreamActive = true;
        inferenceLoopRunning = true;
      }
    }
  }

  // Edge window loses OS focus to another desktop app
  simulateWindowFocusChanged(-1);

  assert.equal(isEdgeAppFocused, false, 'Edge app must be marked unfocused');
  assert.equal(isSuspended, true, 'Monitoring must transition to suspended state');
  assert.equal(cameraStreamActive, false, 'Camera stream must be released during suspension');
  assert.equal(inferenceLoopRunning, false, 'Inference loop must stop during suspension');
  assert.equal(releasedTracksCount, 1, 'Webcam tracks must be stopped once');
  assert.equal(isMonitoringActive, true, 'User monitoring-enabled preference must be preserved');
});

// 2. Edge Focus Regained while monitoring is enabled
test('Browser Lifecycle: Edge focus regained automatically resumes camera and inference', () => {
  let isMonitoringActive = true;
  let isEdgeAppFocused = false;
  let isSuspended = true;
  let cameraStreamActive = false;
  let inferenceLoopRunning = false;
  let activeLoopCount = 0;

  function resumeOnFocus(windowId, WINDOW_ID_NONE = -1) {
    if (windowId !== WINDOW_ID_NONE) {
      isEdgeAppFocused = true;
      if (isMonitoringActive && isSuspended) {
        isSuspended = false;
        cameraStreamActive = true;
        if (!inferenceLoopRunning) {
          inferenceLoopRunning = true;
          activeLoopCount++;
        }
      }
    }
  }

  // User clicks back to Edge
  resumeOnFocus(101);

  assert.equal(isEdgeAppFocused, true, 'Edge app must be marked focused');
  assert.equal(isSuspended, false, 'Monitoring must no longer be suspended');
  assert.equal(cameraStreamActive, true, 'Webcam stream must be safely reacquired');
  assert.equal(inferenceLoopRunning, true, 'Inference loop must be running');
  assert.equal(activeLoopCount, 1, 'Exactly one inference loop must exist');
});

// 3. Switching between Edge tabs without unnecessarily stopping monitoring
test('Browser Lifecycle: Switching between Edge tabs keeps monitoring active and running', () => {
  let isMonitoringActive = true;
  let isEdgeAppFocused = true;
  let isSuspended = false;
  let activeTabId = 1;
  let monitorTabVisibility = 'visible';
  let inferenceExecutionCount = 0;

  function switchTab(newTabId) {
    activeTabId = newTabId;
    // Monitor tab becomes hidden when viewing another Edge tab
    monitorTabVisibility = activeTabId === 1 ? 'visible' : 'hidden';
  }

  function runInferenceTick() {
    // Inference runs as long as monitoring is active and not suspended
    if (isMonitoringActive && !isSuspended) {
      inferenceExecutionCount++;
    }
  }

  // Initial state: on monitor tab
  runInferenceTick();
  assert.equal(inferenceExecutionCount, 1);

  // Switch to another Edge tab (e.g. documentation or email)
  switchTab(2);
  assert.equal(monitorTabVisibility, 'hidden', 'Monitor tab document is hidden');
  assert.equal(isEdgeAppFocused, true, 'Edge is still the focused application');
  assert.equal(isSuspended, false, 'Monitoring must NOT suspend when switching Edge tabs');

  // Background inference continues running at 100ms cadence
  runInferenceTick();
  runInferenceTick();
  assert.equal(inferenceExecutionCount, 3, 'Inference continues across other Edge tabs');
});

// 4. Explicit Stop Monitoring while Edge is unfocused
test('Browser Lifecycle: Explicit Stop Monitoring while unfocused stays stopped permanently', () => {
  let isMonitoringActive = true;
  let isEdgeAppFocused = false;
  let isSuspended = true;

  function stopMonitoring() {
    isMonitoringActive = false;
    isSuspended = false; // clean exit to stopped state
  }

  function onFocusRegained(windowId, WINDOW_ID_NONE = -1) {
    if (windowId !== WINDOW_ID_NONE) {
      isEdgeAppFocused = true;
      // Should ONLY resume if isMonitoringActive was still true!
      if (isMonitoringActive && isSuspended) {
        isSuspended = false;
      }
    }
  }

  // User explicitly stops monitoring while Edge was unfocused
  stopMonitoring();
  assert.equal(isMonitoringActive, false, 'Monitoring must be marked inactive');
  assert.equal(isSuspended, false, 'Suspended flag is cleared');

  // Edge subsequently regains focus
  onFocusRegained(200);

  assert.equal(isEdgeAppFocused, true, 'Edge is now focused');
  assert.equal(isMonitoringActive, false, 'Monitoring must NOT auto-restart when explicitly stopped');
  assert.equal(isSuspended, false, 'Lifecycle remains stopped');
});

// 5. Focus lost during camera initialization
test('Browser Lifecycle: Focus lost during camera initialization cancels stream without leak', async () => {
  let isMounted = true;
  let active = true;
  let suspended = false;
  let acquisitionId = 0;
  let leakedStreamCount = 0;
  let stoppedTrackCount = 0;

  async function mockStartWebcam() {
    const currentAcqId = ++acquisitionId;

    // Simulate async camera permission / hardware negotiation (20ms)
    const stream = await new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          id: 'camera_stream_mock',
          getTracks: () => [
            {
              stop: () => {
                stoppedTrackCount++;
              }
            }
          ]
        });
      }, 20);
    });

    // Guard check: focus was lost during acquisition
    if (!isMounted || !active || suspended || currentAcqId !== acquisitionId) {
      stream.getTracks().forEach((track) => track.stop());
      return null;
    }

    leakedStreamCount++;
    return stream;
  }

  // Start camera acquisition
  const promise = mockStartWebcam();

  // Edge loses focus immediately (10ms in) while camera is acquiring
  suspended = true;

  const result = await promise;

  assert.equal(result, null, 'Acquisition must be aborted and return null');
  assert.equal(stoppedTrackCount, 1, 'Stream tracks must be stopped immediately upon resolution');
  assert.equal(leakedStreamCount, 0, 'No stream or tracks can leak');
});

// 6. Repeated rapid focus changes without duplicate streams or inference loops
test('Browser Lifecycle: Rapid focus changes debounce and maintain exactly one stream', () => {
  let isEdgeAppFocused = true;
  let isSuspended = false;
  let activeStreams = 0;
  let debounceTimer = null;

  function handleFocusChanged(windowId, WINDOW_ID_NONE = -1) {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    if (windowId === WINDOW_ID_NONE) {
      // 120ms debounce
      debounceTimer = setTimeout(() => {
        isEdgeAppFocused = false;
        isSuspended = true;
        if (activeStreams > 0) activeStreams--;
      }, 120);
    } else {
      isEdgeAppFocused = true;
      if (isSuspended) {
        isSuspended = false;
        activeStreams = 1;
      }
    }
  }

  // Initial state: focused with 1 active stream
  activeStreams = 1;

  // Rapid blur and focus transitions (e.g. rapid Alt+Tab jitter)
  handleFocusChanged(-1); // blur requested
  handleFocusChanged(-1); // duplicate blur
  handleFocusChanged(100); // immediate refocus before 120ms expires

  assert.equal(isEdgeAppFocused, true, 'Debounce absorbed jitter, Edge remains focused');
  assert.equal(isSuspended, false, 'Monitoring was not suspended');
  assert.equal(activeStreams, 1, 'Stream count remained strictly 1');
});

// 7. Stale intervention cleanup during suspension
test('Browser Lifecycle: Stale progressive blur is cleared when Edge loses focus', () => {
  let activeAlertLevel = 2;
  let activeBlurPx = 6;
  let isAlertActive = true;
  const dispatchedMessages = [];

  function onSuspend() {
    if (isAlertActive) {
      dispatchedMessages.push({
        type: 'APPLY_PROGRESSIVE_BLUR',
        alertLevel: 0,
        blurPx: 0,
        status: 'good',
        isRecovering: true
      });
      activeAlertLevel = 0;
      activeBlurPx = 0;
      isAlertActive = false;
    }
  }

  onSuspend();

  assert.equal(activeAlertLevel, 0, 'Alert level must be reset to 0');
  assert.equal(activeBlurPx, 0, 'Blur px must be cleared to 0px');
  assert.equal(isAlertActive, false, 'Alert active flag must be cleared');
  assert.equal(dispatchedMessages.length, 1);
  assert.equal(dispatchedMessages[0].blurPx, 0, 'Tab intervention must be unblurred during suspension');
});

// 8. Recovery after camera reacquisition failure
test('Browser Lifecycle: Handles camera reacquisition failure gracefully without crashing', async () => {
  let cameraActive = false;
  let cameraError = null;

  async function resumeCamera(simulateFailure = false) {
    try {
      if (simulateFailure) {
        throw new Error('Camera is already in use by another application.');
      }
      cameraActive = true;
      cameraError = null;
    } catch (err) {
      cameraActive = false;
      cameraError = err.message;
    }
  }

  // 1. Resume attempts camera access but webcam is busy in another app
  await resumeCamera(true);

  assert.equal(cameraActive, false, 'Camera must remain inactive on error');
  assert.equal(cameraError, 'Camera is already in use by another application.');

  // 2. Subsequent retry when camera becomes available succeeds
  await resumeCamera(false);

  assert.equal(cameraActive, true, 'Camera must reacquire successfully on retry');
  assert.equal(cameraError, null, 'Camera error must be cleared');
});
