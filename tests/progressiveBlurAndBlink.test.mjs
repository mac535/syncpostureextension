import test from 'node:test';
import assert from 'node:assert/strict';

// Helper for 2D euclidean distance
function euclideanDistance2D(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Eye Aspect Ratio (EAR) calculator
function computeEyeEAR(landmarks, indices) {
  const c1 = landmarks[indices.cornerOuter];
  const c2 = landmarks[indices.cornerInner];
  const t1 = landmarks[indices.top1];
  const b1 = landmarks[indices.bottom1];
  const t2 = landmarks[indices.top2];
  const b2 = landmarks[indices.bottom2];

  if (!c1 || !c2 || !t1 || !b1 || !t2 || !b2) return 0;
  const horizontal = euclideanDistance2D(c1, c2);
  if (horizontal <= 0.0001) return 0;
  const vertical1 = euclideanDistance2D(t1, b1);
  const vertical2 = euclideanDistance2D(t2, b2);
  return (vertical1 + vertical2) / (2.0 * horizontal);
}

const LEFT_EYE_LANDMARKS = {
  cornerOuter: 33,
  cornerInner: 133,
  top1: 160,
  bottom1: 144,
  top2: 158,
  bottom2: 153,
};

// Simplified Blink State Machine for testing
class TestBlinkStateMachine {
  constructor(closeThreshold = 0.19, openThreshold = 0.24) {
    this.closeThreshold = closeThreshold;
    this.openThreshold = openThreshold;
    this.state = 'OPEN';
    this.blinkCount = 0;
    this.closedStartTimeMs = null;
    this.blinkTimestamps = [];
  }

  update(ear, timestampMs) {
    let blinkDetected = false;

    if (this.state === 'OPEN') {
      if (ear <= this.closeThreshold) {
        this.state = 'CLOSING/CLOSED';
        this.closedStartTimeMs = timestampMs;
      }
    } else if (this.state === 'CLOSING/CLOSED') {
      const duration = timestampMs - (this.closedStartTimeMs ?? timestampMs);
      if (ear >= this.openThreshold) {
        if (duration >= 50 && duration <= 1000) {
          this.blinkCount++;
          this.blinkTimestamps.push(timestampMs);
          blinkDetected = true;
        }
        this.state = 'OPEN';
        this.closedStartTimeMs = null;
      }
    }

    return {
      state: this.state,
      blinkDetected,
      blinkCount: this.blinkCount
    };
  }

  getBlinksPerMinute(timestampMs) {
    const windowMs = 60000;
    const recent = this.blinkTimestamps.filter(t => timestampMs - t <= windowMs);
    return recent.length;
  }
}

// Progressive Alert Engine matching temporalDebounce.ts
class TestProgressiveDebouncer {
  constructor(holdMs = 10000) {
    this.holdMs = holdMs;
    this.state = 'idle';
    this.accumulatingStart = null;
    this.triggeredStart = null;
  }

  trigger(timestampMs) {
    this.state = 'triggered';
    this.triggeredStart = timestampMs;
  }

  recover() {
    this.state = 'recovering';
    this.triggeredStart = null;
  }

  getProgressiveAlert(nowMs) {
    if (this.state === 'recovering') {
      return {
        alertLevel: 0,
        blurPx: 0,
        message: 'Good job! Your posture looks better. Keep comfortable and relaxed.'
      };
    }
    if (this.state !== 'triggered' || this.triggeredStart === null) {
      return { alertLevel: 0, blurPx: 0, message: '' };
    }

    const elapsed = Math.max(0, nowMs - this.triggeredStart);
    if (elapsed < 10000) {
      return {
        alertLevel: 1,
        blurPx: 3,
        message: 'Your posture seems to be slipping. Sit upright and relax your shoulders.'
      };
    }
    if (elapsed < 20000) {
      return {
        alertLevel: 2,
        blurPx: 6,
        message: 'Your posture has been off for a while. Please adjust your sitting position.'
      };
    }
    return {
      alertLevel: 3,
      blurPx: 11,
      message: 'Your posture has not improved. Take a short break and stretch before continuing.'
    };
  }
}

test('Progressive Alert: Escalates from Level 1 (3px) -> Level 2 (6px) -> Level 3 (11px)', () => {
  const debouncer = new TestProgressiveDebouncer(10000);
  const t0 = 100000;

  // Triggered at t0
  debouncer.trigger(t0);

  // t0 + 2s (sustained 12s total): Level 1 (3px blur)
  const l1 = debouncer.getProgressiveAlert(t0 + 2000);
  assert.equal(l1.alertLevel, 1);
  assert.equal(l1.blurPx, 3);
  assert.match(l1.message, /slipping/i);

  // t0 + 12s (sustained 22s total): Level 2 (6px blur)
  const l2 = debouncer.getProgressiveAlert(t0 + 12000);
  assert.equal(l2.alertLevel, 2);
  assert.equal(l2.blurPx, 6);
  assert.match(l2.message, /been off for a while/i);

  // t0 + 25s (sustained 35s total): Level 3 (11px blur)
  const l3 = debouncer.getProgressiveAlert(t0 + 25000);
  assert.equal(l3.alertLevel, 3);
  assert.equal(l3.blurPx, 11);
  assert.match(l3.message, /not improved/i);

  // Recovering: 0px blur with recovery feedback
  debouncer.recover();
  const rec = debouncer.getProgressiveAlert(t0 + 26000);
  assert.equal(rec.alertLevel, 0);
  assert.equal(rec.blurPx, 0);
  assert.match(rec.message, /Good job!/i);
});

test('Blink Tracking: Calculates Eye Aspect Ratio (EAR) and transitions open -> closed -> open', () => {
  // Construct dummy landmarks array representing open eyes (EAR ~ 0.29)
  const openEyeLandmarks = new Array(500).fill(null);
  openEyeLandmarks[33] = { x: 0.30, y: 0.50 };  // cornerOuter
  openEyeLandmarks[133] = { x: 0.50, y: 0.50 }; // cornerInner (width = 0.20)
  openEyeLandmarks[160] = { x: 0.35, y: 0.47 }; // top1
  openEyeLandmarks[144] = { x: 0.35, y: 0.53 }; // bottom1 (height = 0.06)
  openEyeLandmarks[158] = { x: 0.45, y: 0.47 }; // top2
  openEyeLandmarks[153] = { x: 0.45, y: 0.53 }; // bottom2 (height = 0.06)

  const openEAR = computeEyeEAR(openEyeLandmarks, LEFT_EYE_LANDMARKS);
  assert.ok(openEAR > 0.25, `Expected open EAR > 0.25, got ${openEAR}`);

  // Construct closed eye landmarks (height = 0.01, EAR ~ 0.05)
  const closedEyeLandmarks = new Array(500).fill(null);
  closedEyeLandmarks[33] = { x: 0.30, y: 0.50 };
  closedEyeLandmarks[133] = { x: 0.50, y: 0.50 };
  closedEyeLandmarks[160] = { x: 0.35, y: 0.495 };
  closedEyeLandmarks[144] = { x: 0.35, y: 0.505 };
  closedEyeLandmarks[158] = { x: 0.45, y: 0.495 };
  closedEyeLandmarks[153] = { x: 0.45, y: 0.505 };

  const closedEAR = computeEyeEAR(closedEyeLandmarks, LEFT_EYE_LANDMARKS);
  assert.ok(closedEAR < 0.15, `Expected closed EAR < 0.15, got ${closedEAR}`);

  // Test state machine through full blink sequence
  const sm = new TestBlinkStateMachine(0.19, 0.24);
  let t = 1000;

  // 1. Initially open
  let res = sm.update(openEAR, t);
  assert.equal(res.state, 'OPEN');
  assert.equal(res.blinkCount, 0);

  // 2. Eye closes at t = 1100ms
  t += 100;
  res = sm.update(closedEAR, t);
  assert.equal(res.state, 'CLOSING/CLOSED');
  assert.equal(res.blinkCount, 0);

  // 3. Eye re-opens at t = 1250ms (blink duration = 150ms)
  t += 150;
  res = sm.update(openEAR, t);
  assert.equal(res.state, 'OPEN');
  assert.equal(res.blinkDetected, true);
  assert.equal(res.blinkCount, 1);

  // 4. Rate calculation shows 1 blink in the current minute
  assert.equal(sm.getBlinksPerMinute(t), 1);
});

test('Blink Tracking: Rejects prolonged eye closure (> 1000ms) from counting as rapid blink', () => {
  const sm = new TestBlinkStateMachine(0.19, 0.24);
  let t = 2000;

  // Eye closes
  sm.update(0.10, t);
  // Stays closed for 2000ms (sleeping or rubbing eyes)
  t += 2000;
  // Reopens
  const res = sm.update(0.30, t);
  // Should NOT count as a normal blink
  assert.equal(res.blinkDetected, false);
  assert.equal(res.blinkCount, 0);
});

test('Blink Tracking: Handles missing face landmarks safely without crash', () => {
  const ear = computeEyeEAR([], LEFT_EYE_LANDMARKS);
  assert.equal(ear, 0);
});
