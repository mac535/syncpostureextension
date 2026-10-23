import type { PostureMetrics } from './postureMetrics';

export interface PostureBaseline {
  shoulderTiltDeg: number;
  lateralTiltDeg: number;
  headForwardOffset: number;
  headTorsoAngleDeg: number;
  shoulderWidth: number;
  torsoLength: number;
  timestamp: number;
  isCalibrated: boolean;
}

const STORAGE_KEY = 'posturesync_calibrated_baseline';

/**
 * Returns the default upright reference baseline when no user calibration exists.
 */
export function getDefaultBaseline(): PostureBaseline {
  return {
    shoulderTiltDeg: 0,
    lateralTiltDeg: 0,
    headForwardOffset: 0.05,
    headTorsoAngleDeg: 0,
    shoulderWidth: 0.35,
    torsoLength: 0.45,
    timestamp: 0,
    isCalibrated: false
  };
}

/**
 * Loads the saved posture baseline from chrome.storage.local or localStorage fallback.
 */
export async function loadBaseline(): Promise<PostureBaseline> {
  // Check chrome.storage.local if available
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEY);
      if (data && data[STORAGE_KEY]) {
        return data[STORAGE_KEY] as PostureBaseline;
      }
    } catch {
      // Fall through to localStorage
    }
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed as PostureBaseline;
      }
    }
  } catch {
    // Ignore error
  }

  return getDefaultBaseline();
}

/**
 * Saves a new posture baseline computed from stable upright posture metrics.
 */
export async function saveBaseline(metrics: PostureMetrics): Promise<PostureBaseline> {
  const baseline: PostureBaseline = {
    shoulderTiltDeg: metrics.shoulderTiltDeg ?? 0,
    lateralTiltDeg: metrics.lateralTiltDeg ?? 0,
    headForwardOffset: metrics.headForwardOffset ?? 0.05,
    headTorsoAngleDeg: metrics.headTorsoAngleDeg ?? 0,
    shoulderWidth: metrics.shoulderWidth ?? 0.35,
    torsoLength: metrics.torsoLength ?? 0.45,
    timestamp: Date.now(),
    isCalibrated: true
  };

  // Save to chrome.storage.local if available
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: baseline });
    } catch {
      // Fall through
    }
  }

  // Also save to localStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(baseline));
  } catch {
    // Ignore error
  }

  return baseline;
}

/**
 * Clears any saved baseline, resetting to ergonomic defaults.
 */
export async function clearBaseline(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      await chrome.storage.local.remove(STORAGE_KEY);
    } catch {
      // Fall through
    }
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}
