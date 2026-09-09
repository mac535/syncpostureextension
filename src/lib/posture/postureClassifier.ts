import type { PostureMetrics } from './postureMetrics';

/**
 * Baseline posture thresholds for preliminary classification.
 */
export const POSTURE_THRESHOLDS = {
  MIN_CONFIDENCE: 0.25,
  
  // Forward slouching thresholds
  HEAD_FORWARD_MILD: 0.16,
  HEAD_FORWARD_SIGNIFICANT: 0.26,
  HEAD_FORWARD_SEVERE: 0.38,

  HEAD_TORSO_ANGLE_MILD: 18.0,
  HEAD_TORSO_ANGLE_SIGNIFICANT: 28.0,
  HEAD_TORSO_ANGLE_SEVERE: 38.0,

  // Lateral leaning thresholds
  LATERAL_TILT_MILD: 6.0,
  LATERAL_TILT_SIGNIFICANT: 12.0,
  LATERAL_TILT_SEVERE: 18.0,

  SHOULDER_TILT_MILD: 5.0,
  SHOULDER_TILT_SIGNIFICANT: 9.0,
  SHOULDER_TILT_SEVERE: 14.0
} as const;

export type PostureStatus = 'good' | 'slouching' | 'leaning' | 'insufficient_data';
export type PostureSeverity = 0 | 1 | 2 | 3;

export interface PostureClassification {
  status: PostureStatus;
  severity: PostureSeverity;
  deviationScore: number; // 0.0-1.0, continuous
  reason?: string;
}

/**
 * Computes a continuous deviation score from 0.0 (reference posture) to 1.0 (maximum deviation).
 * Interpolates each available metric linearly between its MILD and SEVERE thresholds,
 * clamped to [0, 1], and returns the maximum contribution across all metrics.
 */
export function computeDeviationScore(metrics: PostureMetrics): number {
  if (!metrics.isValid || metrics.confidence < POSTURE_THRESHOLDS.MIN_CONFIDENCE) {
    return 0;
  }

  const scores: number[] = [];

  const clamp01 = (val: number) => Math.max(0, Math.min(1, val));
  const calcLinearRatio = (val: number, mild: number, severe: number) => {
    if (val <= mild) return 0;
    if (val >= severe) return 1;
    return (val - mild) / (severe - mild);
  };

  // 1. Lateral Tilt contribution
  if (metrics.lateralTiltDeg !== null) {
    scores.push(
      clamp01(
        calcLinearRatio(
          metrics.lateralTiltDeg,
          POSTURE_THRESHOLDS.LATERAL_TILT_MILD,
          POSTURE_THRESHOLDS.LATERAL_TILT_SEVERE
        )
      )
    );
  }

  // 2. Shoulder Tilt contribution
  if (metrics.shoulderTiltDeg !== null) {
    scores.push(
      clamp01(
        calcLinearRatio(
          metrics.shoulderTiltDeg,
          POSTURE_THRESHOLDS.SHOULDER_TILT_MILD,
          POSTURE_THRESHOLDS.SHOULDER_TILT_SEVERE
        )
      )
    );
  }

  // 3. Head Forward Offset contribution
  if (metrics.headForwardOffset !== null) {
    scores.push(
      clamp01(
        calcLinearRatio(
          metrics.headForwardOffset,
          POSTURE_THRESHOLDS.HEAD_FORWARD_MILD,
          POSTURE_THRESHOLDS.HEAD_FORWARD_SEVERE
        )
      )
    );
  }

  // 4. Head-Torso Angle contribution
  if (metrics.headTorsoAngleDeg !== null) {
    scores.push(
      clamp01(
        calcLinearRatio(
          metrics.headTorsoAngleDeg,
          POSTURE_THRESHOLDS.HEAD_TORSO_ANGLE_MILD,
          POSTURE_THRESHOLDS.HEAD_TORSO_ANGLE_SEVERE
        )
      )
    );
  }

  if (scores.length === 0) {
    return 0;
  }

  // Maximum contribution across available metrics ("worst metric wins")
  const maxScore = Math.max(...scores);
  return Number(maxScore.toFixed(3));
}

/**
 * Classifies posture metrics into ergonomic states (good, slouching, leaning, or insufficient_data)
 * and computes continuous deviationScore alongside discrete severity.
 */
