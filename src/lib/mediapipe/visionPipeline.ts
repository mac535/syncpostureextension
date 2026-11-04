import {
  FilesetResolver,
  PoseLandmarker,
  FaceLandmarker,
  FaceDetector,
  type PoseLandmarkerResult,
  type FaceLandmarkerResult,
  type FaceDetectorResult,
  type NormalizedLandmark
} from '@mediapipe/tasks-vision';

export interface DetectedFaceBox {
  originX: number;
  originY: number;
  width: number;
  height: number;
  confidence?: number;
}

export interface VisionPipelineResults {
  poseResult: PoseLandmarkerResult | null;
  faceResult: FaceLandmarkerResult | null;
  faceDetectorResult?: FaceDetectorResult | null;
  timestampMs: number;
}

export interface VisionPipelineStatus {
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  poseDetected: boolean;
  faceDetected: boolean;
  poseLandmarksCount: number;
  faceLandmarksCount: number;
  fps: number;
}

const WASM_LOCAL_URL = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL
  ? chrome.runtime.getURL('wasm')
  : '/wasm';

// Route MediaPipe internal Emscripten C++ logs to console.debug instead of console.warn
// to prevent noisy yellow warning stacks in browser DevTools.
if (typeof window !== 'undefined') {
  (window as unknown as { dbg?: (msg: string) => void }).dbg = (msg: string) => {
    if (/error|failed/i.test(msg) && !/OpenGL error checking is disabled|NORM_RECT without IMAGE_DIMENSIONS/i.test(msg)) {
      console.warn('[MediaPipe WASM]', msg);
    } else {
      console.debug('[MediaPipe WASM]', msg);
    }
  };
}
const WASM_CDN_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const POSE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const FACE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const FACE_DETECTOR_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite';

let poseLandmarkerInstance: PoseLandmarker | null = null;
let faceLandmarkerInstance: FaceLandmarker | null = null;
let faceDetectorInstance: FaceDetector | null = null;
let initPromise: Promise<{
  poseLandmarker: PoseLandmarker;
  faceLandmarker: FaceLandmarker | null;
  faceDetector: FaceDetector | null;
}> | null = null;
let lastMonotonicTimestampMs = 0;

/**
 * Guarantees monotonic timestamps for MediaPipe Tasks Vision.
 * Calling detectForVideo with a timestamp <= previous timestamp will crash MediaPipe.
 */
export function ensureMonotonicTimestamp(timestampMs?: number): number {
  const candidate = typeof timestampMs === 'number' && Number.isFinite(timestampMs) && timestampMs > 0
    ? timestampMs
    : performance.now();
  const safe = candidate > lastMonotonicTimestampMs ? candidate : lastMonotonicTimestampMs + 1;
  lastMonotonicTimestampMs = safe;
  return safe;
}

/**
 * Resets the monotonic timestamp counter (useful during testing or session restart).
 */
export function resetMonotonicTimestamp(initialMs: number = 0): void {
  lastMonotonicTimestampMs = initialMs;
}

/**
 * Returns the current readiness of each vision model.
 */
export function getVisionPipelineStatus(): VisionPipelineStatus {
  return {
    isReady: poseLandmarkerInstance !== null,
    isLoading: initPromise !== null && poseLandmarkerInstance === null,
    error: null,
    poseDetected: poseLandmarkerInstance !== null,
    faceDetected: faceLandmarkerInstance !== null,
    poseLandmarksCount: poseLandmarkerInstance !== null ? 33 : 0,
    faceLandmarksCount: faceLandmarkerInstance !== null ? 478 : 0,
    fps: 0
  };
}

/**
 * Safely closes and cleans up all active MediaPipe model instances.
 */
export function disposeMediaPipe(): void {
  try {
    poseLandmarkerInstance?.close();
  } catch (err) {
    console.debug('PoseLandmarker close:', err);
  }
  try {
    faceLandmarkerInstance?.close();
  } catch (err) {
    console.debug('FaceLandmarker close:', err);
  }
  try {
    faceDetectorInstance?.close();
  } catch (err) {
    console.debug('FaceDetector close:', err);
  }
  poseLandmarkerInstance = null;
  faceLandmarkerInstance = null;
  faceDetectorInstance = null;
  initPromise = null;
  lastMonotonicTimestampMs = 0;
}

/**
 * Initializes MediaPipe Tasks Vision FilesetResolver and PoseLandmarker first,
 * with non-blocking background initialization of secondary detectors.
 * Subsequent calls safely return the existing promise or initialized instances.
 */
