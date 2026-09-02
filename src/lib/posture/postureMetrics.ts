import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import {
  distance,
  midpoint,
  vector,
  angleFromHorizontal,
  angleFromVertical,
  angleBetweenVectors,
  isValidLandmark,
  type Point2D
} from './geometry';

/**
 * Standard MediaPipe Pose Landmark Indices.
 */
export const POSE_LANDMARK_INDEX = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24
} as const;

export type PoseLandmarkName = keyof typeof POSE_LANDMARK_INDEX;

/**
 * Detailed visibility status for debug inspection.
 */
export interface LandmarkVisibilityDebug {
  nose: number | null;
  leftEar: number | null;
  rightEar: number | null;
  leftShoulder: number | null;
  rightShoulder: number | null;
  leftHip: number | null;
  rightHip: number | null;
}

/**
 * Structured ergonomic posture metrics extracted from a single frame.
 * Values are number or null (when insufficient landmarks exist for that specific metric).
 */
export interface PostureMetrics {
  lateralTiltDeg: number | null;       // Angle of torso relative to vertical in degrees (magnitude)
  signedLateralTiltDeg: number | null; // Signed torso tilt: positive = right, negative = left
  shoulderTiltDeg: number | null;      // Angle of shoulder line relative to horizontal in degrees
  headForwardOffset: number | null;    // Horizontal head displacement relative to shoulders, normalized by shoulderWidth
  headTorsoAngleDeg: number | null;    // Angle between head vector and torso vector
  shoulderWidth: number | null;        // Euclidean distance between shoulders in screen space
  torsoLength: number | null;          // Euclidean distance between shoulder center and hip center
  confidence: number;                  // Landmark tracking confidence [0.0 - 1.0]
  leanDirection: 'neutral' | 'left' | 'right';
  visibilityDebug: LandmarkVisibilityDebug;
  isValid: boolean;
}

/**
 * Extract verified named landmark from array.
 */
export function getPoseLandmark(
  landmarks: NormalizedLandmark[],
  name: PoseLandmarkName
): NormalizedLandmark | undefined {
  const index = POSE_LANDMARK_INDEX[name];
  const lm = landmarks[index];
  return isValidLandmark(lm) ? lm : undefined;
}

/**
 * Computes posture metrics modularly per available landmark group.
 */
