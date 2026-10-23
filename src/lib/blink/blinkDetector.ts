import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

/**
 * 2D Euclidean distance helper for landmarks in normalized coordinates.
 */
function euclideanDistance2D(p1: NormalizedLandmark, p2: NormalizedLandmark): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Standard 6-point indices for MediaPipe Face Mesh (468/478 landmarks):
 *
 * Left Eye:
 * - Corners (horizontal): 33 (outer), 133 (inner)
 * - Upper/Lower pairs (vertical):
 *     160 (upper outer) <-> 144 (lower outer)
 *     158 (upper inner) <-> 153 (lower inner)
 *
 * Right Eye:
 * - Corners (horizontal): 362 (inner), 263 (outer)
 * - Upper/Lower pairs (vertical):
 *     385 (upper inner) <-> 380 (lower inner)
 *     387 (upper outer) <-> 373 (lower outer)
 */
export const LEFT_EYE_LANDMARKS = {
  cornerOuter: 33,
  cornerInner: 133,
  top1: 160,
  bottom1: 144,
  top2: 158,
  bottom2: 153,
} as const;

export const RIGHT_EYE_LANDMARKS = {
  cornerInner: 362,
  cornerOuter: 263,
  top1: 385,
  bottom1: 380,
  top2: 387,
  bottom2: 373,
} as const;

/**
 * Calculates Eye Aspect Ratio (EAR) for a 6-point eye landmark set:
 *
 * EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)
 */
export function computeEyeEAR(
  landmarks: NormalizedLandmark[],
  indices: {
    cornerOuter: number;
    cornerInner: number;
    top1: number;
    bottom1: number;
    top2: number;
    bottom2: number;
  }
): number {
  const c1 = landmarks[indices.cornerOuter];
  const c2 = landmarks[indices.cornerInner];
  const t1 = landmarks[indices.top1];
  const b1 = landmarks[indices.bottom1];
  const t2 = landmarks[indices.top2];
  const b2 = landmarks[indices.bottom2];

  if (!c1 || !c2 || !t1 || !b1 || !t2 || !b2) {
    return 0;
  }

  const horizontal = euclideanDistance2D(c1, c2);
  if (horizontal <= 0.0001) {
    return 0;
  }

  const vertical1 = euclideanDistance2D(t1, b1);
  const vertical2 = euclideanDistance2D(t2, b2);

  return (vertical1 + vertical2) / (2.0 * horizontal);
}

/**
 * Configurable parameters for the temporal blink state machine and rate calculator.
 */
export interface BlinkDetectorConfig {
  /**
   * EAR threshold below which eyes transition into candidate closure (CLOSING/CLOSED).
   * Default: 0.19
   */
  earCloseThreshold: number;

  /**
   * EAR threshold above which eyes transition back to OPENING/OPEN (hysteresis).
   * Must be > earCloseThreshold to prevent rapid boundary toggling.
   * Default: 0.24
   */
  earOpenThreshold: number;

  /**
   * Minimum duration (in ms) the eyes must be closed for the closure to be accepted as a genuine blink.
   * Filters out high-frequency noise, single-frame landmark tracking jitter, and sensor drops.
   * Default: 50ms
   */
  minClosedDurationMs: number;

  /**
   * Maximum duration (in ms) for an accepted blink.
   * Closures lasting longer than this are classified as sustained closures (squinting, resting eyes, drowsiness)
   * and do NOT trigger a blink event upon reopening.
   * Default: 400ms
   */
  maxClosedDurationMs: number;

  /**
   * Optional refractory period: minimum time (in ms) between consecutive accepted blink events.
   * Prevents immediate duplicate counts caused by reopening oscillations.
   * Default: 120ms
   */
  minTimeBetweenBlinksMs: number;

  /**
   * Duration of rolling window for calculating blinks per minute (in ms).
   * Default: 60,000ms (60 seconds)
   */
  rollingWindowMs: number;

