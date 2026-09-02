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
  reason?: string;
}

/**
 * Classifies posture metrics into ergonomic states (good, slouching, leaning, or insufficient_data).
 */
export function classifyPosture(metrics: PostureMetrics): PostureClassification {
  // 1. Check data sufficiency & presence
  if (!metrics.isValid || metrics.confidence < POSTURE_THRESHOLDS.MIN_CONFIDENCE) {
    return {
      status: 'insufficient_data',
      severity: 0,
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
      reason: details || 'Forward head slouch detected'
    };
  }
}
