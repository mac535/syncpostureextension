import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface Point2D {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

/**
 * Calculates Euclidean distance between two 2D points in normalized screen space.
 */
export function distance(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates midpoint between two points.
 */
export function midpoint(a: Point2D, b: Point2D): Point2D {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: a.z !== undefined && b.z !== undefined ? (a.z + b.z) / 2 : undefined,
    visibility:
      a.visibility !== undefined && b.visibility !== undefined
        ? (a.visibility + b.visibility) / 2
        : a.visibility ?? b.visibility
  };
}

/**
 * Calculates vector from pointA to pointB (b - a).
 */
export function vector(a: Point2D, b: Point2D): Point2D {
  return {
    x: b.x - a.x,
    y: b.y - a.y
  };
}

/**
 * Calculates signed angle in degrees of vector from a to b relative to horizontal axis (X-axis).
 */
export function angleFromHorizontal(a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const rad = Math.atan2(dy, dx);
  return (rad * 180) / Math.PI;
}

/**
 * Calculates signed angle in degrees of vector from top to bottom relative to vertical axis (Y-axis down).
 * 0° is straight down. Positive = tilted right, Negative = tilted left.
 */
export function angleFromVertical(top: Point2D, bottom: Point2D): number {
  const dx = bottom.x - top.x;
  const dy = bottom.y - top.y;
  const rad = Math.atan2(dx, dy);
  return (rad * 180) / Math.PI;
}

/**
 * Calculates angle between two 2D vectors in degrees [0, 180].
 */
export function angleBetweenVectors(v1: Point2D, v2: Point2D): number {
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

  if (mag1 === 0 || mag2 === 0) return 0;

  const cosTheta = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cosTheta) * 180) / Math.PI;
}

/**
 * Verifies if a landmark exists and has finite coordinates.
 * In MediaPipe Tasks Vision, visibility can be undefined or low even for detected landmarks on webcams.
 */
export function isValidLandmark(
  lm: NormalizedLandmark | undefined,
  minVisibility = 0.2
): lm is NormalizedLandmark {
  if (!lm) return false;
  if (!Number.isFinite(lm.x) || !Number.isFinite(lm.y)) return false;
  // If visibility is populated and below threshold, reject. If undefined/null, accept if finite coordinates.
  if (typeof lm.visibility === 'number' && lm.visibility < minVisibility) return false;
  return true;
}
