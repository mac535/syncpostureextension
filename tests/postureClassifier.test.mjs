import test from 'node:test';
import assert from 'node:assert/strict';

const POSTURE_THRESHOLDS = {
  MIN_CONFIDENCE: 0.25,
  HEAD_FORWARD_MILD: 0.14,
  HEAD_FORWARD_SEVERE: 0.36,
  HEAD_TORSO_ANGLE_MILD: 15.0,
  HEAD_TORSO_ANGLE_SEVERE: 36.0,
  SCREEN_LEAN_RATIO_MILD: 0.18,
  SCREEN_LEAN_RATIO_SEVERE: 0.40,
  LATERAL_TILT_MILD: 6.0,
  LATERAL_TILT_SEVERE: 18.0,
  SHOULDER_TILT_MILD: 5.0,
  SHOULDER_TILT_SEVERE: 14.0
};

function computeDeviationScore(metrics, baseline = null) {
  if (!metrics.isValid || metrics.confidence < POSTURE_THRESHOLDS.MIN_CONFIDENCE) {
    return 0;
  }
  const scores = [];
  const clamp01 = (val) => Math.max(0, Math.min(1, val));
  const calcLinearRatio = (val, mild, severe) => {
    if (val <= mild) return 0;
    if (val >= severe) return 1;
    return (val - mild) / (severe - mild);
  };

  const baseShoulderTilt = baseline?.isCalibrated ? baseline.shoulderTiltDeg : 0;
  const baseLateralTilt = baseline?.isCalibrated ? baseline.lateralTiltDeg : 0;
  const baseHeadForward = baseline?.isCalibrated ? baseline.headForwardOffset : 0;
  const baseHeadAngle = baseline?.isCalibrated ? baseline.headTorsoAngleDeg : 0;
  const baseShoulderWidth = baseline?.isCalibrated ? baseline.shoulderWidth : null;

  if (metrics.lateralTiltDeg !== null) {
    const relLateralTilt = Math.abs(metrics.lateralTiltDeg - baseLateralTilt);
    scores.push(clamp01(calcLinearRatio(relLateralTilt, POSTURE_THRESHOLDS.LATERAL_TILT_MILD, POSTURE_THRESHOLDS.LATERAL_TILT_SEVERE)));
  }

  if (metrics.shoulderTiltDeg !== null) {
    const relShoulderTilt = Math.abs(metrics.shoulderTiltDeg - baseShoulderTilt);
    scores.push(clamp01(calcLinearRatio(relShoulderTilt, POSTURE_THRESHOLDS.SHOULDER_TILT_MILD, POSTURE_THRESHOLDS.SHOULDER_TILT_SEVERE)));
  }

  if (metrics.headForwardOffset !== null) {
    const relHeadForward = Math.max(0, metrics.headForwardOffset - baseHeadForward);
    scores.push(clamp01(calcLinearRatio(relHeadForward, POSTURE_THRESHOLDS.HEAD_FORWARD_MILD, POSTURE_THRESHOLDS.HEAD_FORWARD_SEVERE)));
  }

  if (metrics.headTorsoAngleDeg !== null) {
    const relHeadAngle = Math.abs(metrics.headTorsoAngleDeg - baseHeadAngle);
    scores.push(clamp01(calcLinearRatio(relHeadAngle, POSTURE_THRESHOLDS.HEAD_TORSO_ANGLE_MILD, POSTURE_THRESHOLDS.HEAD_TORSO_ANGLE_SEVERE)));
  }

  if (metrics.shoulderWidth !== null && baseShoulderWidth && baseShoulderWidth > 0.08) {
    const scaleRatio = (metrics.shoulderWidth - baseShoulderWidth) / baseShoulderWidth;
    if (scaleRatio > 0) {
      scores.push(clamp01(calcLinearRatio(scaleRatio, POSTURE_THRESHOLDS.SCREEN_LEAN_RATIO_MILD, POSTURE_THRESHOLDS.SCREEN_LEAN_RATIO_SEVERE)));
    }
  }

  if (scores.length === 0) return 0;
  return Number(Math.max(...scores).toFixed(3));
}

