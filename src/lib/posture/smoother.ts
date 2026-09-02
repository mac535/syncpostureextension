import type { PostureMetrics } from './postureMetrics';

/**
 * Exponential Moving Average (EMA) smoothing for frame-by-frame posture metrics
 * that safely handles nullable metric values.
 */
export class PostureMetricsSmoother {
  private alpha: number;
  private currentSmoothed: PostureMetrics | null = null;

  constructor(alpha = 0.35) {
    this.alpha = Math.max(0.05, Math.min(1.0, alpha));
  }

  private smoothVal(prev: number | null, raw: number | null, precision: number): number | null {
    if (raw === null) return prev;
    if (prev === null) return raw;
    const a = this.alpha;
    return Number((prev * (1 - a) + raw * a).toFixed(precision));
  }

  public smooth(raw: PostureMetrics): PostureMetrics {
    if (!raw.isValid) {
      this.currentSmoothed = null;
      return raw;
    }

    if (!this.currentSmoothed) {
      this.currentSmoothed = { ...raw };
      return raw;
    }

    const prev = this.currentSmoothed;

    const smoothed: PostureMetrics = {
      lateralTiltDeg: this.smoothVal(prev.lateralTiltDeg, raw.lateralTiltDeg, 1),
      signedLateralTiltDeg: this.smoothVal(prev.signedLateralTiltDeg, raw.signedLateralTiltDeg, 1),
      shoulderTiltDeg: this.smoothVal(prev.shoulderTiltDeg, raw.shoulderTiltDeg, 1),
      headForwardOffset: this.smoothVal(prev.headForwardOffset, raw.headForwardOffset, 3),
      headTorsoAngleDeg: this.smoothVal(prev.headTorsoAngleDeg, raw.headTorsoAngleDeg, 1),
      shoulderWidth: this.smoothVal(prev.shoulderWidth, raw.shoulderWidth, 3),
      torsoLength: this.smoothVal(prev.torsoLength, raw.torsoLength, 3),
      confidence: Number((prev.confidence * (1 - this.alpha) + raw.confidence * this.alpha).toFixed(2)),
      leanDirection: raw.leanDirection,
      visibilityDebug: raw.visibilityDebug,
      isValid: true
    };

    this.currentSmoothed = smoothed;
    return smoothed;
  }

  public reset(): void {
    this.currentSmoothed = null;
  }
}
