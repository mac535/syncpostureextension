/**
 * TwentyTwentyTimer
 *
 * Implements the core 20-20-20 rule eye-break timer engine:
 * - 20 minutes of active monitoring/work
 * - 20 seconds of eye break ("look 20 feet away")
 * - Transition back to a fresh 20-minute monitoring cycle
 *
 * Architectural constraints:
 * - Framework independent: no React imports, no DOM manipulation
 * - Purely timestamp-based: robust against browser throttling, tab inactive states, and delayed rAF/setInterval
 * - Deterministic and fully testable via optional injectable `nowMs` timestamps
 */

export type TwentyTwentyState = 'monitoring' | 'break';

export interface TwentyTwentySnapshot {
  /** Current state machine phase */
  state: TwentyTwentyState;

  /** True if the timer session has been started and not reset */
  isActive: boolean;

  /** True if the timer session is currently paused */
  isPaused: boolean;

  /** Elapsed time in milliseconds in the current state */
  elapsedMs: number;

  /** Remaining time in milliseconds in the current state */
  remainingMs: number;

  /** Total elapsed monitoring time in milliseconds for the current 20-minute cycle */
  monitoringElapsedMs: number;

  /** Remaining monitoring time in milliseconds before the next break */
  monitoringRemainingMs: number;

  /** Total elapsed break time in milliseconds if in break phase (0 otherwise) */
  breakElapsedMs: number;

  /** Remaining break time in milliseconds if in break phase (20s otherwise) */
  breakRemainingMs: number;

  /** Normalized progress (0.0 to 1.0) of the current state */
  progress: number;
}

export interface TwentyTwentyConfig {
  /** Monitoring interval duration in milliseconds. Defaults to 20 minutes (1,200,000 ms) */
  monitoringDurationMs?: number;

  /** Break interval duration in milliseconds. Defaults to 20 seconds (20,000 ms) */
  breakDurationMs?: number;

  /** Optional callback fired on state machine transitions */
  onStateChange?: (from: TwentyTwentyState, to: TwentyTwentyState, snapshot: TwentyTwentySnapshot) => void;
}

export const DEFAULT_MONITORING_DURATION_MS = 20 * 60 * 1000; // 20 minutes
export const DEFAULT_BREAK_DURATION_MS = 20 * 1000;           // 20 seconds

export class TwentyTwentyTimer {
  private readonly monitoringDurationMs: number;
  private readonly breakDurationMs: number;
  private readonly onStateChange?: (from: TwentyTwentyState, to: TwentyTwentyState, snapshot: TwentyTwentySnapshot) => void;

  private state: TwentyTwentyState = 'monitoring';
  private isActive: boolean = false;
  private isPaused: boolean = false;

  /** Anchor timestamp for the current active running segment */
  private segmentStartedAt: number | null = null;

  /** Accumulated milliseconds in the current state across pause/resume segments */
  private accumulatedInStateMs: number = 0;

  constructor(config?: TwentyTwentyConfig) {
    this.monitoringDurationMs = config?.monitoringDurationMs ?? DEFAULT_MONITORING_DURATION_MS;
    this.breakDurationMs = config?.breakDurationMs ?? DEFAULT_BREAK_DURATION_MS;
    this.onStateChange = config?.onStateChange;
  }

  /**
   * Starts the 20-20-20 timer session.
   * If already running, this is a no-op.
   * If paused, this acts like resume().
   *
   * @param nowMs Optional explicit timestamp in ms (defaults to Date.now())
   */
  public start(nowMs?: number): void {
    const now = nowMs ?? Date.now();

    if (this.isActive && this.isPaused) {
      this.resume(now);
      return;
    }

    if (this.isActive) {
      return;
    }

    this.isActive = true;
    this.isPaused = false;
    this.state = 'monitoring';
    this.accumulatedInStateMs = 0;
    this.segmentStartedAt = now;
  }

  /**
   * Pauses the timer session without losing accumulated progress.
   *
   * @param nowMs Optional explicit timestamp in ms (defaults to Date.now())
   */
  public pause(nowMs?: number): void {
    if (!this.isActive || this.isPaused) {
      return;
    }

    const now = nowMs ?? Date.now();
    if (this.segmentStartedAt !== null) {
      this.accumulatedInStateMs += Math.max(0, now - this.segmentStartedAt);
    }

    this.segmentStartedAt = null;
    this.isPaused = true;
  }