  /**
   * Initial observation time required before switching from 'collecting' to 'active' (in ms).
   * Prevents immediate "0 blinks/min" artifact before sufficient observation.
   * Default: 30,000ms (30 seconds)
   */
  observationPeriodMs: number;

  /**
   * Exact threshold for low blink rate alert condition: blinksPerMinute < lowBlinkRateThreshold.
   * Exact requirement: 10.
   * - 9 blinks/min -> LOW
   * - 10 blinks/min -> NOT LOW
   * - 11 blinks/min -> NOT LOW
   * (Strict inequality: < 10, never <= 10).
   */
  lowBlinkRateThreshold: number;

  /**
   * Milliseconds the low-blink condition (< 10) must continuously persist before
   * committing lowBlinkRate = true.
   * Default: 3000ms
   */
  lowBlinkHoldMs: number;

  /**
   * Milliseconds the recovery condition (>= 10) must continuously persist before
   * clearing lowBlinkRate back to false.
   * Default: 4000ms
   */
  lowBlinkCooldownMs: number;
}

export const DEFAULT_BLINK_CONFIG: BlinkDetectorConfig = {
  earCloseThreshold: 0.19,
  earOpenThreshold: 0.24,
  minClosedDurationMs: 50,
  maxClosedDurationMs: 400,
  minTimeBetweenBlinksMs: 120,
  rollingWindowMs: 60000,
  observationPeriodMs: 120000, // 2 minutes (120 seconds) observation period
  lowBlinkRateThreshold: 10,
  lowBlinkHoldMs: 3000,
  lowBlinkCooldownMs: 4000,
};

/**
 * Temporal state machine states:
 * - 'OPEN': Normal baseline state, eyes open and looking at screen.
 * - 'CLOSING/CLOSED': Eyes have dropped below earCloseThreshold. Timer tracks closure duration.
 * - 'OPENING/OPEN': Eyes crossed back above earOpenThreshold; transition committed if valid duration.
 */
export type BlinkStateMachineState = 'OPEN' | 'CLOSING/CLOSED' | 'OPENING/OPEN';

/**
 * High-level binary eye state for UI/dashboard consumers.
 */
export type EyeState = 'OPEN' | 'CLOSED';

/**
 * Blink rate measurement status:
 * - 'collecting': Initial observation period; storing blinks, no rate alert triggered.
 * - 'active': Rolling 60s window active and calculating reliable blinksPerMinute.
 */
export type BlinkRateStatus = 'collecting' | 'active';

/**
 * Debounce state for the low-blink-rate alert condition:
 * - 'normal': Rate is healthy (>= 10) or in initial collecting period.
 * - 'accumulating': Rate is < 10; hold timer running before committing alert.
 * - 'triggered': Low-blink condition sustained long enough; lowBlinkRate = true.
 * - 'recovering': Rate is >= 10; recovery cooldown timer running before clearing alert.
 */
export type LowBlinkDebounceState = 'normal' | 'accumulating' | 'triggered' | 'recovering';

export interface BlinkDetectionResult {
  leftEAR: number;
  rightEAR: number;
  averageEAR: number;
  eyesClosed: boolean;
  eyeState: EyeState;
  stateMachineState: BlinkStateMachineState;
  blinkDetected: boolean;
  blinkCount: number;
  blinksPerMinute: number | null;
  blinkRateStatus: BlinkRateStatus;
  lowBlinkRate: boolean;
  lowBlinkDebounceState: LowBlinkDebounceState;
  blinkTimestamps: number[];
  observationProgress: number; // 0.0 to 1.0 (for UI progress bars during collecting)
  lastBlinkDurationMs: number | null;
  lastBlinkTimestampMs: number | null;
  trackingStatus: 'reliable' | 'unreliable' | 'lost';
}

