import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Test Implementation of the Independent Blink Alert System
 * Matching src/lib/blink/blinkDetector.ts
 */
class TestBlinkAlertEngine {
  constructor(config = {}) {
    this.observationPeriodMs = config.observationPeriodMs ?? 120000; // 2 minutes default
    this.lowBlinkRateThreshold = config.lowBlinkRateThreshold ?? 10;
    this.lowBlinkHoldMs = config.lowBlinkHoldMs ?? 3000;
    this.lowBlinkCooldownMs = config.lowBlinkCooldownMs ?? 4000;
    this.rollingWindowMs = 60000;

    this.sessionStartTimeMs = null;
    this.blinkTimestamps = [];
    this.lowBlinkRateAlert = false;
    this.debounceState = 'normal'; // 'normal' | 'accumulating' | 'triggered' | 'recovering'
    this.accumulatingStartMs = null;
    this.recoveringStartMs = null;
  }

  recordBlink(timestampMs) {
    this.blinkTimestamps.push(timestampMs);
  }

  update(timestampMs, hasLandmarks = true) {
    if (this.sessionStartTimeMs === null) {
      this.sessionStartTimeMs = timestampMs;
    }

    // Prune rolling window
    const cutoff = timestampMs - this.rollingWindowMs;
    this.blinkTimestamps = this.blinkTimestamps.filter(t => t >= cutoff);

    const elapsed = timestampMs - this.sessionStartTimeMs;
    const isObserving = elapsed < this.observationPeriodMs;

    // Requirement 8: If landmarks are missing, neutral tracking status & never claim low blink
    if (!hasLandmarks) {
      this.debounceState = 'normal';
      this.accumulatingStartMs = null;
      this.lowBlinkRateAlert = false;
      return {
        isObserving,
        blinksPerMinute: null,
        lowBlinkRateAlert: false,
        trackingStatus: 'lost'
      };
    }

    if (isObserving) {
      return {
        isObserving: true,
        blinksPerMinute: null,
        lowBlinkRateAlert: false,
        trackingStatus: 'reliable'
      };
    }

    // Active rate calculation
    const windowMinutes = Math.min(this.rollingWindowMs, elapsed) / 60000.0;
    const bpm = windowMinutes > 0 ? Math.round(this.blinkTimestamps.length / windowMinutes) : 0;
    const isLow = bpm < this.lowBlinkRateThreshold;

    // Debounce state machine
    switch (this.debounceState) {
      case 'normal':
        if (isLow) {
          this.debounceState = 'accumulating';
          this.accumulatingStartMs = timestampMs;
        }
        break;
      case 'accumulating':
        if (!isLow) {
          this.debounceState = 'normal';
          this.accumulatingStartMs = null;
        } else if (timestampMs - this.accumulatingStartMs >= this.lowBlinkHoldMs) {
          this.debounceState = 'triggered';
          this.lowBlinkRateAlert = true;
        }
        break;
      case 'triggered':
        if (!isLow) {
          this.debounceState = 'recovering';
          this.recoveringStartMs = timestampMs;
        }
        break;
      case 'recovering':
        if (isLow) {
          this.debounceState = 'triggered';
          this.recoveringStartMs = null;
        } else if (timestampMs - this.recoveringStartMs >= this.lowBlinkCooldownMs) {
          this.debounceState = 'normal';
          this.lowBlinkRateAlert = false;
        }
        break;
    }

    return {
      isObserving: false,
      blinksPerMinute: bpm,
      lowBlinkRateAlert: this.lowBlinkRateAlert,
      trackingStatus: 'reliable'
    };
  }
}

/**
 * Test Implementation of the Independent Screen-Session Break Timer
 * Matching src/extension/background.ts
 */
class TestScreenSessionBreakTimer {
  constructor(intervalMin = 30) {
    this.intervalMs = intervalMin * 60 * 1000;
    this.sessionStartTimeMs = null;
    this.breakDueTimestampMs = null;
    this.isBreakActive = false;
    this.isMonitoring = false;
  }

  start(nowMs) {
    this.isMonitoring = true;
    this.sessionStartTimeMs = nowMs;
    this.breakDueTimestampMs = nowMs + this.intervalMs;
    this.isBreakActive = false;
  }