test('PostureClassifier: Upright posture yields 0 deviation score', () => {
  const goodMetrics = {
    isValid: true,
    confidence: 0.95,
    lateralTiltDeg: 1.0,
    shoulderTiltDeg: 1.5,
    headForwardOffset: 0.05,
    headTorsoAngleDeg: 4.0,
    shoulderWidth: 0.35,
    torsoLength: 0.45
  };

  const score = computeDeviationScore(goodMetrics);
  assert.equal(score, 0, 'Good posture should have 0 deviation score');
});

test('PostureClassifier: Forward slouching yields elevated deviation score', () => {
  const slouchMetrics = {
    isValid: true,
    confidence: 0.90,
    lateralTiltDeg: 2.0,
    shoulderTiltDeg: 2.0,
    headForwardOffset: 0.30, // Well above HEAD_FORWARD_MILD (0.14)
    headTorsoAngleDeg: 28.0, // Above HEAD_TORSO_ANGLE_MILD (15.0)
    shoulderWidth: 0.35,
    torsoLength: 0.45
  };

  const score = computeDeviationScore(slouchMetrics);
  assert.ok(score >= 0.5, `Slouch score should be significant, got ${score}`);
});

test('PostureClassifier: Lateral lean yields elevated deviation score', () => {
  const leanMetrics = {
    isValid: true,
    confidence: 0.92,
    lateralTiltDeg: 16.0, // Substantial torso tilt
    shoulderTiltDeg: 11.0,
    headForwardOffset: 0.06,
    headTorsoAngleDeg: 5.0,
    shoulderWidth: 0.35,
    torsoLength: 0.45
  };

  const score = computeDeviationScore(leanMetrics);
  assert.ok(score >= 0.7, `Lean score should be high, got ${score}`);
});

test('PostureClassifier: Relative baseline calibration accounts for user natural spine posture', () => {
  // User naturally sits with a 4.0 deg slight shoulder tilt
  const baseline = {
    shoulderTiltDeg: 4.0,
    lateralTiltDeg: 2.0,
    headForwardOffset: 0.08,
    headTorsoAngleDeg: 6.0,
    shoulderWidth: 0.34,
    torsoLength: 0.44,
    isCalibrated: true
  };

  // Current frame sits identically to their calibrated posture
  const currentMetrics = {
    isValid: true,
    confidence: 0.95,
    shoulderTiltDeg: 4.2,
    lateralTiltDeg: 2.1,
    headForwardOffset: 0.085,
    headTorsoAngleDeg: 6.5,
    shoulderWidth: 0.34,
    torsoLength: 0.44
  };

  const score = computeDeviationScore(currentMetrics, baseline);
  assert.equal(score, 0, 'Should have 0 deviation when matched with calibrated baseline');
});

test('PostureClassifier: Forward screen lean detected via shoulder scale expansion', () => {
  const baseline = {
    shoulderTiltDeg: 0,
    lateralTiltDeg: 0,
    headForwardOffset: 0.05,
    headTorsoAngleDeg: 5.0,
    shoulderWidth: 0.30,
    torsoLength: 0.45,
    isCalibrated: true
  };

  // User leans forward toward camera, shoulder width expands by 30%
  const leanScreenMetrics = {
    isValid: true,
    confidence: 0.95,
    shoulderTiltDeg: 1.0,
    lateralTiltDeg: 1.0,
    headForwardOffset: 0.05,
    headTorsoAngleDeg: 5.0,
    shoulderWidth: 0.39, // (0.39 - 0.30) / 0.30 = +30% expansion
    torsoLength: 0.45
  };

  const score = computeDeviationScore(leanScreenMetrics, baseline);
  assert.ok(score > 0.4, `Should detect forward screen lean from scale expansion, got ${score}`);
});