export function classifyPosture(metrics: PostureMetrics): PostureClassification {
  const deviationScore = computeDeviationScore(metrics);

  // 1. Check data sufficiency & presence
  if (!metrics.isValid || metrics.confidence < POSTURE_THRESHOLDS.MIN_CONFIDENCE) {
    return {
      status: 'insufficient_data',
      severity: 0,
      deviationScore: 0,
      reason: 'Body landmarks not sufficiently visible or out of frame'
    };
  }

  // Check if at least one primary posture angle is calculable
  const hasLateral = metrics.lateralTiltDeg !== null;
  const hasShoulder = metrics.shoulderTiltDeg !== null;
  const hasHeadOffset = metrics.headForwardOffset !== null;
  const hasHeadAngle = metrics.headTorsoAngleDeg !== null;

  if (!hasLateral && !hasShoulder && !hasHeadOffset && !hasHeadAngle) {
    return {
      status: 'insufficient_data',
      severity: 0,
      deviationScore: 0,
      reason: 'Key upper body landmarks missing'
    };
  }

  // 2. Evaluate Lateral Leaning Severity
  let leanSeverity: PostureSeverity = 0;
  const lateralTilt = metrics.lateralTiltDeg ?? 0;
  const shoulderTilt = metrics.shoulderTiltDeg ?? 0;

  if (
    (hasLateral && lateralTilt >= POSTURE_THRESHOLDS.LATERAL_TILT_SEVERE) ||
    (hasShoulder && shoulderTilt >= POSTURE_THRESHOLDS.SHOULDER_TILT_SEVERE)
  ) {
    leanSeverity = 3;
  } else if (
    (hasLateral && lateralTilt >= POSTURE_THRESHOLDS.LATERAL_TILT_SIGNIFICANT) ||
    (hasShoulder && shoulderTilt >= POSTURE_THRESHOLDS.SHOULDER_TILT_SIGNIFICANT)
  ) {
    leanSeverity = 2;
  } else if (
    (hasLateral && lateralTilt >= POSTURE_THRESHOLDS.LATERAL_TILT_MILD) ||
    (hasShoulder && shoulderTilt >= POSTURE_THRESHOLDS.SHOULDER_TILT_MILD)
  ) {
    leanSeverity = 1;
  }

  // 3. Evaluate Forward Slouching Severity
  let slouchSeverity: PostureSeverity = 0;
  const headOffset = metrics.headForwardOffset ?? 0;
  const headAngle = metrics.headTorsoAngleDeg ?? 0;

  if (
    (hasHeadOffset && headOffset >= POSTURE_THRESHOLDS.HEAD_FORWARD_SEVERE) ||
    (hasHeadAngle && headAngle >= POSTURE_THRESHOLDS.HEAD_TORSO_ANGLE_SEVERE)
  ) {
    slouchSeverity = 3;
  } else if (
    (hasHeadOffset && headOffset >= POSTURE_THRESHOLDS.HEAD_FORWARD_SIGNIFICANT) ||
    (hasHeadAngle && headAngle >= POSTURE_THRESHOLDS.HEAD_TORSO_ANGLE_SIGNIFICANT)
  ) {
    slouchSeverity = 2;
  } else if (
    (hasHeadOffset && headOffset >= POSTURE_THRESHOLDS.HEAD_FORWARD_MILD) ||
    (hasHeadAngle && headAngle >= POSTURE_THRESHOLDS.HEAD_TORSO_ANGLE_MILD)
  ) {
    slouchSeverity = 1;
  }

  // 4. Primary Posture Determination
  if (leanSeverity === 0 && slouchSeverity === 0) {
    return {
      status: 'good',
      severity: 0,
      deviationScore,
      reason: 'Upright and well aligned'
    };
  }

  if (leanSeverity >= slouchSeverity && leanSeverity > 0) {
    const directionStr = metrics.leanDirection !== 'neutral' ? ` (${metrics.leanDirection})` : '';
    const details = [
      hasLateral ? `Torso tilt: ${metrics.lateralTiltDeg}°${directionStr}` : null,
      hasShoulder ? `Shoulder tilt: ${metrics.shoulderTiltDeg}°` : null
    ].filter(Boolean).join(', ');

    return {
      status: 'leaning',
      severity: leanSeverity,
      deviationScore,
      reason: details || 'Lateral torso lean detected'
    };
  } else {
    const details = [
      hasHeadOffset ? `Head offset: ${metrics.headForwardOffset}` : null,
      hasHeadAngle ? `Head-torso angle: ${metrics.headTorsoAngleDeg}°` : null
    ].filter(Boolean).join(', ');

    return {
      status: 'slouching',
      severity: slouchSeverity,
      deviationScore,
      reason: details || 'Forward head slouch detected'
    };
  }
}