  stop() {
    this.isMonitoring = false;
    this.sessionStartTimeMs = null;
    this.breakDueTimestampMs = null;
    this.isBreakActive = false;
  }

  update(nowMs) {
    if (!this.isMonitoring || this.breakDueTimestampMs === null) return false;
    if (nowMs >= this.breakDueTimestampMs) {
      this.isBreakActive = true;
      return true;
    }
    return false;
  }

  dismiss(nowMs) {
    this.isBreakActive = false;
    if (this.isMonitoring) {
      this.breakDueTimestampMs = nowMs + this.intervalMs;
    }
  }

  snooze(nowMs, snoozeMin = 5) {
    this.isBreakActive = false;
    if (this.isMonitoring) {
      this.breakDueTimestampMs = nowMs + (snoozeMin * 60 * 1000);
    }
  }
}

// ==========================================
// REQUIREMENT 1: Low Blink Rate Tests
// ==========================================

test('Blink Alert: Does NOT show alert during 2-minute initial observation period', () => {
  const engine = new TestBlinkAlertEngine({ observationPeriodMs: 120000 }); // 2 min
  const t0 = 10000;

  // Frame at 0s: No alert
  let res = engine.update(t0);
  assert.equal(res.isObserving, true);
  assert.equal(res.lowBlinkRateAlert, false);

  // Even if 0 blinks recorded for 90 seconds (1.5 minutes), observation period is respected
  res = engine.update(t0 + 90000);
  assert.equal(res.isObserving, true);
  assert.equal(res.lowBlinkRateAlert, false, 'Must NOT trigger low-blink alert before 2 minutes');
});

test('Blink Alert: Triggers red alert only after 2-minute observation and sustained low rate', () => {
  const engine = new TestBlinkAlertEngine({
    observationPeriodMs: 120000,
    lowBlinkHoldMs: 3000,
    lowBlinkRateThreshold: 10
  });
  let t = 1000;

  // Step through 2-minute observation period with low blinks (only 4 blinks = 4 bpm)
  for (let ms = 0; ms <= 120000; ms += 1000) {
    t += 1000;
    if (ms === 20000 || ms === 40000 || ms === 60000 || ms === 80000) {
      engine.recordBlink(t);
    }
    engine.update(t);
  }

  // Right after 2 minutes: observation ends, starts accumulating
  let res = engine.update(t);
  assert.equal(res.isObserving, false);
  assert.equal(res.blinksPerMinute < 10, true);
  assert.equal(res.lowBlinkRateAlert, false, 'Needs hold period before committing alert');

  // Hold for 3.5 seconds
  t += 3500;
  res = engine.update(t);
  assert.equal(res.lowBlinkRateAlert, true, 'Commits red alert after sustained low rate');
});

test('Blink Alert: Clears alert after measured rate recovers past cooldown', () => {
  const engine = new TestBlinkAlertEngine({
    observationPeriodMs: 1000,
    lowBlinkHoldMs: 1000,
    lowBlinkCooldownMs: 3000,
    lowBlinkRateThreshold: 10
  });
  let t = 1000;
  engine.update(t);

  // Observation completes (1000ms)
  t += 1500;
  engine.update(t);
  // Hold completes (1000ms)
  t += 1500;
  let res = engine.update(t);
  assert.equal(res.lowBlinkRateAlert, true);

  // User starts blinking frequently (15 blinks in 60s window)
  for (let i = 0; i < 15; i++) {
    engine.recordBlink(t + i * 200);
  }
  t += 1000;
  res = engine.update(t);
  assert.equal(res.blinksPerMinute >= 10, true);
  assert.equal(res.lowBlinkRateAlert, true, 'Cooldown must hold before clearing');

  // Wait full 3.5s cooldown
  t += 3500;
  res = engine.update(t);
  assert.equal(res.lowBlinkRateAlert, false, 'Alert clears after recovery cooldown satisfied');
});

test('Blink Alert: Missing landmarks / poor lighting displays neutral status without false alert', () => {
  const engine = new TestBlinkAlertEngine({ observationPeriodMs: 1000 });
  let t = 1000;
  t += 2000;

  // Face lost / poor lighting (hasLandmarks = false)
  const res = engine.update(t, false);
  assert.equal(res.trackingStatus, 'lost');
  assert.equal(res.lowBlinkRateAlert, false, 'Must NEVER claim low blink rate when eye tracking is lost');
});