export async function initializeMediaPipe(): Promise<{
  poseLandmarker: PoseLandmarker;
  faceLandmarker: FaceLandmarker | null;
  faceDetector: FaceDetector | null;
}> {
  if (poseLandmarkerInstance) {
    return {
      poseLandmarker: poseLandmarkerInstance,
      faceLandmarker: faceLandmarkerInstance,
      faceDetector: faceDetectorInstance
    };
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      let vision;
      try {
        vision = await FilesetResolver.forVisionTasks(WASM_LOCAL_URL);
      } catch (localErr) {
        console.warn('PostureSync: local WASM loading failed, falling back to CDN:', localErr);
        vision = await FilesetResolver.forVisionTasks(WASM_CDN_URL);
      }

      // 1. Initialize PoseLandmarker with GPU delegate and CPU fallback for Edge compatibility
      let poseLandmarker: PoseLandmarker;
      try {
        poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: POSE_MODEL_URL,
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
      } catch (gpuErr) {
        console.warn('PostureSync: GPU delegate initialization failed for PoseLandmarker in Edge/Chromium. Falling back to CPU:', gpuErr);
        poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: POSE_MODEL_URL,
            delegate: 'CPU'
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
      }
      poseLandmarkerInstance = poseLandmarker;

      // 2. Initialize FaceLandmarker in background with CPU fallback for Edge
      FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: FACE_MODEL_URL,
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputFaceBlendshapes: false // Optimized: avoid 52 blendshapes compute overhead
      })
        .then((fl) => {
          faceLandmarkerInstance = fl;
        })
        .catch(async () => {
          try {
            const cpuFl = await FaceLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: FACE_MODEL_URL,
                delegate: 'CPU'
              },
              runningMode: 'VIDEO',
              numFaces: 1,
              minFaceDetectionConfidence: 0.5,
              minFacePresenceConfidence: 0.5,
              minTrackingConfidence: 0.5,
              outputFaceBlendshapes: false
            });
            faceLandmarkerInstance = cpuFl;
          } catch (err) {
            console.warn('FaceLandmarker background initialization skipped:', err);
          }
        });

      // 3. Initialize FaceDetector in background with CPU fallback for Edge
      FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: FACE_DETECTOR_MODEL_URL,
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.5,
        minSuppressionThreshold: 0.3
      })
        .then((fd) => {
          faceDetectorInstance = fd;
        })
        .catch(async () => {
          try {
            const cpuFd = await FaceDetector.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: FACE_DETECTOR_MODEL_URL,
                delegate: 'CPU'
              },
              runningMode: 'VIDEO',
              minDetectionConfidence: 0.5,
              minSuppressionThreshold: 0.3
            });
            faceDetectorInstance = cpuFd;
          } catch (err) {
            console.warn('FaceDetector background initialization skipped:', err);
          }
        });

      return { poseLandmarker, faceLandmarker: faceLandmarkerInstance, faceDetector: faceDetectorInstance };
    } catch (err) {
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

export interface DetectLandmarksOptions {
  /** If true, skips the 478-point Face Landmarker (e.g. multi-person mode or unoccupied frame) */
  skipFaceLandmarker?: boolean;
}

/**
 * Executes optimized video frame inference.
 * Runs PoseLandmarker as primary pass. Heavy FaceLandmarker is intelligently skipped
 * when multi-person mode is active or when no pose is present in the frame.
 */
export function detectLandmarksForVideo(
  video: HTMLVideoElement,
  timestampMs?: number,
  options?: DetectLandmarksOptions
): VisionPipelineResults | null {
  if (!poseLandmarkerInstance) {
    return null;
  }

  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    return null;
  }

  const safeTimestampMs = ensureMonotonicTimestamp(timestampMs);

  try {
    // 1. Primary Pose Landmark Inference
    const poseResult = poseLandmarkerInstance.detectForVideo(video, safeTimestampMs);
    const hasPose = Boolean(poseResult && poseResult.landmarks && poseResult.landmarks.length > 0);

    // 2. Face Landmark Inference for real Eye Aspect Ratio (EAR) blink tracking
    // Optimized: Skip 478-point dense mesh when explicitly asked or if no person is present in the frame
    let faceResult: FaceLandmarkerResult | null = null;
    const shouldRunFace = faceLandmarkerInstance !== null && !options?.skipFaceLandmarker && hasPose;

    if (shouldRunFace && faceLandmarkerInstance) {
      try {
        faceResult = faceLandmarkerInstance.detectForVideo(video, safeTimestampMs);
      } catch {
        faceResult = null;
      }
    }

    return {
      poseResult,
      faceResult,
      timestampMs: safeTimestampMs
    };
  } catch (err) {
    console.error('Inference error during frame processing:', err);
    return null;
  }
}

