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
import {
  BlinkDetector,
  type BlinkDetectorConfig,
  type EyeState,
  type BlinkRateStatus,
  type BlinkStateMachineState
} from '../blink/blinkDetector';
import { hasPrivacyConsent } from '../privacy/privacyConsent';

export type DetectionMode = 'no_person' | 'single_person' | 'multi_person';

export interface UseVisionFeedOptions {
  active?: boolean;
  hasConsent?: boolean;
  smoothingWeight?: number;
  blinkConfig?: Partial<BlinkDetectorConfig>;
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
  // Blink Detection & Rate Metrics
  leftEAR: number;
  rightEAR: number;
  averageEAR: number;
  eyesClosed: boolean;
  eyeState: EyeState;
  stateMachineState: BlinkStateMachineState;
  blinkDetected: boolean;
  blinkCount: number;
  blinksPerMinute: number | null;
  blinkRateStatus: BlinkRateStatus;
  lowBlinkRate: boolean;
  blinkTimestamps: number[];
  observationProgress: number;
  /** Monotonic ms timestamp of the most recently accepted blink event, or null if none yet. */
  lastBlinkTimestampMs: number | null;
}

export function useVisionFeed(options: UseVisionFeedOptions = {}): UseVisionFeedResult {
  const { active = true, hasConsent, smoothingWeight = 0.35, blinkConfig } = options;

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
  const blinkDetectorRef = useRef<BlinkDetector>(new BlinkDetector(blinkConfig));

  // Timer for auto-clearing the blinkDetected flash (200ms).
  // Stored in a ref so the inference loop can cancel it without stale closures.
  const blinkDetectedClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shadow refs: track previous per-frame blink values so setState is only called on actual changes.
  // This prevents ~30 React re-renders/second from identical state updates.
  const prevEARRef = useRef<{ left: number; right: number; avg: number }>({ left: 0, right: 0, avg: 0 });
  const prevBlinkCountRef = useRef<number>(0);
  const prevBlinksPerMinuteRef = useRef<number | null>(null);
  const prevBlinkRateStatusRef = useRef<BlinkRateStatus>('collecting');
  const prevLowBlinkRateRef = useRef<boolean>(false);
  const prevEyesClosedRef = useRef<boolean>(false);
  const prevEyeStateRef = useRef<EyeState>('OPEN');
  const prevStateMachineStateRef = useRef<BlinkStateMachineState>('OPEN');
  const prevObservationProgressRef = useRef<number>(0);
  const prevTimestampCountRef = useRef<number>(0);
  const prevLastBlinkTimestampRef = useRef<number | null>(null);

  // Sync any changes to blinkConfig
  useEffect(() => {
    if (blinkConfig) {
      blinkDetectorRef.current.updateConfig(blinkConfig);
    }
  }, [blinkConfig]);

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

  // Blink detection & rate state
  const [leftEAR, setLeftEAR] = useState<number>(0);
  const [rightEAR, setRightEAR] = useState<number>(0);
  const [averageEAR, setAverageEAR] = useState<number>(0);
  const [eyesClosed, setEyesClosed] = useState<boolean>(false);
  const [eyeState, setEyeState] = useState<EyeState>('OPEN');
  const [stateMachineState, setStateMachineState] = useState<BlinkStateMachineState>('OPEN');
  const [blinkDetected, setBlinkDetected] = useState<boolean>(false);
  const [blinkCount, setBlinkCount] = useState<number>(0);
  const [blinksPerMinute, setBlinksPerMinute] = useState<number | null>(null);
  const [blinkRateStatus, setBlinkRateStatus] = useState<BlinkRateStatus>('collecting');
  const [lowBlinkRate, setLowBlinkRate] = useState<boolean>(false);
  const [blinkTimestamps, setBlinkTimestamps] = useState<number[]>([]);
  const [observationProgress, setObservationProgress] = useState<number>(0);
  const [lastBlinkTimestampMs, setLastBlinkTimestampMs] = useState<number | null>(null);

  // Full reset when camera goes offline or vision session restarts
  useEffect(() => {
    if (!cameraActive) {
      // Cancel any in-flight blinkDetected flash timer
      if (blinkDetectedClearTimerRef.current !== null) {
        clearTimeout(blinkDetectedClearTimerRef.current);
        blinkDetectedClearTimerRef.current = null;
      }
      blinkDetectorRef.current.reset(true);
      // Reset shadow refs so change-guards start clean
      prevEARRef.current = { left: 0, right: 0, avg: 0 };
      prevBlinkCountRef.current = 0;
      prevBlinksPerMinuteRef.current = null;
      prevBlinkRateStatusRef.current = 'collecting';
      prevLowBlinkRateRef.current = false;
      prevEyesClosedRef.current = false;
      prevEyeStateRef.current = 'OPEN';
      prevStateMachineStateRef.current = 'OPEN';
      prevObservationProgressRef.current = 0;
      prevTimestampCountRef.current = 0;
      prevLastBlinkTimestampRef.current = null;
      // Reset React state
      setLeftEAR(0);
      setRightEAR(0);
      setAverageEAR(0);
      setEyesClosed(false);
      setEyeState('OPEN');
      setStateMachineState('OPEN');
      setBlinkDetected(false);
      setBlinkCount(0);
      setBlinksPerMinute(null);
      setBlinkRateStatus('collecting');
      setLowBlinkRate(false);
      setBlinkTimestamps([]);
      setObservationProgress(0);
      setLastBlinkTimestampMs(null);
    }
  }, [cameraActive]);

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
    // HARD PRIVACY GATE: Never call getUserMedia without explicit privacy acknowledgement
    const consentGranted = hasConsent !== undefined ? hasConsent : hasPrivacyConsent();
    if (!active || !consentGranted) {
      setCameraActive(false);
      return;
    }

    let stream: MediaStream | null = null;
    let isMounted = true;

    async function startWebcam() {
      // Re-check consent before invoking getUserMedia
      if (!hasPrivacyConsent() && hasConsent !== true) {
        setCameraActive(false);
        return;
      }

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
          let errorMsg = 'Camera permission denied or camera unavailable';
          if (err instanceof DOMException) {
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
              errorMsg = 'PostureSync cannot use camera-based monitoring until camera access is allowed in your browser settings.';
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
              errorMsg = 'No camera device found on this system.';
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
              errorMsg = 'Camera is already in use by another application or tab.';
            } else {
              errorMsg = err.message || errorMsg;
            }
          } else if (err instanceof Error) {
            errorMsg = err.message;
          }
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
  }, [active, hasConsent]);

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

          // 3. Blink Detection & Rolling Rate Foundation via MediaPipe FaceLandmarker mesh
          if (isSinglePerson && faceLandmarks) {
            const blinkRes = blinkDetectorRef.current.update(faceLandmarks, adjustedTimestampMs);

            // ---- Change-guarded setState calls ----
            // Only call setState when the value has actually changed. This prevents ~30
            // React re-renders per second caused by unconditional per-frame setState calls.

            // EAR values: rounded to 3dp for stability
            const newLeft  = Number(blinkRes.leftEAR.toFixed(3));
            const newRight = Number(blinkRes.rightEAR.toFixed(3));
            const newAvg   = Number(blinkRes.averageEAR.toFixed(3));
            if (newLeft  !== prevEARRef.current.left)  { setLeftEAR(newLeft);   prevEARRef.current.left  = newLeft;  }
            if (newRight !== prevEARRef.current.right) { setRightEAR(newRight); prevEARRef.current.right = newRight; }
            if (newAvg   !== prevEARRef.current.avg)   { setAverageEAR(newAvg); prevEARRef.current.avg   = newAvg;   }

            if (blinkRes.eyesClosed !== prevEyesClosedRef.current) {
              setEyesClosed(blinkRes.eyesClosed);
              prevEyesClosedRef.current = blinkRes.eyesClosed;
            }
            if (blinkRes.eyeState !== prevEyeStateRef.current) {
              setEyeState(blinkRes.eyeState);
              prevEyeStateRef.current = blinkRes.eyeState;
            }
            if (blinkRes.stateMachineState !== prevStateMachineStateRef.current) {
              setStateMachineState(blinkRes.stateMachineState);
              prevStateMachineStateRef.current = blinkRes.stateMachineState;
            }

            // Blink event: fire a 200ms flash, do NOT leave blinkDetected=true per-frame
            if (blinkRes.blinkDetected) {
              setBlinkDetected(true);
              if (blinkDetectedClearTimerRef.current !== null) {
                clearTimeout(blinkDetectedClearTimerRef.current);
              }
              blinkDetectedClearTimerRef.current = setTimeout(() => {
                setBlinkDetected(false);
                blinkDetectedClearTimerRef.current = null;
              }, 200);
            }

            if (blinkRes.blinkCount !== prevBlinkCountRef.current) {
              setBlinkCount(blinkRes.blinkCount);
              prevBlinkCountRef.current = blinkRes.blinkCount;
            }

            if (blinkRes.blinksPerMinute !== prevBlinksPerMinuteRef.current) {
              setBlinksPerMinute(blinkRes.blinksPerMinute);
              prevBlinksPerMinuteRef.current = blinkRes.blinksPerMinute;
            }

            if (blinkRes.blinkRateStatus !== prevBlinkRateStatusRef.current) {
              setBlinkRateStatus(blinkRes.blinkRateStatus);
              prevBlinkRateStatusRef.current = blinkRes.blinkRateStatus;
            }

            if (blinkRes.lowBlinkRate !== prevLowBlinkRateRef.current) {
              setLowBlinkRate(blinkRes.lowBlinkRate);
              prevLowBlinkRateRef.current = blinkRes.lowBlinkRate;
            }

            // Timestamps: only update when count changes to avoid new array reference per frame
            if (blinkRes.blinkTimestamps.length !== prevTimestampCountRef.current) {
              setBlinkTimestamps([...blinkRes.blinkTimestamps]);
              prevTimestampCountRef.current = blinkRes.blinkTimestamps.length;
            }

            // Observation progress: round to 2dp to halve update frequency
            const newProgress = Math.round(blinkRes.observationProgress * 100) / 100;
            if (newProgress !== prevObservationProgressRef.current) {
              setObservationProgress(newProgress);
              prevObservationProgressRef.current = newProgress;
            }

            // Last blink timestamp
            if (blinkRes.lastBlinkTimestampMs !== prevLastBlinkTimestampRef.current) {
              setLastBlinkTimestampMs(blinkRes.lastBlinkTimestampMs);
              prevLastBlinkTimestampRef.current = blinkRes.lastBlinkTimestampMs;
            }

          } else {
            // Face missing or multi-person frame: reset transient eye closure states without resetting cumulative count
            blinkDetectorRef.current.reset(false);
            if (prevEyesClosedRef.current)                         { setEyesClosed(false);         prevEyesClosedRef.current        = false;  }
            if (prevEyeStateRef.current !== 'OPEN')                { setEyeState('OPEN');           prevEyeStateRef.current          = 'OPEN'; }
            if (prevStateMachineStateRef.current !== 'OPEN')       { setStateMachineState('OPEN');  prevStateMachineStateRef.current = 'OPEN'; }
            if (prevLowBlinkRateRef.current)                       { setLowBlinkRate(false);        prevLowBlinkRateRef.current      = false;  }
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
        if (blinkDetectedClearTimerRef.current !== null) {
          clearTimeout(blinkDetectedClearTimerRef.current);
          blinkDetectedClearTimerRef.current = null;
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
      // Clean up pending blinkDetected flash timer on loop teardown
      if (blinkDetectedClearTimerRef.current !== null) {
        clearTimeout(blinkDetectedClearTimerRef.current);
        blinkDetectedClearTimerRef.current = null;
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
    detectedFaceBoxes,
    // Blink Detection & Rate Metrics
    leftEAR,
    rightEAR,
    averageEAR,
    eyesClosed,
    eyeState,
    stateMachineState,
    blinkDetected,
    blinkCount,
    blinksPerMinute,
    blinkRateStatus,
    lowBlinkRate,
    blinkTimestamps,
    observationProgress,
    lastBlinkTimestampMs,
  };
}

