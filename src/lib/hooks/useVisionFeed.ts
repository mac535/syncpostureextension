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
import type { PostureBaseline } from '../posture/calibration';

export type DetectionMode = 'no_person' | 'single_person' | 'multi_person';
export type MonitoringLifecycleState = 'stopped' | 'running' | 'suspended';

export interface UseVisionFeedOptions {
  active?: boolean;
  suspended?: boolean;
  hasConsent?: boolean;
  smoothingWeight?: number;
  blinkConfig?: Partial<BlinkDetectorConfig>;
  baseline?: PostureBaseline | null;
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
  // Lifecycle & Suspension State
  lifecycleState: MonitoringLifecycleState;
  isSuspended: boolean;
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
  trackingStatus: 'reliable' | 'unreliable' | 'lost';
  /** Monotonic ms timestamp of the most recently accepted blink event, or null if none yet. */
  lastBlinkTimestampMs: number | null;
}

export function useVisionFeed(options: UseVisionFeedOptions = {}): UseVisionFeedResult {
  const { active = true, suspended = false, hasConsent, smoothingWeight = 0.35, blinkConfig, baseline } = options;

  const baselineRef = useRef<PostureBaseline | null>(baseline ?? null);
  useEffect(() => {
    baselineRef.current = baseline ?? null;
  }, [baseline]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const acquisitionIdRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const lastTimestampMsRef = useRef<number>(0);
  const lastProcessTimeRef = useRef<number>(0);
  const lastFaceDetectTimeRef = useRef<number>(0);
  const lastFaceDetectSuccessTimeRef = useRef<number>(0);
  const lastProcessedVideoTimeRef = useRef<number>(-1);
  const cachedFaceBoxesRef = useRef<DetectedFaceBox[]>([]);
  const rawPersonCountsRef = useRef<number[]>([]);
  const fpsTimerRef = useRef<{ frames: number; lastTime: number }>({ frames: 0, lastTime: 0 });
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
  const lastUiUpdateTimeRef = useRef<number>(0);
  const prevStatusRef = useRef<string>('insufficient_data');
  const prevSeverityRef = useRef<number>(0);
  const prevPoseDetectedRef = useRef<boolean>(false);
  const prevTrackingStatusRef = useRef<'reliable' | 'unreliable' | 'lost'>('lost');
  const prevDetectionModeRef = useRef<DetectionMode>('no_person');
  const prevCameraActiveRef = useRef<boolean>(false);

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
  const [trackingStatus, setTrackingStatus] = useState<'reliable' | 'unreliable' | 'lost'>('lost');

  // Full reset when camera goes offline or vision session restarts
  useEffect(() => {
    if (!cameraActive && prevCameraActiveRef.current) {
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
      prevPoseDetectedRef.current = false;
      prevTrackingStatusRef.current = 'lost';
      lastProcessedVideoTimeRef.current = -1;
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
      setPoseDetected(false);
      setTrackingStatus('lost');
    }
    prevCameraActiveRef.current = cameraActive;
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

  // 2. Start Live Webcam Feed (with safe acquisition cancellation and release on suspension)
  useEffect(() => {
    // If not active or suspended, release any held webcam stream tracks immediately
    if (!active || suspended) {
      acquisitionIdRef.current++;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setCameraActive((prev) => (prev ? false : prev));
      return;
    }

    // HARD PRIVACY GATE: Never call getUserMedia without explicit privacy acknowledgement
    const consentGranted = hasConsent !== undefined ? hasConsent : hasPrivacyConsent();
    if (!consentGranted) {
      return;
    }

    let isMounted = true;
    const currentAcquisitionId = ++acquisitionIdRef.current;

    async function startWebcam() {
      // Re-check consent before invoking getUserMedia
      if (!hasPrivacyConsent() && hasConsent !== true) {
        setCameraActive((prev) => (prev ? false : prev));
        return;
      }

      try {
        setCameraError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
            frameRate: { ideal: 15, max: 20 }
          },
          audio: false
        });

        // Guard against focus loss or unmount during async camera acquisition
        if (!isMounted || !active || suspended || currentAcquisitionId !== acquisitionIdRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraActive(true);
        }
      } catch (err: unknown) {
        if (isMounted && currentAcquisitionId === acquisitionIdRef.current) {
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
      acquisitionIdRef.current++;
      const currentStream = streamRef.current;
      const currentVideo = videoRef.current;
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (currentVideo) {
        currentVideo.srcObject = null;
      }
      setCameraActive(false);
    };
  }, [active, suspended, hasConsent]);

  // 3. Optimized Lightweight Inference Loop (~10 FPS / 100ms cadence)
  useEffect(() => {
    if (!active || suspended || !pipelineReady || !cameraActive) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video) return;

    let isRunning = true;
    let timerId: ReturnType<typeof setInterval> | null = null;
    let rVFCId: number | null = null;

    // Single frame inference execution - strictly guarded against overlapping runs
    function executeInference() {
      if (!isRunning || isProcessingRef.current) return;
      if (!video || video.readyState < 2 || video.videoWidth === 0 || video.paused || video.ended) return;

      const now = performance.now();
      const currentVideoTime = video.currentTime;
      const timeSinceLastProcess = now - lastProcessTimeRef.current;

      // Skip redundant inference if the camera hardware hasn't presented a new frame yet
      if (
        currentVideoTime > 0 &&
        currentVideoTime === lastProcessedVideoTimeRef.current &&
        timeSinceLastProcess < 110
      ) {
        return;
      }
      lastProcessedVideoTimeRef.current = currentVideoTime;

      isProcessingRef.current = true;
      lastProcessTimeRef.current = now;

      try {
        const currentTimestampMs = performance.now();
        const adjustedTimestampMs =
          currentTimestampMs > lastTimestampMsRef.current ? currentTimestampMs : lastTimestampMsRef.current + 1;
        lastTimestampMsRef.current = adjustedTimestampMs;

        const currentCount = rawPersonCountsRef.current.length > 0
          ? rawPersonCountsRef.current[rawPersonCountsRef.current.length - 1]
          : 0;
        const isMultiPerson = cachedFaceBoxesRef.current.length >= 2 || currentCount >= 2;
        const isSinglePerson = !isMultiPerson && (cachedFaceBoxesRef.current.length === 1 || currentCount === 1);

        // 1. Run Pose & Face Landmark inference (with conditional face skipping for multi-person)
        const results = detectLandmarksForVideo(video, adjustedTimestampMs, {
          skipFaceLandmarker: isMultiPerson
        });

        // 2. Adaptive Face Detection for Multi-Person Count
        // Runs every 1000ms when stable in single_person mode; every 500ms when transitioning/multi-person
        const faceIntervalMs = prevDetectionModeRef.current === 'single_person' ? 1000 : 500;
        if (now - lastFaceDetectTimeRef.current >= faceIntervalMs) {
          lastFaceDetectTimeRef.current = now;
          const detectorResult = detectFacesForVideo(video, adjustedTimestampMs);

          if (detectorResult && detectorResult.detections) {
            lastFaceDetectSuccessTimeRef.current = now;
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
            // Only update state if count changed or multiple faces need active box overlay
            if (boxes.length !== cachedFaceBoxesRef.current.length || boxes.length >= 2) {
              setDetectedFaceBoxes(boxes);
            }

            const rawCount = boxes.length;
            const history = rawPersonCountsRef.current;
            history.push(rawCount);
            if (history.length > 5) {
              history.shift();
            }

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

            let nextMode: DetectionMode = 'no_person';
            if (stableCount === 1) {
              nextMode = 'single_person';
            } else if (stableCount >= 2) {
              nextMode = 'multi_person';
            }

            prevDetectionModeRef.current = nextMode;
            setPersonCount((prev) => (prev !== stableCount ? stableCount : prev));
            setDetectionMode((prev) => (prev !== nextMode ? nextMode : prev));
          } else if (now - lastFaceDetectSuccessTimeRef.current > 3500 && rawPersonCountsRef.current.length > 0) {
            // Decay stale person count history if no faces detected for >3.5s
            rawPersonCountsRef.current = [];
          }
        }

        if (results) {
          const poseLandmarks = results.poseResult?.landmarks?.[0];
          const faceLandmarks = results.faceResult?.faceLandmarks?.[0];

          // Render canvas ONLY when document is visible to save GPU and DOM paints
          if (canvas && document.visibilityState === 'visible') {
            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
            }

            // Schedule a lightweight rAF draw so paint does not block inference
            if (animFrameIdRef.current === null) {
              animFrameIdRef.current = requestAnimationFrame(() => {
                animFrameIdRef.current = null;
                if (!isRunning) return;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  if (isMultiPerson) {
                    drawFaceBoxesOnCanvas(ctx, canvas.width, canvas.height, cachedFaceBoxesRef.current);
                  } else if (isSinglePerson) {
                    drawLandmarksOnCanvas(ctx, canvas.width, canvas.height, poseLandmarks, faceLandmarks);
                  } else {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                  }
                }
              });
            }
          }

          const isPosePresent = Boolean(poseLandmarks && poseLandmarks.length > 0);
          const nextPoseDetected = isPosePresent && isSinglePerson;
          if (nextPoseDetected !== prevPoseDetectedRef.current) {
            prevPoseDetectedRef.current = nextPoseDetected;
            setPoseDetected(nextPoseDetected);
          }

          if (isSinglePerson && isPosePresent && poseLandmarks) {
            const rawMetrics = computePostureMetrics(poseLandmarks);
            const smoothedMetrics = smootherRef.current.smooth(rawMetrics);
            const classification = classifyPosture(smoothedMetrics, baselineRef.current);

            // Throttle React state updates to ~3-4 FPS unless posture status or severity changes
            const isStatusChanged = classification.status !== prevStatusRef.current || classification.severity !== prevSeverityRef.current;
            const timeSinceLastUi = now - lastUiUpdateTimeRef.current;

            if (isStatusChanged || timeSinceLastUi >= 260) {
              lastUiUpdateTimeRef.current = now;
              prevStatusRef.current = classification.status;
              prevSeverityRef.current = classification.severity;
              setPostureMetrics(smoothedMetrics);
              setPostureClassification(classification);
            }
          } else {
            smootherRef.current.reset();
            if (prevStatusRef.current !== 'insufficient_data') {
              prevStatusRef.current = 'insufficient_data';
              prevSeverityRef.current = 0;
              setPostureMetrics(null);
              setPostureClassification({
                status: 'insufficient_data',
                severity: 0,
                deviationScore: 0,
                reason: isMultiPerson ? 'Multiple people detected in frame' : 'No person detected in camera frame'
              });
            }
          }

          // Blink detection (only when face landmarks are sampled)
          if (isSinglePerson && faceLandmarks) {
            const blinkRes = blinkDetectorRef.current.update(faceLandmarks, adjustedTimestampMs);

            const newLeft = Number(blinkRes.leftEAR.toFixed(3));
            const newRight = Number(blinkRes.rightEAR.toFixed(3));
            const newAvg = Number(blinkRes.averageEAR.toFixed(3));
            if (newLeft !== prevEARRef.current.left) { setLeftEAR(newLeft); prevEARRef.current.left = newLeft; }
            if (newRight !== prevEARRef.current.right) { setRightEAR(newRight); prevEARRef.current.right = newRight; }
            if (newAvg !== prevEARRef.current.avg) { setAverageEAR(newAvg); prevEARRef.current.avg = newAvg; }

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
            if (blinkRes.blinkTimestamps.length !== prevTimestampCountRef.current) {
              setBlinkTimestamps([...blinkRes.blinkTimestamps]);
              prevTimestampCountRef.current = blinkRes.blinkTimestamps.length;
            }
            const newProgress = Math.round(blinkRes.observationProgress * 100) / 100;
            if (newProgress !== prevObservationProgressRef.current) {
              setObservationProgress(newProgress);
              prevObservationProgressRef.current = newProgress;
            }
            if (blinkRes.lastBlinkTimestampMs !== prevLastBlinkTimestampRef.current) {
              setLastBlinkTimestampMs(blinkRes.lastBlinkTimestampMs);
              prevLastBlinkTimestampRef.current = blinkRes.lastBlinkTimestampMs;
            }
            if (blinkRes.trackingStatus !== prevTrackingStatusRef.current) {
              prevTrackingStatusRef.current = blinkRes.trackingStatus;
              setTrackingStatus(blinkRes.trackingStatus);
            }
          } else {
            blinkDetectorRef.current.update(null, adjustedTimestampMs);
            if (prevTrackingStatusRef.current !== 'lost') {
              prevTrackingStatusRef.current = 'lost';
              setTrackingStatus('lost');
            }
            if (prevLowBlinkRateRef.current !== false) {
              prevLowBlinkRateRef.current = false;
              setLowBlinkRate(false);
            }
          }
        }

        fpsTimerRef.current.frames += 1;
        if (fpsTimerRef.current.lastTime === 0) {
          fpsTimerRef.current.lastTime = now;
        } else if (now - fpsTimerRef.current.lastTime >= 1000) {
          setMeasuredFps(Math.round((fpsTimerRef.current.frames * 1000) / (now - fpsTimerRef.current.lastTime)));
          fpsTimerRef.current.frames = 0;
          fpsTimerRef.current.lastTime = now;
        }
      } catch (err) {
        console.warn('PostureSync inference cycle warning:', err);
      } finally {
        isProcessingRef.current = false;
      }
    }

    const CADENCE_MS = 100;

    // Hybrid frame scheduling:
    // If requestVideoFrameCallback is available, hook frame presentation for zero-latency sync.
    // In all environments, keep an interval timer active (cadence 100ms) to ensure background tabs
    // continue to monitor posture and eye strain even when the monitor tab is unmounted or in the background.
    const currentVideo = video;
    const hasRVFC = typeof currentVideo.requestVideoFrameCallback === 'function';

    function scheduleRVFC() {
      if (!isRunning || !hasRVFC || !currentVideo) return;
      rVFCId = currentVideo.requestVideoFrameCallback(() => {
        executeInference();
        scheduleRVFC();
      });
    }

    if (hasRVFC && document.visibilityState === 'visible') {
      scheduleRVFC();
    }

    timerId = setInterval(() => {
      executeInference();
    }, CADENCE_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && hasRVFC && rVFCId === null) {
        scheduleRVFC();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      isRunning = false;
      isProcessingRef.current = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
      if (rVFCId !== null && hasRVFC && currentVideo && typeof currentVideo.cancelVideoFrameCallback === 'function') {
        currentVideo.cancelVideoFrameCallback(rVFCId);
        rVFCId = null;
      }
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      if (blinkDetectedClearTimerRef.current !== null) {
        clearTimeout(blinkDetectedClearTimerRef.current);
        blinkDetectedClearTimerRef.current = null;
      }
      // Reset timing and smoothing state upon pause/suspension so stale data does not trigger false alerts
      const currentSmoother = smootherRef.current;
      const currentBlinkDetector = blinkDetectorRef.current;
      lastProcessTimeRef.current = 0;
      lastProcessedVideoTimeRef.current = -1;
      lastTimestampMsRef.current = 0;
      currentSmoother.reset();
      currentBlinkDetector.reset(false);
    };
  }, [active, suspended, pipelineReady, cameraActive]);

  const lifecycleState: MonitoringLifecycleState = !active
    ? 'stopped'
    : suspended
    ? 'suspended'
    : 'running';
  const isSuspendedState = lifecycleState === 'suspended';

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
    lifecycleState,
    isSuspended: isSuspendedState,
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
    trackingStatus,
  };
}

