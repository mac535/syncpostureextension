import { useEffect, useRef, useState } from 'react';
import {
  initializeMediaPipe,
  detectLandmarksForVideo,
  drawLandmarksOnCanvas
} from '../mediapipe/visionPipeline';
import { computePostureMetrics, type PostureMetrics } from '../posture/postureMetrics';
import { classifyPosture, type PostureClassification } from '../posture/postureClassifier';
import { PostureMetricsSmoother } from '../posture/smoother';

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
}

export function useVisionFeed(options: UseVisionFeedOptions = {}): UseVisionFeedResult {
  const { active = true, smoothingWeight = 0.35 } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const lastTimestampRef = useRef<number>(0);
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
    reason: 'Initializing vision pipeline...'
  });

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

  // 3. Inference, Math & Canvas Debug Render Loop
  useEffect(() => {
    if (!active || !pipelineReady || !cameraActive) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let isRunning = true;

    function processFrame() {
      if (!isRunning) return;

      if (!isProcessingRef.current && video && video.readyState >= 2 && video.videoWidth > 0) {
        isProcessingRef.current = true;

        const currentTimestampMs = performance.now();
        const adjustedTimestampMs = currentTimestampMs > lastTimestampRef.current ? currentTimestampMs : lastTimestampRef.current + 1;
        lastTimestampRef.current = adjustedTimestampMs;

        if (canvas && (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const results = detectLandmarksForVideo(video, adjustedTimestampMs);

        if (results && canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const poseLandmarks = results.poseResult?.landmarks?.[0];
            const faceLandmarks = results.faceResult?.faceLandmarks?.[0];

            drawLandmarksOnCanvas(ctx, canvas.width, canvas.height, poseLandmarks, faceLandmarks);

            const isPosePresent = Boolean(poseLandmarks && poseLandmarks.length > 0);
            setPoseDetected(isPosePresent);

            if (isPosePresent && poseLandmarks) {
              const rawMetrics = computePostureMetrics(poseLandmarks);
              const smoothedMetrics = smootherRef.current.smooth(rawMetrics);
              const classification = classifyPosture(smoothedMetrics);

              setPostureMetrics(smoothedMetrics);
              setPostureClassification(classification);
            } else {
              smootherRef.current.reset();
              setPostureMetrics(null);
              setPostureClassification({
                status: 'insufficient_data',
                severity: 0,
                reason: 'No person detected in camera frame'
              });
            }
          }
        }

        fpsTimerRef.current.frames += 1;
        const now = performance.now();
        if (now - fpsTimerRef.current.lastTime >= 1000) {
          setMeasuredFps(Math.round((fpsTimerRef.current.frames * 1000) / (now - fpsTimerRef.current.lastTime)));
          fpsTimerRef.current.frames = 0;
          fpsTimerRef.current.lastTime = now;
        }

        isProcessingRef.current = false;
      }

      animFrameIdRef.current = requestAnimationFrame(processFrame);
    }

    animFrameIdRef.current = requestAnimationFrame(processFrame);

    return () => {
      isRunning = false;
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
    postureClassification
  };
}
