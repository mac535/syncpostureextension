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

const WASM_CDN_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const POSE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const FACE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const FACE_DETECTOR_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite';

let poseLandmarkerInstance: PoseLandmarker | null = null;
let faceLandmarkerInstance: FaceLandmarker | null = null;
let faceDetectorInstance: FaceDetector | null = null;
let initPromise: Promise<{
  poseLandmarker: PoseLandmarker;
  faceLandmarker: FaceLandmarker;
  faceDetector: FaceDetector | null;
}> | null = null;

/**
 * Initializes MediaPipe Tasks Vision FilesetResolver, PoseLandmarker, FaceLandmarker, and FaceDetector.
 * Reuses active instances to prevent double initialization during React StrictMode.
 */
export async function initializeMediaPipe(): Promise<{
  poseLandmarker: PoseLandmarker;
  faceLandmarker: FaceLandmarker;
  faceDetector: FaceDetector | null;
}> {
  if (poseLandmarkerInstance && faceLandmarkerInstance) {
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
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN_URL);

      const [poseLandmarker, faceLandmarker] = await Promise.all([
        PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: POSE_MODEL_URL,
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        }),
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
          outputFaceBlendshapes: true
        })
      ]);

      poseLandmarkerInstance = poseLandmarker;
      faceLandmarkerInstance = faceLandmarker;

      // Initialize FaceDetector with graceful fallback so failure doesn't crash the pipeline
      try {
        const faceDetector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: FACE_DETECTOR_MODEL_URL,
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.5,
          minSuppressionThreshold: 0.3
        });
        faceDetectorInstance = faceDetector;
      } catch (detectorErr) {
        console.warn('FaceDetector initialization failed, continuing without multi-person face detector:', detectorErr);
        faceDetectorInstance = null;
      }

      return { poseLandmarker, faceLandmarker, faceDetector: faceDetectorInstance };
    } catch (err) {
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Executes a single synchronized video frame inference for both Pose & Face landmarkers.
 */
export function detectLandmarksForVideo(
  video: HTMLVideoElement,
  timestampMs: number
): VisionPipelineResults | null {
  if (!poseLandmarkerInstance || !faceLandmarkerInstance) {
    return null;
  }

  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    return null;
  }

  try {
    const poseResult = poseLandmarkerInstance.detectForVideo(video, timestampMs);
    const faceResult = faceLandmarkerInstance.detectForVideo(video, timestampMs);

    return {
      poseResult,
      faceResult,
      timestampMs
    };
  } catch (err) {
    console.error('Inference error during frame processing:', err);
    return null;
  }
}

/**
 * Runs FaceDetector on a video frame to detect all visible faces.
 * Can be called at a lower cadence (e.g. 5-10 FPS).
 */
export function detectFacesForVideo(
  video: HTMLVideoElement,
  timestampMs: number
): FaceDetectorResult | null {
  if (!faceDetectorInstance) {
    return null;
  }

  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    return null;
  }

  try {
    return faceDetectorInstance.detectForVideo(video, timestampMs);
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
 * Helper to render pose & face landmark points and connections onto a target 2D canvas context.
 */
export function drawLandmarksOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  poseLandmarks?: NormalizedLandmark[],
  faceLandmarks?: NormalizedLandmark[]
): void {
  ctx.clearRect(0, 0, width, height);

  // 1. Render Pose Skeleton
  if (poseLandmarks && poseLandmarks.length > 0) {
    // Draw connections
    ctx.strokeStyle = '#38bdf8'; // Sky blue
    ctx.lineWidth = 2.5;

    for (const [startIdx, endIdx] of POSE_CONNECTIONS) {
      const p1 = poseLandmarks[startIdx];
      const p2 = poseLandmarks[endIdx];
      if (p1 && p2 && (p1.visibility ?? 1) > 0.4 && (p2.visibility ?? 1) > 0.4) {
        ctx.beginPath();
        ctx.moveTo(p1.x * width, p1.y * height);
        ctx.lineTo(p2.x * width, p2.y * height);
        ctx.stroke();
      }
    }

    // Draw landmark keypoint dots
    for (const lm of poseLandmarks) {
      if ((lm.visibility ?? 1) > 0.4) {
        ctx.beginPath();
        ctx.arc(lm.x * width, lm.y * height, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#10b981'; // Emerald
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
  }

  // 2. Render Face Mesh / Key Points (subtle, lightweight developer dots)
  if (faceLandmarks && faceLandmarks.length > 0) {
    // Render key facial contour dots
    ctx.fillStyle = 'rgba(244, 63, 94, 0.75)'; // Coral rose
    // Draw subsampled face mesh landmarks for smooth real-time performance
    const step = 4; // Sample every 4th landmark for clean debug view
    for (let i = 0; i < faceLandmarks.length; i += step) {
      const lm = faceLandmarks[i];
      ctx.beginPath();
      ctx.arc(lm.x * width, lm.y * height, 1.8, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}

/**
 * Helper to render detected face bounding boxes and numbered markers onto target 2D canvas context.
 * Used when personCount >= 2 for multi-person tracking.
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

    // Technical bounding box with corner accents
    ctx.strokeStyle = 'rgba(79, 216, 196, 0.7)'; // teal accent
    ctx.lineWidth = 1.5;
    ctx.strokeRect(box.originX, box.originY, box.width, box.height);

    // Numbered marker tag (e.g. 01, 02)
    const tagWidth = 32;
    const tagHeight = 16;
    const tagX = box.originX;
    const tagY = Math.max(0, box.originY - tagHeight - 2);

    ctx.fillStyle = 'rgba(7, 18, 32, 0.9)';
    ctx.fillRect(tagX, tagY, tagWidth, tagHeight);
    ctx.strokeStyle = 'var(--signal-good, #4fd8c4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(tagX, tagY, tagWidth, tagHeight);

    ctx.fillStyle = '#4fd8c4';
    ctx.font = 'bold 10px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(numStr, tagX + 8, tagY + tagHeight / 2);
  }
}
