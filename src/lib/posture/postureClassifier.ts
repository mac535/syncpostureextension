import type { PostureMetrics } from './postureMetrics';
import type { PostureBaseline } from './calibration';

/**
 * Baseline ergonomic posture deviation thresholds relative to reference/calibrated upright posture.
 */
export const POSTURE_THRESHOLDS = {
  MIN_CONFIDENCE: 0.25,
  
  // Forward slouching thresholds (relative offset from baseline)
  HEAD_FORWARD_MILD: 0.14,
  HEAD_FORWARD_SIGNIFICANT: 0.24,
  HEAD_FORWARD_SEVERE: 0.36,

  HEAD_TORSO_ANGLE_MILD: 15.0,
  HEAD_TORSO_ANGLE_SIGNIFICANT: 25.0,
  HEAD_TORSO_ANGLE_SEVERE: 36.0,

  // Forward leaning toward screen (scale expansion ratio relative to baseline shoulder width)
  // Note: Approximated via visual scale expansion; 2D webcam cannot measure physical depth directly.
  SCREEN_LEAN_RATIO_MILD: 0.18,
  SCREEN_LEAN_RATIO_SIGNIFICANT: 0.28,
  SCREEN_LEAN_RATIO_SEVERE: 0.40,

  // Lateral leaning thresholds (degrees deviation from baseline)
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
 * When a baseline is supplied, deviations are measured relatively against the calibrated sitting posture.
 */
export function computeDeviationScore(
  metrics: PostureMetrics,
  baseline?: PostureBaseline | null
): number {
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

  const baseShoulderTilt = baseline?.isCalibrated ? baseline.shoulderTiltDeg : 0;
  const baseLateralTilt = baseline?.isCalibrated ? baseline.lateralTiltDeg : 0;
  const baseHeadForward = baseline?.isCalibrated ? baseline.headForwardOffset : 0;
  const baseHeadAngle = baseline?.isCalibrated ? baseline.headTorsoAngleDeg : 0;
  const baseShoulderWidth = baseline?.isCalibrated ? baseline.shoulderWidth : null;

  // 1. Relative Lateral Tilt contribution
  if (metrics.lateralTiltDeg !== null) {
    const relLateralTilt = Math.abs(metrics.lateralTiltDeg - baseLateralTilt);
    scores.push(
      clamp01(
        calcLinearRatio(
          relLateralTilt,
          POSTURE_THRESHOLDS.LATERAL_TILT_MILD,
          POSTURE_THRESHOLDS.LATERAL_TILT_SEVERE
        )
      )
    );
  }

  // 2. Relative Shoulder Tilt contribution
  if (metrics.shoulderTiltDeg !== null) {
    const relShoulderTilt = Math.abs(metrics.shoulderTiltDeg - baseShoulderTilt);
    scores.push(
      clamp01(
        calcLinearRatio(
          relShoulderTilt,
          POSTURE_THRESHOLDS.SHOULDER_TILT_MILD,
          POSTURE_THRESHOLDS.SHOULDER_TILT_SEVERE
        )
      )
    );
  }

  // 3. Relative Head Forward Offset contribution
  if (metrics.headForwardOffset !== null) {
    const relHeadForward = Math.max(0, metrics.headForwardOffset - baseHeadForward);
    scores.push(
      clamp01(
        calcLinearRatio(
          relHeadForward,
          POSTURE_THRESHOLDS.HEAD_FORWARD_MILD,
          POSTURE_THRESHOLDS.HEAD_FORWARD_SEVERE
        )
      )
    );
  }

  // 4. Relative Head-Torso Angle contribution
  if (metrics.headTorsoAngleDeg !== null) {
    const relHeadAngle = Math.abs(metrics.headTorsoAngleDeg - baseHeadAngle);
    scores.push(
      clamp01(
        calcLinearRatio(
          relHeadAngle,
          POSTURE_THRESHOLDS.HEAD_TORSO_ANGLE_MILD,
          POSTURE_THRESHOLDS.HEAD_TORSO_ANGLE_SEVERE
        )
      )
    );
  }

  // 5. Forward Screen Lean (torso leaning toward display estimated by shoulder scale expansion)
  if (metrics.shoulderWidth !== null && baseShoulderWidth && baseShoulderWidth > 0.08) {
    const scaleRatio = (metrics.shoulderWidth - baseShoulderWidth) / baseShoulderWidth;
    if (scaleRatio > 0) {
      scores.push(
        clamp01(
          calcLinearRatio(
            scaleRatio,
            POSTURE_THRESHOLDS.SCREEN_LEAN_RATIO_MILD,
            POSTURE_THRESHOLDS.SCREEN_LEAN_RATIO_SEVERE
          )
        )
      );
    }
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
export function classifyPosture(
  metrics: PostureMetrics,
  baseline?: PostureBaseline | null
): PostureClassification {
  const deviationScore = computeDeviationScore(metrics, baseline);

  // 1. Check data sufficiency & presence
  if (!metrics.isValid || metrics.confidence < POSTURE_THRESHOLDS.MIN_CONFIDENCE) {
    return {
      status: 'insufficient_data',
      severity: 0,
      deviationScore: 0,
      reason: 'Body landmarks not sufficiently visible or out of frame'
    };
  }

  const baseShoulderTilt = baseline?.isCalibrated ? baseline.shoulderTiltDeg : 0;
  const baseLateralTilt = baseline?.isCalibrated ? baseline.lateralTiltDeg : 0;
  const baseHeadForward = baseline?.isCalibrated ? baseline.headForwardOffset : 0;
  const baseHeadAngle = baseline?.isCalibrated ? baseline.headTorsoAngleDeg : 0;
  const baseShoulderWidth = baseline?.isCalibrated ? baseline.shoulderWidth : null;

  // Relative measurements
  const relLateralTilt = metrics.lateralTiltDeg !== null ? Math.abs(metrics.lateralTiltDeg - baseLateralTilt) : null;
  const relShoulderTilt = metrics.shoulderTiltDeg !== null ? Math.abs(metrics.shoulderTiltDeg - baseShoulderTilt) : null;
  const relHeadOffset = metrics.headForwardOffset !== null ? Math.max(0, metrics.headForwardOffset - baseHeadForward) : null;
  const relHeadAngle = metrics.headTorsoAngleDeg !== null ? Math.abs(metrics.headTorsoAngleDeg - baseHeadAngle) : null;
  const screenLeanRatio = (metrics.shoulderWidth !== null && baseShoulderWidth && baseShoulderWidth > 0.08)
    ? (metrics.shoulderWidth - baseShoulderWidth) / baseShoulderWidth
    : null;

  const hasLateral = relLateralTilt !== null;
  const hasShoulder = relShoulderTilt !== null;
  const hasHeadOffset = relHeadOffset !== null;
  const hasHeadAngle = relHeadAngle !== null;

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
  const lateralTilt = relLateralTilt ?? 0;
  const shoulderTilt = relShoulderTilt ?? 0;

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

  // 3. Evaluate Forward Slouching / Forward Screen Leaning Severity
  let slouchSeverity: PostureSeverity = 0;
  const headOffset = relHeadOffset ?? 0;
  const headAngle = relHeadAngle ?? 0;
  const leanForward = screenLeanRatio ?? 0;

  if (
    (hasHeadOffset && headOffset >= POSTURE_THRESHOLDS.HEAD_FORWARD_SEVERE) ||
    (hasHeadAngle && headAngle >= POSTURE_THRESHOLDS.HEAD_TORSO_ANGLE_SEVERE) ||
    leanForward >= POSTURE_THRESHOLDS.SCREEN_LEAN_RATIO_SEVERE
  ) {
    slouchSeverity = 3;
  } else if (
    (hasHeadOffset && headOffset >= POSTURE_THRESHOLDS.HEAD_FORWARD_SIGNIFICANT) ||
    (hasHeadAngle && headAngle >= POSTURE_THRESHOLDS.HEAD_TORSO_ANGLE_SIGNIFICANT) ||
    leanForward >= POSTURE_THRESHOLDS.SCREEN_LEAN_RATIO_SIGNIFICANT
  ) {
    slouchSeverity = 2;
  } else if (
    (hasHeadOffset && headOffset >= POSTURE_THRESHOLDS.HEAD_FORWARD_MILD) ||
    (hasHeadAngle && headAngle >= POSTURE_THRESHOLDS.HEAD_TORSO_ANGLE_MILD) ||
    leanForward >= POSTURE_THRESHOLDS.SCREEN_LEAN_RATIO_MILD
  ) {
    slouchSeverity = 1;
  }

  // 4. Primary Posture Determination
  if (leanSeverity === 0 && slouchSeverity === 0) {
    return {
      status: 'good',
      severity: 0,
      deviationScore,
      reason: 'Upright and well aligned with baseline'
    };
  }

  if (leanSeverity >= slouchSeverity && leanSeverity > 0) {
    const directionStr = metrics.leanDirection !== 'neutral' ? ` (${metrics.leanDirection})` : '';
    const details = [
      hasLateral ? `Torso tilt: ${relLateralTilt?.toFixed(1)}°${directionStr}` : null,
      hasShoulder ? `Shoulder tilt: ${relShoulderTilt?.toFixed(1)}°` : null
    ].filter(Boolean).join(', ');

    return {
      status: 'leaning',
      severity: leanSeverity,
      deviationScore,
      reason: details || 'Lateral torso lean detected'
    };
  } else {
    const details = [
      hasHeadOffset ? `Head offset: ${relHeadOffset?.toFixed(2)}` : null,
      hasHeadAngle ? `Neck angle: ${relHeadAngle?.toFixed(1)}°` : null,
      leanForward > 0.15 ? `Forward screen lean: +${(leanForward * 100).toFixed(0)}%` : null
    ].filter(Boolean).join(', ');

    return {
      status: 'slouching',
      severity: slouchSeverity,
      deviationScore,
      reason: details || 'Forward head slouch or screen lean detected'
    };
  }
}
