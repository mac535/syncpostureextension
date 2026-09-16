import { useEffect, useRef, useState } from 'react';
import {
  initializeMediaPipe,
  detectLandmarksForVideo,
  detectFacesForVideo,
  drawLandmarksOnCanvas,
  drawFaceBoxesOnCanvas,
  type DetectedFaceBox
} from '../mediapipe/visionPipeline';
import { computePostureMetrics, type PostureMetrics } from '../posture/postureMetrics';
import { classifyPosture, type PostureClassification } from '../posture/postureClassifier';
import { PostureMetricsSmoother } from '../posture/smoother';

export type DetectionMode = 'no_person' | 'single_person' | 'multi_person';

export interface UseVisionFeedOptions {
  active?: boolean;
  smoothingWeight?: number;
}

export interface UseVisionFeedResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  cameraActive: boolean;
  cameraError: string | null;
  pipelineReady: boolean;
  pipelineLoading: boolean;
  pipelineError: string | null;
  poseDetected: boolean;
  measuredFps: number;
  postureMetrics: PostureMetrics | null;
  postureClassification: PostureClassification;
  personCount: number;
  detectionMode: DetectionMode;
  detectedFaceBoxes: DetectedFaceBox[];
}

export function useVisionFeed(options: UseVisionFeedOptions = {}): UseVisionFeedResult {
  const { active = true, smoothingWeight = 0.35 } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const lastTimestampMsRef = useRef<number>(0);
  const lastProcessTimeRef = useRef<number>(0);
  const lastFaceDetectTimeRef = useRef<number>(0);
  const cachedFaceBoxesRef = useRef<DetectedFaceBox[]>([]);
  const rawPersonCountsRef = useRef<number[]>([]);
  const fpsTimerRef = useRef<{ frames: number; lastTime: number }>({ frames: 0, lastTime: performance.now() });
  const smootherRef = useRef<PostureMetricsSmoother>(new PostureMetricsSmoother(smoothingWeight));

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [pipelineReady, setPipelineReady] = useState<boolean>(false);
  const [pipelineLoading, setPipelineLoading] = useState<boolean>(true);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  const [poseDetected, setPoseDetected] = useState<boolean>(false);
  const [measuredFps, setMeasuredFps] = useState<number>(0);
  const [postureMetrics, setPostureMetrics] = useState<PostureMetrics | null>(null);
  const [postureClassification, setPostureClassification] = useState<PostureClassification>({
    status: 'insufficient_data',
    severity: 0,
    deviationScore: 0,
    reason: 'Initializing vision pipeline...'
  });

  // Adaptive detection mode & person count
  const [personCount, setPersonCount] = useState<number>(0);
  const [detectionMode, setDetectionMode] = useState<DetectionMode>('no_person');
  const [detectedFaceBoxes, setDetectedFaceBoxes] = useState<DetectedFaceBox[]>([]);

  // 1. Initialize MediaPipe Models
  useEffect(() => {
    let isCancelled = false;

    async function loadModels() {
      try {
        setPipelineLoading(true);
        setPipelineError(null);
        await initializeMediaPipe();
        if (!isCancelled) {
          setPipelineReady(true);
          setPipelineLoading(false);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          console.error('MediaPipe initialization error:', err);
          const errorMsg = err instanceof Error ? err.message : 'Failed to initialize MediaPipe vision models';
          setPipelineError(errorMsg);
          setPipelineLoading(false);
        }
      }
    }

    loadModels();

    return () => {
      isCancelled = true;
    };
  }, []);

  // 2. Start Live Webcam Feed
  useEffect(() => {
    if (!active) {
      setCameraActive(false);
      return;
    }

    let stream: MediaStream | null = null;
    let isMounted = true;

    async function startWebcam() {
      try {
        setCameraError(null);
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          },
          audio: false
        });

        if (isMounted && videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraActive(true);
        }
      } catch (err: unknown) {
        if (isMounted) {
          console.error('Error accessing webcam:', err);
          const errorMsg = err instanceof Error ? err.message : 'Camera permission denied or camera unavailable';
          setCameraError(errorMsg);
          setCameraActive(false);
        }
      }
    }

    startWebcam();

    return () => {
      isMounted = false;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [active]);

  // 3. Robust Inference, Math & Render Loop with Background Tab Support
  useEffect(() => {
    if (!active || !pipelineReady || !cameraActive) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video) return;

    let isRunning = true;

    // Core single-frame processor (can be called by either requestAnimationFrame or Worker ticker)
    function executeInference() {
      if (!isRunning) return;

      const now = performance.now();
      // Throttle slightly to max ~30-40 FPS to avoid redundant cycles
      if (now - lastProcessTimeRef.current < 25) {
        return;
      }

      if (!isProcessingRef.current && video && video.readyState >= 2 && video.videoWidth > 0) {
        isProcessingRef.current = true;
        lastProcessTimeRef.current = now;

        const currentTimestampMs = performance.now();
        const adjustedTimestampMs =
          currentTimestampMs > lastTimestampMsRef.current ? currentTimestampMs : lastTimestampMsRef.current + 1;
        lastTimestampMsRef.current = adjustedTimestampMs;

        if (canvas && (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        // 1. Run Pose & Face Landmark inference (full posture rate)
        const results = detectLandmarksForVideo(video, adjustedTimestampMs);

        // 2. Run FaceDetector at lower frequency (~7-8 FPS / every ~125ms) for multi-person count
        if (now - lastFaceDetectTimeRef.current >= 125) {
          lastFaceDetectTimeRef.current = now;
          const detectorResult = detectFacesForVideo(video, adjustedTimestampMs);

          if (detectorResult && detectorResult.detections) {
            const boxes: DetectedFaceBox[] = detectorResult.detections.map((det) => {
              const bb = det.boundingBox;
              const catScore = det.categories?.[0]?.score;
              return {
                originX: bb ? bb.originX : 0,
                originY: bb ? bb.originY : 0,
                width: bb ? bb.width : 0,
                height: bb ? bb.height : 0,
                confidence: catScore
              };
            });

            cachedFaceBoxesRef.current = boxes;
            setDetectedFaceBoxes(boxes);

            // Temporal stabilization / hysteresis over a rolling window (e.g. 5 samples ~ 600ms)
            const rawCount = boxes.length;
            const history = rawPersonCountsRef.current;
            history.push(rawCount);
            if (history.length > 5) {
              history.shift();
            }

            // Majority / stable vote across window to prevent rapid flickering
            const countFreq = new Map<number, number>();
            for (const c of history) {
              countFreq.set(c, (countFreq.get(c) ?? 0) + 1);
            }
            let stableCount = rawCount;
            let maxFreq = 0;
            for (const [c, freq] of countFreq.entries()) {
              if (freq > maxFreq) {
                maxFreq = freq;
                stableCount = c;
              }
            }

            // Derive detectionMode from stableCount
            let nextMode: DetectionMode = 'no_person';
            if (stableCount === 1) {
              nextMode = 'single_person';
            } else if (stableCount >= 2) {
              nextMode = 'multi_person';
            }

            // Update state only on change to avoid redundant React renders
            setPersonCount((prev) => (prev !== stableCount ? stableCount : prev));
            setDetectionMode((prev) => (prev !== nextMode ? nextMode : prev));
          }
        }

        if (results) {
          const poseLandmarks = results.poseResult?.landmarks?.[0];
          const faceLandmarks = results.faceResult?.faceLandmarks?.[0];

          // Determine current stable detection mode from stable count
          const currentCount = rawPersonCountsRef.current.length > 0
            ? rawPersonCountsRef.current[rawPersonCountsRef.current.length - 1]
            : 0;
          const isMultiPerson = cachedFaceBoxesRef.current.length >= 2 || currentCount >= 2;
          const isSinglePerson = !isMultiPerson && (cachedFaceBoxesRef.current.length === 1 || currentCount === 1);

          // Canvas rendering:
          // In multi-person mode: Draw ONLY face markers (01, 02...), NO posture skeleton
          // In single-person mode: Draw existing posture skeleton and face mesh, NO multi-person boxes
          // In 0-person mode: Clear canvas completely
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              if (isMultiPerson) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                drawFaceBoxesOnCanvas(ctx, canvas.width, canvas.height, cachedFaceBoxesRef.current);
              } else if (isSinglePerson) {
                drawLandmarksOnCanvas(ctx, canvas.width, canvas.height, poseLandmarks, faceLandmarks);
              } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
              }
            }
          }

          const isPosePresent = Boolean(poseLandmarks && poseLandmarks.length > 0);
          setPoseDetected(isPosePresent && isSinglePerson);

          if (isSinglePerson && isPosePresent && poseLandmarks) {
            // Exactly one person: run posture analysis safely
            const rawMetrics = computePostureMetrics(poseLandmarks);
            const smoothedMetrics = smootherRef.current.smooth(rawMetrics);
            const classification = classifyPosture(smoothedMetrics);

            setPostureMetrics(smoothedMetrics);
            setPostureClassification(classification);
          } else {
            // Either 0 people, or multiple people: reset smoother and classification to avoid stale telemetry
            smootherRef.current.reset();
            setPostureMetrics(null);
            setPostureClassification({
              status: 'insufficient_data',
              severity: 0,
              deviationScore: 0,
              reason: isMultiPerson ? 'Multiple people detected in frame' : 'No person detected in camera frame'
            });
          }
        }

        fpsTimerRef.current.frames += 1;
        if (now - fpsTimerRef.current.lastTime >= 1000) {
          setMeasuredFps(Math.round((fpsTimerRef.current.frames * 1000) / (now - fpsTimerRef.current.lastTime)));
          fpsTimerRef.current.frames = 0;
          fpsTimerRef.current.lastTime = now;
        }

        isProcessingRef.current = false;
      }
    }

    // Animation frame pump for smooth 60fps rendering while tab is active
    function onAnimationFrame() {
      if (!isRunning) return;
      executeInference();
      animFrameIdRef.current = requestAnimationFrame(onAnimationFrame);
    }

    animFrameIdRef.current = requestAnimationFrame(onAnimationFrame);

    // Background Tab Ticker:
    // When the user switches to the secondary Demo tab, browsers throttle requestAnimationFrame to 0 or 1 FPS.
    // A dedicated Web Worker timer continues firing every ~50ms uninterrupted in the background.
    let backgroundWorker: Worker | null = null;
    try {
      const workerCode = `
        let timer = null;
        self.onmessage = function(e) {
          if (e.data === 'start') {
            if (!timer) {
              timer = setInterval(function() {
                self.postMessage('tick');
              }, 50); // ~20 FPS in background
            }
          } else if (e.data === 'stop') {
            if (timer) {
              clearInterval(timer);
              timer = null;
            }
          }
        };
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      backgroundWorker = new Worker(workerUrl);
      backgroundWorker.onmessage = () => {
        executeInference();
      };
      backgroundWorker.postMessage('start');
      URL.revokeObjectURL(workerUrl);
    } catch (err) {
      console.warn('Could not start Web Worker background timer, falling back to interval:', err);
      // Fallback interval if Worker creation fails
      const fallbackInterval = setInterval(() => {
        executeInference();
      }, 80);
      return () => {
        isRunning = false;
        clearInterval(fallbackInterval);
        if (animFrameIdRef.current !== null) {
          cancelAnimationFrame(animFrameIdRef.current);
          animFrameIdRef.current = null;
        }
      };
    }

    return () => {
      isRunning = false;
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      if (backgroundWorker) {
        backgroundWorker.postMessage('stop');
        backgroundWorker.terminate();
        backgroundWorker = null;
      }
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    };
  }, [active, pipelineReady, cameraActive]);

  return {
    videoRef,
    canvasRef,
    cameraActive,
    cameraError,
    pipelineReady,
    pipelineLoading,
    pipelineError,
    poseDetected,
    measuredFps,
    postureMetrics,
    postureClassification,
    personCount,
    detectionMode,
    detectedFaceBoxes
  };
}

