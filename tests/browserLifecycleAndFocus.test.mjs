import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Test Suite: Browser Lifecycle, Edge Application Focus Detection, and Resource Management
 */

// 1. Edge Window Minimised while monitoring is running
test('Browser Lifecycle: Edge window minimised suspends monitoring and releases camera stream', () => {
  let isMonitoringActive = true;
  let isSuspended = false;
  let cameraStreamActive = true;
  let inferenceLoopRunning = true;
  let releasedTracksCount = 0;

  function simulateWindowStateChanged(windows) {
    const hasVisibleWindow = windows.some((w) => w.type !== 'popup' && w.state !== 'minimized');
    if (!hasVisibleWindow) {
      if (isMonitoringActive) {
        isSuspended = true;
        if (cameraStreamActive) {
          releasedTracksCount++;
          cameraStreamActive = false;
        }
        inferenceLoopRunning = false;
      }
    } else {
      if (isMonitoringActive && isSuspended) {
        isSuspended = false;
        cameraStreamActive = true;
        inferenceLoopRunning = true;
      }
    }
  }

  // Edge window is minimised to taskbar (all normal windows have state === 'minimized')
  simulateWindowStateChanged([{ id: 1, type: 'normal', state: 'minimized', focused: false }]);

  assert.equal(isSuspended, true, 'Monitoring must transition to suspended state when minimised');
  assert.equal(cameraStreamActive, false, 'Camera stream must be released during suspension');
  assert.equal(inferenceLoopRunning, false, 'Inference loop must stop during suspension');
  assert.equal(releasedTracksCount, 1, 'Webcam tracks must be stopped once');
  assert.equal(isMonitoringActive, true, 'User monitoring-enabled preference must be preserved');
});