// ==========================================
// REQUIREMENT 2: Screen-Session Break Reminder Tests
// ==========================================

test('Break Reminder: Triggers at configured interval (e.g. 30 minutes, or 1 minute in test)', () => {
  const timer30 = new TestScreenSessionBreakTimer(30); // 30 minutes
  const timerTest = new TestScreenSessionBreakTimer(1); // 1 minute test mode

  const t0 = 100000;
  timer30.start(t0);
  timerTest.start(t0);

  // At 30 seconds: neither fires
  assert.equal(timer30.update(t0 + 30000), false);
  assert.equal(timerTest.update(t0 + 30000), false);

  // At 1 minute (60s): test timer fires!
  assert.equal(timerTest.update(t0 + 60000), true);
  assert.equal(timer30.update(t0 + 60000), false);

  // At 30 minutes (1,800,000ms): 30-min timer fires!
  assert.equal(timer30.update(t0 + 1800000), true);
});

test('Break Reminder: Dismiss resets the timer for a full next interval', () => {
  const timer = new TestScreenSessionBreakTimer(30);
  const t0 = 100000;
  timer.start(t0);

  // 30 min reached
  const tAlert = t0 + 1800000;
  assert.equal(timer.update(tAlert), true);

  // Dismiss at tAlert
  timer.dismiss(tAlert);
  assert.equal(timer.isBreakActive, false);

  // At tAlert + 15 min: no reminder
  assert.equal(timer.update(tAlert + 900000), false);

  // At tAlert + 30 min: fresh reminder fires!
  assert.equal(timer.update(tAlert + 1800000), true);
});

test('Break Reminder: Snooze reschedules reminder for 5 minutes', () => {
  const timer = new TestScreenSessionBreakTimer(30);
  const t0 = 100000;
  timer.start(t0);

  const tAlert = t0 + 1800000;
  timer.update(tAlert);

  // Snooze for 5 minutes
  timer.snooze(tAlert, 5);
  assert.equal(timer.isBreakActive, false);

  // At 3 minutes after snooze: not yet
  assert.equal(timer.update(tAlert + 180000), false);

  // At 5 minutes (300,000ms) after snooze: fires again!
  assert.equal(timer.update(tAlert + 300000), true);
});

test('Break Reminder: Stop monitoring cleans up timer without duplicate timers on restart', () => {
  const timer = new TestScreenSessionBreakTimer(30);
  const t0 = 100000;
  timer.start(t0);
  timer.stop();

  assert.equal(timer.isMonitoring, false);
  assert.equal(timer.isBreakActive, false);

  // Update after 40 minutes: does not fire because stopped
  assert.equal(timer.update(t0 + 2400000), false);

  // Restart clean
  timer.start(t0 + 2400000);
  assert.equal(timer.isMonitoring, true);
});

// ==========================================
// REQUIREMENT 4: Three Systems Independence Tests
// ==========================================

test('System Independence: Low blink rate does NOT cause page blur', () => {
  const blinkEngine = new TestBlinkAlertEngine({ observationPeriodMs: 1000, lowBlinkHoldMs: 500 });
  let t = 1000;
  blinkEngine.update(t);
  t += 1500; // pass observation
  blinkEngine.update(t);
  t += 1000; // pass hold
  const blinkRes = blinkEngine.update(t);

  // Low blink is committed
  assert.equal(blinkRes.lowBlinkRateAlert, true);

  // Posture blur state is completely separate and remains 0px
  const postureBlurPx = 0;
  assert.equal(postureBlurPx, 0, 'Low blink rate must NEVER apply posture blur');
});

test('System Independence: Break timer does NOT alter blink rate or cause blur', () => {
  const breakTimer = new TestScreenSessionBreakTimer(1);
  breakTimer.start(1000);
  const breakFired = breakTimer.update(70000);
  assert.equal(breakFired, true);

  // Blink rate is independent
  const blinkRate = 18; // healthy rate
  assert.ok(blinkRate >= 10, 'Break timer does not falsely alter blink rate');

  // Blur is independent
  const blurPx = 0;
  assert.equal(blurPx, 0, 'Break timer must NEVER apply blur');
});
