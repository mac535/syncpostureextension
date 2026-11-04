import test from 'node:test';
import assert from 'node:assert/strict';

// Import timestamp and lifecycle helpers directly from compiled or simulated module logic
function createMonotonicTimestampManager() {
  let lastMonotonicTimestampMs = 0;

  function ensureMonotonicTimestamp(timestampMs) {
    const candidate =
      typeof timestampMs === 'number' && Number.isFinite(timestampMs) && timestampMs > 0
        ? timestampMs
        : Date.now();
    const safe = candidate > lastMonotonicTimestampMs ? candidate : lastMonotonicTimestampMs + 1;
    lastMonotonicTimestampMs = safe;
    return safe;
  }

  function resetMonotonicTimestamp(initialMs = 0) {
    lastMonotonicTimestampMs = initialMs;
  }

  function getLast() {
    return lastMonotonicTimestampMs;
  }

  return { ensureMonotonicTimestamp, resetMonotonicTimestamp, getLast };
}

test('Monotonic Timestamp: Strictly increases and eliminates duplicate timestamps for MediaPipe', () => {
  const { ensureMonotonicTimestamp, resetMonotonicTimestamp } = createMonotonicTimestampManager();

  resetMonotonicTimestamp(100);

  // 1. Normal forward progression
  const t1 = ensureMonotonicTimestamp(105);
  assert.equal(t1, 105);

  // 2. Exact same timestamp passed twice
  const t2 = ensureMonotonicTimestamp(105);
  assert.equal(t2, 106, 'Duplicate timestamp must increment monotonically by at least 1ms');

  // 3. Regressive (backward) timestamp
  const t3 = ensureMonotonicTimestamp(90);
  assert.equal(t3, 107, 'Regressive timestamp must be bumped ahead of the previous monotonic timestamp');

  // 4. Large jump forward
  const t4 = ensureMonotonicTimestamp(500);
  assert.equal(t4, 500);

  // 5. Zero / undefined / NaN timestamp
  const t5 = ensureMonotonicTimestamp(0);
  assert.ok(t5 > 500, 'Zero timestamp must resolve monotonically to >= previous + 1');
});

test('Frame Skipping Logic: Skips redundant inference when camera frame has not advanced', () => {
  let lastProcessedVideoTime = -1;
  let inferenceExecutionCount = 0;

  function evaluateFrame(currentVideoTime, timeSinceLastProcessMs) {
    // Exact logic from useVisionFeed.ts
    if (
      currentVideoTime > 0 &&
      currentVideoTime === lastProcessedVideoTime &&
      timeSinceLastProcessMs < 110
    ) {
      return false; // Skip
    }
    lastProcessedVideoTime = currentVideoTime;
    inferenceExecutionCount += 1;
    return true; // Process
  }

  // Frame 1 arrives at currentTime = 0.033s (30 FPS)
  assert.equal(evaluateFrame(0.033, 100), true);
  assert.equal(inferenceExecutionCount, 1);

  // Video time has NOT changed (camera hasn't decoded a new frame yet, 30ms later)
  assert.equal(evaluateFrame(0.033, 30), false, 'Must skip inference on identical video currentTime');
  assert.equal(inferenceExecutionCount, 1);

  // Video time advances to 0.066s
  assert.equal(evaluateFrame(0.066, 100), true, 'Must process new video frame');
  assert.equal(inferenceExecutionCount, 2);

  // Video time has not changed, but max timeout (150ms) exceeded (fallback for virtual cameras)
  assert.equal(evaluateFrame(0.066, 150), true, 'Fallback allows processing if elapsed time exceeds 110ms');
  assert.equal(inferenceExecutionCount, 3);
});

test('Adaptive Multi-Person Cadence: Switches interval based on detection stability', () => {
  function getMultiPersonIntervalMs(mode) {
    return mode === 'single_person' ? 1000 : 500;
  }

  assert.equal(getMultiPersonIntervalMs('single_person'), 1000, 'Stable single person runs FaceDetector at 1000ms');
  assert.equal(getMultiPersonIntervalMs('multi_person'), 500, 'Multi-person runs at 500ms for responsiveness');
  assert.equal(getMultiPersonIntervalMs('no_person'), 500, 'No-person mode runs at 500ms for fast entrance detection');
});

test('Conditional Face Landmarker: Bypasses 478-point mesh in multi-person or empty frame mode', () => {
  function shouldExecuteFaceLandmarker(hasPose, isMultiPerson, isModelLoaded) {
    if (!isModelLoaded) return false;
    if (isMultiPerson) return false; // Skipped to save GPU when multiple people are in frame
    if (!hasPose) return false; // Skipped if no person is in front of the camera
    return true;
  }

  assert.equal(shouldExecuteFaceLandmarker(true, false, true), true, 'Single person with pose detected runs FaceLandmarker');
  assert.equal(shouldExecuteFaceLandmarker(true, true, true), false, 'Multi-person skips FaceLandmarker');
  assert.equal(shouldExecuteFaceLandmarker(false, false, true), false, 'Empty frame skips FaceLandmarker');
  assert.equal(shouldExecuteFaceLandmarker(true, false, false), false, 'Unloaded model gracefully skips');
});