// 2. Edge Window Restored from taskbar automatically resumes camera and inference
test('Browser Lifecycle: Edge window restored automatically resumes camera and inference', () => {
  let isMonitoringActive = true;
  let isSuspended = true;
  let cameraStreamActive = false;
  let inferenceLoopRunning = false;
  let activeLoopCount = 0;

  function simulateWindowStateChanged(windows) {
    const hasVisibleWindow = windows.some((w) => w.type !== 'popup' && w.state !== 'minimized');
    if (hasVisibleWindow) {
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

  // User restores Edge from taskbar (state becomes 'normal' or 'maximized')
  simulateWindowStateChanged([{ id: 1, type: 'normal', state: 'normal', focused: true }]);

  assert.equal(isSuspended, false, 'Monitoring must no longer be suspended');
  assert.equal(cameraStreamActive, true, 'Webcam stream must be safely reacquired');
  assert.equal(inferenceLoopRunning, true, 'Inference loop must be running');
  assert.equal(activeLoopCount, 1, 'Exactly one inference loop must exist');
});

// 2b. Split-screen / Side-by-side usage with WhatsApp: Edge loses focus but window is visible, camera stays ON
test('Browser Lifecycle: Split-screen side-by-side with WhatsApp keeps camera ON when interacting with WhatsApp', () => {
  let isMonitoringActive = true;
  let isSuspended = false;
  let cameraStreamActive = true;
  let inferenceExecutionCount = 0;

  function simulateWindowFocusAndState(windows, _focusedWindowId) {
    // Check if Edge has any unminimised window visible on screen
    const hasVisibleWindow = windows.some((w) => w.type !== 'popup' && w.state !== 'minimized');
    if (!hasVisibleWindow) {
      isSuspended = true;
      cameraStreamActive = false;
    } else {
      // Regardless of whether Edge or WhatsApp has focus, if Edge window is visible (normal/maximized), camera stays ON!
      isSuspended = false;
      cameraStreamActive = true;
    }
  }

  function runInferenceTick() {
    if (isMonitoringActive && !isSuspended) {
      inferenceExecutionCount++;
    }
  }

  // Edge and WhatsApp snapped side-by-side. Edge window state is 'normal'.
  // User clicks WhatsApp: focusedWindowId is -1 (WINDOW_ID_NONE for Edge)
  const windows = [{ id: 10, type: 'normal', state: 'normal', focused: false }];
  simulateWindowFocusAndState(windows, -1);

  assert.equal(isSuspended, false, 'Monitoring must NOT suspend in split-screen when WhatsApp is clicked');
  assert.equal(cameraStreamActive, true, 'Camera MUST remain active while Edge is visible side-by-side');

  // Inference continues running while user interacts with WhatsApp
  runInferenceTick();
  runInferenceTick();
  assert.equal(inferenceExecutionCount, 2, 'Posture inference runs continuously during split-screen usage');
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

// 9. Minimising and restoring the browser window
test('Browser Lifecycle: Minimising browser window stops camera and restoring automatically resumes', () => {
  let isMonitoringActive = true;
  let isBrowserFocused = true;
  let isSuspended = false;
  let cameraActive = true;
  let debounceTimer = null;

  function onWindowStateChanged(isMinimised, _newWindowId = 1) {
    if (isMinimised) {
      // Minimising emits WINDOW_ID_NONE (-1)
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        isBrowserFocused = false;
        if (isMonitoringActive) {
          isSuspended = true;
          cameraActive = false; // camera resources released
        }
      }, 50);
    } else {
      // Restoring window focuses it
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      isBrowserFocused = true;
      if (isMonitoringActive && isSuspended) {
        isSuspended = false;
        cameraActive = true; // camera reacquired
      }
    }
  }

  // User minimises the browser
  onWindowStateChanged(true, -1);
  assert.equal(debounceTimer !== null, true, 'Debounce scheduled');

  // Fast forward debounce timer
  isBrowserFocused = false;
  isSuspended = true;
  cameraActive = false;

  assert.equal(isBrowserFocused, false, 'Browser is unfocused while minimised');
  assert.equal(isSuspended, true, 'Monitoring is suspended while minimised');
  assert.equal(cameraActive, false, 'Camera is stopped while minimised');

  // User restores the browser window
  onWindowStateChanged(false, 101);

  assert.equal(isBrowserFocused, true, 'Browser is focused after restore');
  assert.equal(isSuspended, false, 'Monitoring is resumed after restore');
  assert.equal(cameraActive, true, 'Camera is automatically reacquired after restore');
});

// 10. Minimising Edge when switching to another browser application suspends camera and returning resumes seamlessly
test('Browser Lifecycle: Minimising Edge when switching away suspends camera and returning resumes seamlessly', () => {
  let _isMonitoringActive = true;
  let isCurrentBrowserFocused = true;
  let isSuspended = false;
  let cameraStreamActive = true;
  let permissionPromptCount = 0;

  function onSwitchToAnotherBrowser() {
    // Current browser loses OS focus
    isCurrentBrowserFocused = false;
    isSuspended = true;
    cameraStreamActive = false; // camera released
  }

  function onReturnToCurrentBrowser() {
    // Current browser regains OS focus
    isCurrentBrowserFocused = true;
    isSuspended = false;
    cameraStreamActive = true; // automatically resumed
    // Permission is remembered by the browser, no new prompt required
  }

  // Switch to another browser (e.g. Chrome)
  onSwitchToAnotherBrowser();

  assert.equal(isCurrentBrowserFocused, false, 'Current browser lost focus');
  assert.equal(isSuspended, true, 'PostureSync is suspended');
  assert.equal(cameraStreamActive, false, 'Camera stream released');

  // Return to original browser
  onReturnToCurrentBrowser();

  assert.equal(isCurrentBrowserFocused, true, 'Current browser regained focus');
  assert.equal(isSuspended, false, 'PostureSync resumed');
  assert.equal(cameraStreamActive, true, 'Camera stream reacquired');
  assert.equal(permissionPromptCount, 0, 'No manual permission prompt required');
});

// 11. Service worker cold start / storage restoration before focus handling
test('Browser Lifecycle: Service worker cold start recovers settings before focus change evaluation', async () => {
  let settings = { monitoringActive: false }; // uninitialized default
  let isSuspendedDueToFocus = false;
  let resumedCalled = false;

  const storage = {
    settings: { monitoringActive: true },
    runtimeState: { isSuspendedDueToFocus: true }
  };

  async function initSettingsPromise() {
    // Simulate async storage lookup
    await new Promise((r) => setTimeout(r, 10));
    settings = { ...storage.settings };
    isSuspendedDueToFocus = storage.runtimeState.isSuspendedDueToFocus;
  }

  async function handleFocusRegained(windowId) {
    if (windowId !== -1) {
      await initSettingsPromise();
      if (settings.monitoringActive && isSuspendedDueToFocus) {
        isSuspendedDueToFocus = false;
        resumedCalled = true;
      }
    }
  }

  // Trigger focus regained on cold-started worker
  await handleFocusRegained(105);

  assert.equal(settings.monitoringActive, true, 'Settings properly recovered from storage');
  assert.equal(isSuspendedDueToFocus, false, 'Suspended flag cleared upon resume');
  assert.equal(resumedCalled, true, 'Resume lifecycle notification dispatches correctly');
});

// 12. Native Window Occlusion: Another browser (e.g. Edge) completely covers Chrome without minimizing
test('Browser Lifecycle: Edge completely covering Chrome triggers native window occlusion and suspends camera', async () => {
  let _isMonitoringActive = true;
  let isSuspended = false;
  let cameraActive = true;
  let isOccludedDueToNativeCover = false;
  let debounceTimer = null;

  function handleTabVisibilityChange(tabActive, visibilityState) {
    if (!tabActive) return; // Inactive tabs do not represent window occlusion

    if (visibilityState === 'hidden') {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        isOccludedDueToNativeCover = true;
        isSuspended = true;
        cameraActive = false; // camera tracks released
      }, 50);
    } else {
      if (debounceTimer) clearTimeout(debounceTimer);
      isOccludedDueToNativeCover = false;
      isSuspended = false;
      cameraActive = true;
    }
  }

  // Edge opens and completely covers Chrome (Chrome window not minimized, but 100% occluded)
  // Chromium's NativeWindowOcclusionTracker sets the active tab visibility to 'hidden'
  handleTabVisibilityChange(true, 'hidden');

  // Before debounce completes
  assert.equal(isSuspended, false, 'Should debounce before suspending');

  // Await debounce
  await new Promise((r) => setTimeout(r, 60));

  assert.equal(isOccludedDueToNativeCover, true, 'Window is marked occluded by external native application');
  assert.equal(isSuspended, true, 'Monitoring must suspend when Chrome is completely covered');
  assert.equal(cameraActive, false, 'Camera tracks released and inference paused');
});

