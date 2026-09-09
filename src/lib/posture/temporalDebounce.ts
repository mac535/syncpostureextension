/**
 * temporalDebounce.ts
 *
 * PostureDebouncer: smooths the raw deviationScore using an EMA and only
 * fires a "posture bad" notification once the smoothed score has remained
 * above the trigger threshold for a sustained hold duration.  Recovery (clear)
 * is gated by a separate cooldown timer so a brief straightening-up does not
 * prematurely clear an active alert.
 *
 * No per-user calibration — thresholds are fixed relative to the same
 * POSTURE_THRESHOLDS reference values used by classifyPosture().
 */

export interface DebouncerConfig {
  /**
   * EMA alpha for the per-frame score smoothing (0–1).
   * Lower = more smoothing, slower to react.
   * Default: 0.20
   */
  emaAlpha?: number;

  /**
   * Smoothed score must stay ABOVE this value for `holdMs` before a trigger fires.
   * Default: 0.30
   */
  triggerThreshold?: number;

  /**
   * Smoothed score must stay BELOW this value for `cooldownMs` before a
   * trigger is cleared.
   * Default: 0.15
   */
  clearThreshold?: number;

  /**
   * Milliseconds the smoothed score must be above triggerThreshold before
   * we fire the triggered callback.
   * Default: 2500 ms
   */
  holdMs?: number;

  /**
   * Milliseconds the smoothed score must be below clearThreshold before we
   * fire the cleared callback and allow a new trigger cycle.
   * Default: 3500 ms
   */
  cooldownMs?: number;
}

export type DebouncerState = 'idle' | 'accumulating' | 'triggered' | 'recovering';

export interface DebouncerCallbacks {
  /** Called once when the hold period completes — posture is bad enough and sustained. */
  onTriggered: (smoothedScore: number) => void;
  /** Called once when recovery cooldown completes — posture is good again. */
  onCleared: () => void;
  /**
   * Called every frame with the latest smoothed score (useful for live UI gauges).
   * Never suppressed by debounce state.
   */
  onScoreUpdate?: (smoothedScore: number) => void;
}

const DEFAULTS: Required<DebouncerConfig> = {
  emaAlpha: 0.20,
  triggerThreshold: 0.30,
  clearThreshold: 0.15,
  holdMs: 2500,
  cooldownMs: 3500,
};

export class PostureDebouncer {
  private config: Required<DebouncerConfig>;
  private callbacks: DebouncerCallbacks;

  private smoothedScore: number = 0;
  private state: DebouncerState = 'idle';

  /** Timestamp (ms, from Date.now()) when we entered accumulating. */
  private accumulatingStart: number | null = null;
  /** Timestamp when we entered recovering. */
  private recoveringStart: number | null = null;

  constructor(callbacks: DebouncerCallbacks, config: DebouncerConfig = {}) {
    this.config = { ...DEFAULTS, ...config };
    this.callbacks = callbacks;
  }

  /**
   * Feed the latest raw deviationScore (0.0–1.0).
   * Call this once per inference frame.
   *
   * @param rawScore    Raw deviationScore from computeDeviationScore()
   * @param nowMs       Current time in ms (defaults to Date.now())
   */
  update(rawScore: number, nowMs: number = Date.now()): void {
    // 1. EMA smoothing
    this.smoothedScore =
      this.config.emaAlpha * rawScore +
      (1 - this.config.emaAlpha) * this.smoothedScore;

    const s = this.smoothedScore;

    // 2. Emit live score to UI regardless of debounce state
    this.callbacks.onScoreUpdate?.(Number(s.toFixed(3)));

    // 3. State machine
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
          // Score dropped — abandon accumulation, go back to idle
          this.state = 'idle';
          this.accumulatingStart = null;
        } else if (
          this.accumulatingStart !== null &&
          nowMs - this.accumulatingStart >= this.config.holdMs
        ) {
          // Held long enough — fire!
          this.state = 'triggered';
          this.accumulatingStart = null;
          this.callbacks.onTriggered(Number(s.toFixed(3)));
        }
        break;
      }

      case 'triggered': {
        if (s < this.config.clearThreshold) {
          // Score dropped low enough — begin recovery cooldown
          this.state = 'recovering';
          this.recoveringStart = nowMs;
        }
        break;
      }

      case 'recovering': {
        if (s >= this.config.clearThreshold) {
          // Score crept back up during recovery window — abort recovery
          this.state = 'triggered';
          this.recoveringStart = null;
        } else if (
          this.recoveringStart !== null &&
          nowMs - this.recoveringStart >= this.config.cooldownMs
        ) {
          // Stayed clear long enough — fire cleared callback, back to idle
          this.state = 'idle';
          this.recoveringStart = null;
          this.callbacks.onCleared();
        }
        break;
      }
    }
  }

  /** Reset all state (e.g., when camera feed stops). */
  reset(): void {
    this.smoothedScore = 0;
    this.state = 'idle';
    this.accumulatingStart = null;
    this.recoveringStart = null;
  }

  /** Read-only accessors for diagnostics / UI. */
  get currentSmoothedScore(): number {
    return this.smoothedScore;
  }

  get currentState(): DebouncerState {
    return this.state;
  }
}