  /**
   * Resumes the timer session from where it was paused.
   *
   * @param nowMs Optional explicit timestamp in ms (defaults to Date.now())
   */
  public resume(nowMs?: number): void {
    if (!this.isActive || !this.isPaused) {
      return;
    }

    const now = nowMs ?? Date.now();
    this.segmentStartedAt = now;
    this.isPaused = false;
  }

  /**
   * Resets the timer back to its initial inactive state.
   * Clears all timestamps and accumulated times. Safe to call multiple times.
   */
  public reset(): void {
    this.isActive = false;
    this.isPaused = false;
    this.state = 'monitoring';
    this.accumulatedInStateMs = 0;
    this.segmentStartedAt = null;
  }

  /**
   * Evaluates state machine transitions against the current timestamp,
   * advances states if thresholds are met, and returns an updated snapshot.
   *
   * @param nowMs Optional explicit timestamp in ms (defaults to Date.now())
   */
  public update(nowMs?: number): TwentyTwentySnapshot {
    const now = nowMs ?? Date.now();

    if (!this.isActive || this.isPaused) {
      return this.getSnapshot(now);
    }

    const totalElapsedInState = this.calculateElapsedInState(now);

    if (this.state === 'monitoring') {
      if (totalElapsedInState >= this.monitoringDurationMs) {
        // Transition: monitoring -> break
        const prevState = this.state;
        this.state = 'break';
        this.accumulatedInStateMs = 0;
        this.segmentStartedAt = now;

        const snapshot = this.getSnapshot(now);
        this.onStateChange?.(prevState, this.state, snapshot);
        return snapshot;
      }
    } else if (this.state === 'break') {
      if (totalElapsedInState >= this.breakDurationMs) {
        // Transition: break -> monitoring (fresh 20-minute cycle)
        const prevState = this.state;
        this.state = 'monitoring';
        this.accumulatedInStateMs = 0;
        this.segmentStartedAt = now;

        const snapshot = this.getSnapshot(now);
        this.onStateChange?.(prevState, this.state, snapshot);
        return snapshot;
      }
    }

    return this.getSnapshot(now);
  }

  /**
   * Returns a snapshot of the current timer status without altering state.
   *
   * @param nowMs Optional explicit timestamp in ms (defaults to Date.now())
   */
  public getSnapshot(nowMs?: number): TwentyTwentySnapshot {
    const now = nowMs ?? Date.now();

    if (!this.isActive) {
      return {
        state: 'monitoring',
        isActive: false,
        isPaused: false,
        elapsedMs: 0,
        remainingMs: this.monitoringDurationMs,
        monitoringElapsedMs: 0,
        monitoringRemainingMs: this.monitoringDurationMs,
        breakElapsedMs: 0,
        breakRemainingMs: this.breakDurationMs,
        progress: 0
      };
    }

    const totalElapsedInState = this.calculateElapsedInState(now);

    if (this.state === 'monitoring') {
      const elapsedMs = Math.min(this.monitoringDurationMs, totalElapsedInState);
      const remainingMs = Math.max(0, this.monitoringDurationMs - totalElapsedInState);
      const progress = this.monitoringDurationMs > 0 ? Math.min(1.0, elapsedMs / this.monitoringDurationMs) : 1.0;

      return {
        state: 'monitoring',
        isActive: true,
        isPaused: this.isPaused,
        elapsedMs,
        remainingMs,
        monitoringElapsedMs: elapsedMs,
        monitoringRemainingMs: remainingMs,
        breakElapsedMs: 0,
        breakRemainingMs: this.breakDurationMs,
        progress
      };
    } else {
      const elapsedMs = Math.min(this.breakDurationMs, totalElapsedInState);
      const remainingMs = Math.max(0, this.breakDurationMs - totalElapsedInState);
      const progress = this.breakDurationMs > 0 ? Math.min(1.0, elapsedMs / this.breakDurationMs) : 1.0;

      return {
        state: 'break',
        isActive: true,
        isPaused: this.isPaused,
        elapsedMs,
        remainingMs,
        monitoringElapsedMs: this.monitoringDurationMs,
        monitoringRemainingMs: 0,
        breakElapsedMs: elapsedMs,
        breakRemainingMs: remainingMs,
        progress
      };
    }
  }

  /**
   * Internal helper to compute total milliseconds spent in current state.
   */
  private calculateElapsedInState(now: number): number {
    if (!this.isActive) {
      return 0;
    }

    if (this.isPaused || this.segmentStartedAt === null) {
      return this.accumulatedInStateMs;
    }

    return this.accumulatedInStateMs + Math.max(0, now - this.segmentStartedAt);
  }
}