/**
 * Runs FaceDetector at a relaxed cadence (e.g. 1-2 FPS / every 500-1000ms).
 */
export function detectFacesForVideo(
  video: HTMLVideoElement,
  timestampMs?: number
): FaceDetectorResult | null {
  if (!faceDetectorInstance) {
    return null;
  }

  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    return null;
  }

  const safeTimestampMs = ensureMonotonicTimestamp(timestampMs);

  try {
    return faceDetectorInstance.detectForVideo(video, safeTimestampMs);
  } catch (err) {
    console.warn('FaceDetector detection error:', err);
    return null;
  }
}

/**
 * Standard Pose keypoint connections for developer skeleton overlay.
 */
export const POSE_CONNECTIONS: [number, number][] = [
  // Torso & Shoulders
  [11, 12], // left shoulder to right shoulder
  [11, 23], // left shoulder to left hip
  [12, 24], // right shoulder to right hip
  [23, 24], // left hip to right hip
  // Left Arm
  [11, 13], [13, 15],
  // Right Arm
  [12, 14], [14, 16],
  // Head / Ears / Eyes
  [0, 1], [1, 2], [2, 3], [3, 7], // Right eye & ear
  [0, 4], [4, 5], [5, 6], [6, 8], // Left eye & ear
  [9, 10] // Mouth
];

/**
 * Helper to render pose & face landmark points onto a target 2D canvas context.
 * Uses batched path creation to minimize canvas draw call overhead by >90%.
 */
export function drawLandmarksOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  poseLandmarks?: NormalizedLandmark[],
  faceLandmarks?: NormalizedLandmark[]
): void {
  ctx.clearRect(0, 0, width, height);

  // 1. Render Pose Skeleton (Batched path)
  if (poseLandmarks && poseLandmarks.length > 0) {
    ctx.strokeStyle = '#38bdf8'; // Sky blue
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    for (const [startIdx, endIdx] of POSE_CONNECTIONS) {
      const p1 = poseLandmarks[startIdx];
      const p2 = poseLandmarks[endIdx];
      if (p1 && p2 && (p1.visibility ?? 1) > 0.4 && (p2.visibility ?? 1) > 0.4) {
        ctx.moveTo(p1.x * width, p1.y * height);
        ctx.lineTo(p2.x * width, p2.y * height);
      }
    }
    ctx.stroke();

    // Draw landmark keypoint dots (Batched arcs)
    ctx.fillStyle = '#10b981'; // Emerald
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    for (const lm of poseLandmarks) {
      if ((lm.visibility ?? 1) > 0.4) {
        const cx = lm.x * width;
        const cy = lm.y * height;
        ctx.moveTo(cx + 4, cy);
        ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
      }
    }
    ctx.fill();
    ctx.stroke();
  }

  // 2. Render Face Mesh (Batched sub-sampled circles)
  if (faceLandmarks && faceLandmarks.length > 0) {
    ctx.fillStyle = 'rgba(244, 63, 94, 0.75)';
    const step = 6;
    ctx.beginPath();
    for (let i = 0; i < faceLandmarks.length; i += step) {
      const lm = faceLandmarks[i];
      const cx = lm.x * width;
      const cy = lm.y * height;
      ctx.moveTo(cx + 1.8, cy);
      ctx.arc(cx, cy, 1.8, 0, 2 * Math.PI);
    }
    ctx.fill();
  }
}

/**
 * Helper to render detected face bounding boxes.
 */
export function drawFaceBoxesOnCanvas(
  ctx: CanvasRenderingContext2D,
  _width: number,
  _height: number,
  faceBoxes: DetectedFaceBox[]
): void {
  if (!faceBoxes || faceBoxes.length === 0) return;

  for (let idx = 0; idx < faceBoxes.length; idx++) {
    const box = faceBoxes[idx];
    const numStr = String(idx + 1).padStart(2, '0');

    ctx.strokeStyle = 'rgba(79, 216, 196, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(box.originX, box.originY, box.width, box.height);

    const tagWidth = 32;
    const tagHeight = 16;
    const tagX = box.originX;
    const tagY = Math.max(0, box.originY - tagHeight - 2);

    ctx.fillStyle = 'rgba(7, 18, 32, 0.9)';
    ctx.fillRect(tagX, tagY, tagWidth, tagHeight);
    ctx.strokeStyle = '#4fd8c4';
    ctx.lineWidth = 1;
    ctx.strokeRect(tagX, tagY, tagWidth, tagHeight);

    ctx.fillStyle = '#4fd8c4';
    ctx.font = 'bold 10px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(numStr, tagX + 8, tagY + tagHeight / 2);
  }
}