/**
 * Robust temporal Blink Detector, Rolling Rate Calculator, and Debounced Alert Manager.
 *
 * Implements:
 * 1. Independent Left & Right EAR calculation from MediaPipe Face Landmarker mesh.
 * 2. Average EAR calculation.
 * 3. Hysteresis thresholds (earCloseThreshold vs earOpenThreshold).
 * 4. Temporal state machine: OPEN -> CLOSING/CLOSED -> OPENING/OPEN -> OPEN.
 * 5. Duration filtering [minClosedDurationMs, maxClosedDurationMs].
 * 6. Minimum refractory period between accepted blinks (minTimeBetweenBlinksMs).
 * 7. Rolling 60-second window rate calculation using exact blink timestamps (never totalBlinks / runtime).
 * 8. Initial observation period ('collecting' vs 'active') to prevent premature 0 blinks/min.
 * 9. Low blink rate alert condition (blinksPerMinute < 10) with temporal persistence/debounce:
 *    - Strict inequality: < 10 (9 is low, 10 and 11 are not low).
 *    - Only active after observation period completes.
 *    - Prevents rapid 9.9 -> 10.1 toggling using holdMs and cooldownMs timers.
 *    - Separates raw calculated rate from debounced alert state.
 * 10. Frame-rate independent: operates purely on monotonically increasing millisecond timestamps.
 * 11. In-memory storage with complete reset upon vision/camera restart.
 */
export class BlinkDetector {
  private config: BlinkDetectorConfig;
  private state: BlinkStateMachineState = 'OPEN';
  private closedStartTimeMs: number | null = null;
  private blinkCount = 0;
  private lastBlinkDurationMs: number | null = null;
  private lastBlinkTimestampMs: number | null = null;
  private disqualifiedSustainedClosure = false;

  // In-memory timestamps of accepted blink events for rolling window calculation
  private blinkTimestamps: number[] = [];

  // Session start time for observation period
  private sessionStartTimeMs: number | null = null;

  // Temporal debounce state for low-blink condition
  private lowBlinkDebounceState: LowBlinkDebounceState = 'normal';
  private lowBlinkAccumulatingStartMs: number | null = null;
  private lowBlinkRecoveringStartMs: number | null = null;
  private lowBlinkRateAlert = false;

  // Stored previous valid EARs for fallback when face landmarks are momentarily dropped
  private lastValidLeftEAR = 0.3;
  private lastValidRightEAR = 0.3;
  private lastValidAverageEAR = 0.3;

  constructor(config: Partial<BlinkDetectorConfig> = {}) {
    this.config = {
      ...DEFAULT_BLINK_CONFIG,
      ...config,
    };
  }