export function computePostureMetrics(landmarks: NormalizedLandmark[] | undefined): PostureMetrics {
  const emptyVisibility: LandmarkVisibilityDebug = {
    nose: null,
    leftEar: null,
    rightEar: null,
    leftShoulder: null,
    rightShoulder: null,
    leftHip: null,
    rightHip: null
  };

  const defaultInvalidMetrics: PostureMetrics = {
    lateralTiltDeg: null,
    signedLateralTiltDeg: null,
    shoulderTiltDeg: null,
    headForwardOffset: null,
    headTorsoAngleDeg: null,
    shoulderWidth: null,
    torsoLength: null,
    confidence: 0,
    leanDirection: 'neutral',
    visibilityDebug: emptyVisibility,
    isValid: false
  };

  if (!landmarks || landmarks.length < 25) {
    return defaultInvalidMetrics;
  }

  // 1. Retrieve individual landmarks
  const nose = getPoseLandmark(landmarks, 'NOSE');
  const leftEar = getPoseLandmark(landmarks, 'LEFT_EAR');
  const rightEar = getPoseLandmark(landmarks, 'RIGHT_EAR');
  const leftShoulder = getPoseLandmark(landmarks, 'LEFT_SHOULDER');
  const rightShoulder = getPoseLandmark(landmarks, 'RIGHT_SHOULDER');
  const leftHip = getPoseLandmark(landmarks, 'LEFT_HIP');
  const rightHip = getPoseLandmark(landmarks, 'RIGHT_HIP');

  const visibilityDebug: LandmarkVisibilityDebug = {
    nose: nose?.visibility !== undefined ? Number(nose.visibility.toFixed(2)) : (nose ? 1.0 : null),
    leftEar: leftEar?.visibility !== undefined ? Number(leftEar.visibility.toFixed(2)) : (leftEar ? 1.0 : null),
    rightEar: rightEar?.visibility !== undefined ? Number(rightEar.visibility.toFixed(2)) : (rightEar ? 1.0 : null),
    leftShoulder: leftShoulder?.visibility !== undefined ? Number(leftShoulder.visibility.toFixed(2)) : (leftShoulder ? 1.0 : null),
    rightShoulder: rightShoulder?.visibility !== undefined ? Number(rightShoulder.visibility.toFixed(2)) : (rightShoulder ? 1.0 : null),
    leftHip: leftHip?.visibility !== undefined ? Number(leftHip.visibility.toFixed(2)) : (leftHip ? 1.0 : null),
    rightHip: rightHip?.visibility !== undefined ? Number(rightHip.visibility.toFixed(2)) : (rightHip ? 1.0 : null)
  };

  // Check presence count of primary anchors
  const allAnchors = [nose, leftEar, rightEar, leftShoulder, rightShoulder, leftHip, rightHip];
  const presentCount = allAnchors.filter(Boolean).length;

  if (presentCount === 0 || (!leftShoulder && !rightShoulder)) {
    return {
      ...defaultInvalidMetrics,
      visibilityDebug,
      confidence: 0
    };
  }

  // Calculate confidence score [0.0 - 1.0] based on available anchors
  const visList = allAnchors.map((lm) => (lm ? (lm.visibility ?? 0.85) : 0));
  const confidence = Number((visList.reduce((a, b) => a + b, 0) / allAnchors.length).toFixed(2));

  // 2. Compute Shoulder Dimensions & Tilt
  let shoulderWidth: number | null = null;
  let shoulderCenter: Point2D | null = null;
  let shoulderTiltDeg: number | null = null;

  if (leftShoulder && rightShoulder) {
    shoulderWidth = Number(distance(leftShoulder, rightShoulder).toFixed(3));
    shoulderCenter = midpoint(leftShoulder, rightShoulder);

    const rawShoulderAngle = angleFromHorizontal(leftShoulder, rightShoulder);
    shoulderTiltDeg = Number(
      Math.abs(Math.abs(rawShoulderAngle) > 90 ? Math.abs(rawShoulderAngle) - 180 : rawShoulderAngle).toFixed(1)
    );
  } else if (leftShoulder) {
    shoulderCenter = leftShoulder;
  } else if (rightShoulder) {
    shoulderCenter = rightShoulder;
  }

  // 3. Compute Hip Center & Torso Dimensions
  let hipCenter: Point2D | null = null;
  let torsoLength: number | null = null;

  if (leftHip && rightHip) {
    hipCenter = midpoint(leftHip, rightHip);
  } else if (leftHip) {
    hipCenter = leftHip;
  } else if (rightHip) {
    hipCenter = rightHip;
  } else if (shoulderCenter) {
    // If hips are below camera view (standard desk sitting), synthesize hip anchor from torso projection
    hipCenter = {
      x: shoulderCenter.x,
      y: Math.min(1.0, shoulderCenter.y + 0.45)
    };
  }

  if (shoulderCenter && hipCenter) {
    torsoLength = Number(distance(shoulderCenter, hipCenter).toFixed(3));
  }

  // 4. Lateral Torso Tilt
  let lateralTiltDeg: number | null = null;
  let signedLateralTiltDeg: number | null = null;
  let leanDirection: 'neutral' | 'left' | 'right' = 'neutral';

  if (shoulderCenter && hipCenter) {
    signedLateralTiltDeg = Number(angleFromVertical(shoulderCenter, hipCenter).toFixed(1));
    lateralTiltDeg = Number(Math.abs(signedLateralTiltDeg).toFixed(1));

    if (signedLateralTiltDeg > 3.0) {
      leanDirection = 'right';
    } else if (signedLateralTiltDeg < -3.0) {
      leanDirection = 'left';
    }
  }

  // 5. Head Reference Point (Ear Center or Nose)
  let headCenter: Point2D | null = null;
  if (leftEar && rightEar) {
    const earMid = midpoint(leftEar, rightEar);
    headCenter = nose ? midpoint(earMid, nose) : earMid;
  } else if (leftEar && nose) {
    headCenter = midpoint(leftEar, nose);
  } else if (rightEar && nose) {
    headCenter = midpoint(rightEar, nose);
  } else if (nose) {
    headCenter = nose;
  } else if (leftEar) {
    headCenter = leftEar;
  } else if (rightEar) {
    headCenter = rightEar;
  }

  // 6. Forward Head Offset
  let headForwardOffset: number | null = null;
  if (headCenter && shoulderCenter) {
    const rawDisplacement = Math.abs(headCenter.x - shoulderCenter.x);
    const normalizationScale = shoulderWidth && shoulderWidth > 0.05 ? shoulderWidth : 0.25;
    headForwardOffset = Number((rawDisplacement / normalizationScale).toFixed(3));
  }

  // 7. Head-Torso Alignment Angle
  let headTorsoAngleDeg: number | null = null;
  if (headCenter && shoulderCenter && hipCenter) {
    const headVec = vector(shoulderCenter, headCenter);
    const torsoVec = vector(hipCenter, shoulderCenter);
    headTorsoAngleDeg = Number(angleBetweenVectors(headVec, torsoVec).toFixed(1));
  }

  return {
    lateralTiltDeg,
    signedLateralTiltDeg,
    shoulderTiltDeg,
    headForwardOffset,
    headTorsoAngleDeg,
    shoulderWidth,
    torsoLength,
    confidence,
    leanDirection,
    visibilityDebug,
    isValid: true
  };
}
