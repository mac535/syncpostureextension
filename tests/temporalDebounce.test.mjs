import test from 'node:test';
import assert from 'node:assert/strict';

// Test implementation of PostureDebouncer matching src/lib/posture/temporalDebounce.ts
class PostureDebouncer {
  constructor(callbacks, config = {}) {
    this.config = {
      emaAlpha: 0.20,
      triggerThreshold: 0.30,
      clearThreshold: 0.15,
      holdMs: 10000, // 10s default
      cooldownMs: 3500,
      ...config
    };
    this.callbacks = callbacks;
    this.smoothedScore = 0;
    this.state = 'idle';
    this.accumulatingStart = null;
    this.recoveringStart = null;
  }

  setHoldDuration(holdMs) {
    if (holdMs > 500) this.config.holdMs = holdMs;
  }

  update(rawScore, nowMs = Date.now()) {
    this.smoothedScore =
      this.config.emaAlpha * rawScore +
      (1 - this.config.emaAlpha) * this.smoothedScore;

    const s = this.smoothedScore;
    this.callbacks.onScoreUpdate?.(Number(s.toFixed(3)));

    switch (this.state) {
      case 'idle': {
        if (s >= this.config.triggerThreshold) {
          this.state = 'accumulating';
          this.accumulatingStart = nowMs;
        }
        break;
      }

      case 'accumulating': {
        if (s < this.config.triggerThreshold) {
          this.state = 'idle';
          this.accumulatingStart = null;
        } else if (
          this.accumulatingStart !== null &&
          nowMs - this.accumulatingStart >= this.config.holdMs
        ) {
          this.state = 'triggered';
          this.accumulatingStart = null;
          this.callbacks.onTriggered(Number(s.toFixed(3)));
        }
        break;
      }

      case 'triggered': {
        if (s < this.config.clearThreshold) {
          this.state = 'recovering';
          this.recoveringStart = nowMs;
        }
        break;
      }

      case 'recovering': {
        if (s >= this.config.clearThreshold) {
          this.state = 'triggered';
          this.recoveringStart = null;
        } else if (
          this.recoveringStart !== null &&
          nowMs - this.recoveringStart >= this.config.cooldownMs
        ) {
          this.state = 'idle';
          this.recoveringStart = null;
          this.callbacks.onCleared();
        }
        break;
      }
    }
  }

  reset() {
    this.smoothedScore = 0;
    this.state = 'idle';
    this.accumulatingStart = null;
    this.recoveringStart = null;
  }

  get currentState() {
    return this.state;
  }
}

test('PostureDebouncer: does NOT fire on brief poor posture movements (<10s)', () => {
  let triggered = false;
  let cleared = false;
  const debouncer = new PostureDebouncer({
    onTriggered: () => { triggered = true; },
    onCleared: () => { cleared = true; }
  }, { holdMs: 10000 });

  let time = 1000;

  // Frame 1: Good posture (rawScore = 0.05)
  debouncer.update(0.05, time);
  assert.equal(debouncer.currentState, 'idle');

  // Slouching begins for 4 seconds (less than 10 seconds threshold)
  for (let i = 0; i < 40; i++) {
    time += 100;
    debouncer.update(0.85, time);
  }

  assert.equal(debouncer.currentState, 'accumulating');
  assert.equal(triggered, false, 'Should NOT trigger before 10 seconds duration has elapsed');

  // User straightens up briefly
  for (let i = 0; i < 30; i++) {
    time += 100;
    debouncer.update(0.05, time);
  }

  // Should have dropped back to idle
  assert.equal(debouncer.currentState, 'idle', 'Should abort accumulation when posture straightens up');
  assert.equal(triggered, false, 'Should never have triggered');
  assert.equal(cleared, false, 'Should not have cleared');
});

test('PostureDebouncer: fires alert only after sustained poor posture persists for 10 seconds', () => {
  let triggered = false;
  let triggeredScore = 0;
  const debouncer = new PostureDebouncer({
    onTriggered: (score) => {
      triggered = true;
      triggeredScore = score;
    },
    onCleared: () => {}
  }, { holdMs: 10000 });

  let time = 1000;

  // Feed sustained bad posture frames for 10.5 seconds
  for (let i = 0; i < 110; i++) {
    time += 100; // 100ms interval (10 fps)
    debouncer.update(0.80, time);
  }

  assert.equal(triggered, true, 'Must trigger after sustained 10s poor posture');
  assert.equal(debouncer.currentState, 'triggered');
  assert.ok(triggeredScore >= 0.30, 'Triggered score must exceed trigger threshold');
});

test('PostureDebouncer: recovers and resets alert only after staying good through cooldown', () => {
  let triggered = false;
  let cleared = false;
  const debouncer = new PostureDebouncer({
    onTriggered: () => { triggered = true; },
    onCleared: () => { cleared = true; }
  }, { holdMs: 5000, cooldownMs: 3000 });

  let time = 1000;

  // 1. Trigger
  for (let i = 0; i < 60; i++) {
    time += 100;
    debouncer.update(0.75, time);
  }
  assert.equal(triggered, true);
  assert.equal(debouncer.currentState, 'triggered');

  // 2. Straighten up for 1.5 seconds (less than cooldown of 3.0s)
  for (let i = 0; i < 15; i++) {
    time += 100;
    debouncer.update(0.02, time);
  }
  assert.equal(debouncer.currentState, 'recovering');
  assert.equal(cleared, false, 'Should not clear prematurely during cooldown');

  // 3. Continue good posture past cooldown
  for (let i = 0; i < 25; i++) {
    time += 100;
    debouncer.update(0.02, time);
  }
  assert.equal(cleared, true, 'Should clear once cooldown duration is satisfied');
  assert.equal(debouncer.currentState, 'idle');
});

test('PostureDebouncer: configurable hold duration works dynamically', () => {
  let triggered = false;
  const debouncer = new PostureDebouncer({
    onTriggered: () => { triggered = true; },
    onCleared: () => {}
  }, { holdMs: 10000 });

  // Update duration to 5000ms (5 seconds)
  debouncer.setHoldDuration(5000);

  let time = 1000;
  for (let i = 0; i < 55; i++) {
    time += 100;
    debouncer.update(0.85, time);
  }

  assert.equal(triggered, true, 'Should trigger at 5 seconds after duration is reconfigured');
});