  public updateConfig(newConfig: Partial<BlinkDetectorConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };
  }

  public getConfig(): Readonly<BlinkDetectorConfig> {
    return { ...this.config };
  }

  /**
   * Resets internal detector state, timestamps, debouncer, and counters.
   * Called when camera or vision session restarts.
   */
  public reset(fullReset = true): void {
    this.state = 'OPEN';
    this.closedStartTimeMs = null;
    this.disqualifiedSustainedClosure = false;
    if (fullReset) {
      this.blinkCount = 0;
      this.lastBlinkDurationMs = null;
      this.lastBlinkTimestampMs = null;
      this.blinkTimestamps = [];
      this.sessionStartTimeMs = null;
      this.lowBlinkDebounceState = 'normal';
      this.lowBlinkAccumulatingStartMs = null;
      this.lowBlinkRecoveringStartMs = null;
      this.lowBlinkRateAlert = false;
      this.lastValidLeftEAR = 0.3;
      this.lastValidRightEAR = 0.3;
      this.lastValidAverageEAR = 0.3;
    }
  }

  /**
   * Process a frame's face landmarks and timestamp.
   *
   * @param faceLandmarks 468/478 normalized landmarks from MediaPipe FaceLandmarker, or null/undefined
   * @param timestampMs Monotonic frame timestamp in milliseconds
   */
  public update(
    faceLandmarks: NormalizedLandmark[] | undefined | null,
    timestampMs: number
  ): BlinkDetectionResult {
    if (this.sessionStartTimeMs === null) {
      this.sessionStartTimeMs = timestampMs;
    }

    // Prune rolling window timestamps older than rollingWindowMs
    this.pruneOldTimestamps(timestampMs);

    // Compute rate status & observation progress
    const { blinkRateStatus, blinksPerMinute, observationProgress } =
      this.computeRateMetrics(timestampMs);

    // Handle missing/invalid face landmarks safely
    if (!faceLandmarks || faceLandmarks.length < 400) {
      // Missing landmarks / lost tracking: cancel any low-blink accumulation and do not alert
      this.lowBlinkDebounceState = 'normal';
      this.lowBlinkAccumulatingStartMs = null;
      this.lowBlinkRateAlert = false;

      return {
        leftEAR: this.lastValidLeftEAR,
        rightEAR: this.lastValidRightEAR,
        averageEAR: this.lastValidAverageEAR,
        eyesClosed: this.state === 'CLOSING/CLOSED',
        eyeState: this.state === 'CLOSING/CLOSED' ? 'CLOSED' : 'OPEN',
        stateMachineState: this.state,
        blinkDetected: false,
        blinkCount: this.blinkCount,
        blinksPerMinute,
        blinkRateStatus,
        lowBlinkRate: false, // Never claim low blink rate when eye tracking is lost
        lowBlinkDebounceState: this.lowBlinkDebounceState,
        blinkTimestamps: [...this.blinkTimestamps],
        observationProgress,
        lastBlinkDurationMs: this.lastBlinkDurationMs,
        lastBlinkTimestampMs: this.lastBlinkTimestampMs,
        trackingStatus: 'lost',
      };
    }

    // Update debounced low-blink alert condition ONLY when landmarks are present and tracked
    this.updateLowBlinkDebounce(blinksPerMinute, blinkRateStatus, timestampMs);

    // 1. Calculate individual eye EARs
    const leftEAR = computeEyeEAR(faceLandmarks, LEFT_EYE_LANDMARKS);
    const rightEAR = computeEyeEAR(faceLandmarks, RIGHT_EYE_LANDMARKS);
    const averageEAR = (leftEAR + rightEAR) / 2.0;

    // Cache valid metrics
    this.lastValidLeftEAR = leftEAR;
    this.lastValidRightEAR = rightEAR;
    this.lastValidAverageEAR = averageEAR;

    return this.processEAR(averageEAR, timestampMs, leftEAR, rightEAR);
  }

  /**
   * Core temporal state machine processing an EAR reading.
   * Public for deterministic testing with synthetic EAR sequences.
   */
  public processEAR(
    ear: number,
    timestampMs: number,
    leftEAR: number = ear,
    rightEAR: number = ear
  ): BlinkDetectionResult {
    if (this.sessionStartTimeMs === null) {
      this.sessionStartTimeMs = timestampMs;
    }

    let blinkDetected = false;

    switch (this.state) {
      case 'OPEN': {
        // Transition condition: EAR drops below or equal to close threshold.
        // Hysteresis: We ONLY transition to CLOSING/CLOSED when ear <= earCloseThreshold.
        if (ear <= this.config.earCloseThreshold) {
          this.state = 'CLOSING/CLOSED';
          this.closedStartTimeMs = timestampMs;
          this.disqualifiedSustainedClosure = false;
        }
        break;
      }

      case 'CLOSING/CLOSED': {
        // Check if closure duration has exceeded maxClosedDurationMs while still closed.
        if (this.closedStartTimeMs !== null) {
          const currentDuration = timestampMs - this.closedStartTimeMs;
          if (currentDuration > this.config.maxClosedDurationMs) {
            this.disqualifiedSustainedClosure = true;
          }
        }

        // Transition condition: EAR rises above or equal to open threshold.
        // Stays CLOSING/CLOSED until ear >= earOpenThreshold.
        if (ear >= this.config.earOpenThreshold) {
          this.state = 'OPENING/OPEN';

          if (this.closedStartTimeMs !== null) {
            const closedDuration = timestampMs - this.closedStartTimeMs;

            const isDurationValid =
              !this.disqualifiedSustainedClosure &&
              closedDuration >= this.config.minClosedDurationMs &&
              closedDuration <= this.config.maxClosedDurationMs;

            const timeSinceLastBlink =
              this.lastBlinkTimestampMs !== null
                ? timestampMs - this.lastBlinkTimestampMs
                : Infinity;

            const isRefractorySatisfied =
              timeSinceLastBlink >= this.config.minTimeBetweenBlinksMs;

            if (isDurationValid && isRefractorySatisfied) {
              // Valid single blink committed!
              this.blinkCount += 1;
              blinkDetected = true;
              this.lastBlinkDurationMs = Math.round(closedDuration);
              this.lastBlinkTimestampMs = timestampMs;
              // Add timestamp for rolling 60s window
              this.blinkTimestamps.push(timestampMs);
            }
          }

          this.closedStartTimeMs = null;
          this.disqualifiedSustainedClosure = false;
          this.state = 'OPEN';
        }
        break;
      }

      case 'OPENING/OPEN': {
        this.state = 'OPEN';
        break;
      }
    }

    // Prune rolling window timestamps older than rollingWindowMs
    this.pruneOldTimestamps(timestampMs);

    // Compute rate status & observation progress
    const { blinkRateStatus, blinksPerMinute, observationProgress } =
      this.computeRateMetrics(timestampMs);

    // Update debounced low-blink alert condition
    this.updateLowBlinkDebounce(blinksPerMinute, blinkRateStatus, timestampMs);

    const eyesClosed = this.state === 'CLOSING/CLOSED';

    return {
      leftEAR,
      rightEAR,
      averageEAR: ear,
      eyesClosed,
      eyeState: eyesClosed ? 'CLOSED' : 'OPEN',
      stateMachineState: this.state,
      blinkDetected,
      blinkCount: this.blinkCount,
      blinksPerMinute,
      blinkRateStatus,
      lowBlinkRate: this.lowBlinkRateAlert,
      lowBlinkDebounceState: this.lowBlinkDebounceState,
      blinkTimestamps: [...this.blinkTimestamps],
      observationProgress,
      lastBlinkDurationMs: this.lastBlinkDurationMs,
      lastBlinkTimestampMs: this.lastBlinkTimestampMs,
      trackingStatus: 'reliable',
    };
  }

  /**
   * Temporal debounce engine for the low-blink condition:
   * Condition: blinksPerMinute < lowBlinkRateThreshold (exact < 10).
   *
   * Rules:
   * - During 'collecting': Alert cannot fire; lowBlinkRate is false.
   * - In 'active':
   *   - If blinksPerMinute < 10: Begins accumulating for lowBlinkHoldMs before committing alert.
   *     If rate recovers back to >= 10 before holdMs, accumulation is cancelled.
   *   - Once alert is committed (triggered):
   *     If rate rises to >= 10: Begins recovery cooldown for lowBlinkCooldownMs before clearing alert.
   *     If rate dips back below 10 during cooldown, recovery is cancelled and alert remains.
   */
  private updateLowBlinkDebounce(
    blinksPerMinute: number | null,
    status: BlinkRateStatus,
    timestampMs: number
  ): void {
    if (status !== 'active' || blinksPerMinute === null) {
      // Inactive / collecting: alert is suppressed
      this.lowBlinkDebounceState = 'normal';
      this.lowBlinkAccumulatingStartMs = null;
      this.lowBlinkRecoveringStartMs = null;
      this.lowBlinkRateAlert = false;
      return;
    }

    // Exact requirement: blinksPerMinute < lowBlinkRateThreshold (< 10)
    // 9 is low, 10 and 11 are NOT low.
    const isCurrentlyLow = blinksPerMinute < this.config.lowBlinkRateThreshold;

    switch (this.lowBlinkDebounceState) {
      case 'normal': {
        if (isCurrentlyLow) {
          this.lowBlinkDebounceState = 'accumulating';
          this.lowBlinkAccumulatingStartMs = timestampMs;
        }
        break;
      }

      case 'accumulating': {
        if (!isCurrentlyLow) {
          // Fluctuated back up to >= 10 before hold duration: abort accumulation
          this.lowBlinkDebounceState = 'normal';
          this.lowBlinkAccumulatingStartMs = null;
        } else if (
          this.lowBlinkAccumulatingStartMs !== null &&
          timestampMs - this.lowBlinkAccumulatingStartMs >= this.config.lowBlinkHoldMs
        ) {
          // Low rate sustained for lowBlinkHoldMs: commit alert!
          this.lowBlinkDebounceState = 'triggered';
          this.lowBlinkAccumulatingStartMs = null;
          this.lowBlinkRateAlert = true;
        }
        break;
      }

      case 'triggered': {
        if (!isCurrentlyLow) {
          // Rate rose to >= 10: begin recovery cooldown
          this.lowBlinkDebounceState = 'recovering';
          this.lowBlinkRecoveringStartMs = timestampMs;
        }
        break;
      }

      case 'recovering': {
        if (isCurrentlyLow) {
          // Dipped back below 10 during recovery cooldown: abort recovery and stay triggered
          this.lowBlinkDebounceState = 'triggered';
          this.lowBlinkRecoveringStartMs = null;
        } else if (
          this.lowBlinkRecoveringStartMs !== null &&
          timestampMs - this.lowBlinkRecoveringStartMs >= this.config.lowBlinkCooldownMs
        ) {
          // Healthy rate sustained for lowBlinkCooldownMs: clear alert!
          this.lowBlinkDebounceState = 'normal';
          this.lowBlinkRecoveringStartMs = null;
          this.lowBlinkRateAlert = false;
        }
        break;
      }
    }
  }

  /**
   * Removes blink timestamps that are older than rollingWindowMs (60s) from timestampMs.
   */
  private pruneOldTimestamps(timestampMs: number): void {
    const cutoff = timestampMs - this.config.rollingWindowMs;
    let firstKeepIndex = 0;
    while (
      firstKeepIndex < this.blinkTimestamps.length &&
      this.blinkTimestamps[firstKeepIndex] < cutoff
    ) {
      firstKeepIndex++;
    }
    if (firstKeepIndex > 0) {
      this.blinkTimestamps.splice(0, firstKeepIndex);
    }
  }

  /**
   * Calculates blinks per minute over the rolling 60-second window,
   * accounting for the initial observation period.
   */
  private computeRateMetrics(timestampMs: number): {
    blinkRateStatus: BlinkRateStatus;
    blinksPerMinute: number | null;
    observationProgress: number;
  } {
    const elapsedSessionTime =
      this.sessionStartTimeMs !== null
        ? Math.max(0, timestampMs - this.sessionStartTimeMs)
        : 0;

    const observationProgress = Math.min(
      1.0,
      elapsedSessionTime / this.config.observationPeriodMs
    );

    const isObservationComplete =
      elapsedSessionTime >= this.config.observationPeriodMs;

    if (!isObservationComplete) {
      // During collecting, we do not emit a premature rate
      return {
        blinkRateStatus: 'collecting',
        blinksPerMinute: null,
        observationProgress,
      };
    }

    // When active, blinks in the 60-second window represent the user's recent rate
    // If observation has completed (e.g. 30s-60s), normalize to blinks/min for current window width
    const activeWindowDurationMs = Math.min(
      this.config.rollingWindowMs,
      elapsedSessionTime
    );
    const windowMinutes = activeWindowDurationMs / 60000.0;
    const rate =
      windowMinutes > 0
        ? Math.round(this.blinkTimestamps.length / windowMinutes)
        : this.blinkTimestamps.length;

    return {
      blinkRateStatus: 'active',
      blinksPerMinute: rate,
      observationProgress: 1.0,
    };
  }
}