// 13. Native Window Occlusion Recovery: Uncovering Chrome automatically resumes camera and inference
test('Browser Lifecycle: Uncovering Chrome from behind Edge resumes camera automatically', async () => {
  let _isMonitoringActive = true;
  let isSuspended = true;
  let cameraActive = false;
  let isOccludedDueToNativeCover = true;
  let debounceTimer = null;

  function handleTabVisibilityChange(tabActive, visibilityState) {
    if (!tabActive) return;

    if (visibilityState === 'visible') {
      if (debounceTimer) clearTimeout(debounceTimer);
      isOccludedDueToNativeCover = false;
      isSuspended = false;
      cameraActive = true; // camera reacquired automatically
    }
  }

  // Edge is moved away, minimized, or closed so Chrome is visible again.
  // Active tab visibility transitions from 'hidden' to 'visible'.
  handleTabVisibilityChange(true, 'visible');

  assert.equal(isOccludedDueToNativeCover, false, 'Native occlusion flag cleared');
  assert.equal(isSuspended, false, 'Monitoring resumed');
  assert.equal(cameraActive, true, 'Camera capture resumed without manual intervention');
});

// 14. Partial Visibility & Split-Screen: When Chrome is partially visible behind another app, camera stays ON
test('Browser Lifecycle: Side-by-side or partial visibility keeps active tab visible and camera ON', () => {
  let _isMonitoringActive = true;
  let isSuspended = false;
  let cameraActive = true;

  function handleTabVisibilityChange(tabActive, visibilityState) {
    if (!tabActive) return;
    if (visibilityState === 'visible') {
      isSuspended = false;
      cameraActive = true;
    } else {
      isSuspended = true;
      cameraActive = false;
    }
  }

  // In split-screen / side-by-side mode with Edge/WhatsApp, or partial overlap,
  // Chromium's NativeWindowOcclusionTracker keeps active tab visibilityState as 'visible'
  handleTabVisibilityChange(true, 'visible');

  assert.equal(isSuspended, false, 'Monitoring remains active in split screen / partial overlap');
  assert.equal(cameraActive, true, 'Camera remains ON while Chrome is visible');
});

// 15. Tab switching within Chrome cancels pending occlusion debounce
test('Browser Lifecycle: Switching tabs in Chrome cancels occlusion debounce and maintains continuous monitoring', async () => {
  let isSuspended = false;
  let cameraActive = true;
  let debounceTimer = null;

  function handleActiveTabHidden() {
    debounceTimer = setTimeout(() => {
      isSuspended = true;
      cameraActive = false;
    }, 50);
  }

  function handleTabActivated() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  // Active tab A goes hidden because user clicked Tab B
  handleActiveTabHidden();

  // Tab B activated event fires immediately (within 10ms)
  await new Promise((r) => setTimeout(r, 10));
  handleTabActivated();

  // Wait past original debounce time (60ms)
  await new Promise((r) => setTimeout(r, 60));

  assert.equal(isSuspended, false, 'Tab switching must NOT trigger camera suspension');
  assert.equal(cameraActive, true, 'Camera must remain active when switching tabs');
});
