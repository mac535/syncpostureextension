import React, { useEffect, useRef, useState } from 'react';
import { send, onMessage } from '../lib/channel';
import type { SyncMessage } from '../types/messages';
import {
  initializeMediaPipe,
  detectLandmarksForVideo,
  drawLandmarksOnCanvas
} from '../lib/mediapipe/visionPipeline';
import {
  Video,
  VideoOff,
  Send,
  ShieldAlert,
  CheckCircle2,
  Radio,
  Activity,
  Cpu,
  Eye,
  User,
  Gauge
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const lastTimestampRef = useRef<number>(0);
  const fpsTimerRef = useRef<{ frames: number; lastTime: number }>({ frames: 0, lastTime: performance.now() });

  // Camera & Pipeline States
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [pipelineReady, setPipelineReady] = useState<boolean>(false);
  const [pipelineLoading, setPipelineLoading] = useState<boolean>(true);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  // Live Detection Stats
  const [poseDetected, setPoseDetected] = useState<boolean>(false);
  const [faceDetected, setFaceDetected] = useState<boolean>(false);
  const [poseLandmarksCount, setPoseLandmarksCount] = useState<number>(0);
  const [faceLandmarksCount, setFaceLandmarksCount] = useState<number>(0);
  const [measuredFps, setMeasuredFps] = useState<number>(0);

  // Broadcast Log State
  const [lastSentMessage, setLastSentMessage] = useState<string>('None yet');
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);

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
    let stream: MediaStream | null = null;

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

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraActive(true);
        }
      } catch (err: unknown) {
        console.error('Error accessing webcam:', err);
        const errorMsg = err instanceof Error ? err.message : 'Camera permission denied or camera unavailable';
        setCameraError(errorMsg);
        setCameraActive(false);
      }
    }

    startWebcam();

    // Listen for cross-tab messages (e.g., DEMO_READY)
    const unsubscribe = onMessage((msg: SyncMessage) => {
      const timestamp = new Date().toLocaleTimeString();
      setReceivedMessages((prev) => [
        `[${timestamp}] Received: ${msg.type} ${JSON.stringify(msg)}`,
        ...prev.slice(0, 9)
      ]);
    });

    return () => {
      unsubscribe();
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // 3. Inference & Canvas Debug Render Loop
  useEffect(() => {
    if (!pipelineReady || !cameraActive) {
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

        // Ensure strictly increasing monotonically increasing timestamps for MediaPipe VIDEO mode
        const currentTimestampMs = performance.now();
        const adjustedTimestampMs = currentTimestampMs > lastTimestampRef.current ? currentTimestampMs : lastTimestampRef.current + 1;
        lastTimestampRef.current = adjustedTimestampMs;

        // Match overlay canvas dimensions to video feed
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

            // Render landmark skeleton & mesh on debug canvas
            drawLandmarksOnCanvas(ctx, canvas.width, canvas.height, poseLandmarks, faceLandmarks);

            // Update status metrics
            const isPosePresent = Boolean(poseLandmarks && poseLandmarks.length > 0);
            const isFacePresent = Boolean(faceLandmarks && faceLandmarks.length > 0);

            setPoseDetected(isPosePresent);
            setFaceDetected(isFacePresent);
            setPoseLandmarksCount(poseLandmarks?.length ?? 0);
            setFaceLandmarksCount(faceLandmarks?.length ?? 0);
          }
        }

        // Compute real-time FPS
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
  }, [pipelineReady, cameraActive]);

  const handleSendTestSignal = () => {
    const msg: SyncMessage = {
      type: 'POSTURE_STATUS',
      status: 'slouching',
      severity: 2
    };
    send(msg);
    setLastSentMessage(`POSTURE_STATUS (slouching, severity: 2) at ${new Date().toLocaleTimeString()}`);
  };

  const handleSendClear = () => {
    const msg: SyncMessage = {
      type: 'CLEAR_INTERVENTION'
    };
    send(msg);
    setLastSentMessage(`CLEAR_INTERVENTION at ${new Date().toLocaleTimeString()}`);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1.5rem' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>Posture Monitor Dashboard</h1>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.2rem 0.65rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: cameraActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
              color: cameraActive ? '#34d399' : '#fb7185',
              border: `1px solid ${cameraActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`
            }}>
              {cameraActive ? <Video size={12} /> : <VideoOff size={12} />}
              {cameraActive ? 'Camera Live' : 'Camera Off'}
            </span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.2rem 0.65rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: pipelineReady ? 'rgba(59, 130, 246, 0.15)' : pipelineLoading ? 'rgba(245, 158, 11, 0.15)' : 'rgba(244, 63, 94, 0.15)',
              color: pipelineReady ? '#60a5fa' : pipelineLoading ? '#fbbf24' : '#fb7185',
              border: `1px solid ${pipelineReady ? 'rgba(59, 130, 246, 0.3)' : pipelineLoading ? 'rgba(245, 158, 11, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`
            }}>
              <Cpu size={12} />
              {pipelineReady ? 'MediaPipe Ready' : pipelineLoading ? 'Loading Models...' : 'Pipeline Error'}
            </span>
          </div>
          <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Broadcasting on channel: <strong style={{ color: '#60a5fa' }}>posturesync</strong>
          </p>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(0, 1fr)', gap: '2rem' }}>
        {/* Left Column: Live Webcam View with Canvas Landmark Overlay */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              <Activity size={18} color="#60a5fa" />
              <span>Live Vision Feed (Pose & Face Overlay)</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>100% on-device inference</span>
          </div>

          <div style={{
            position: 'relative',
            width: '100%',
            backgroundColor: '#030712',
            borderRadius: '0.75rem',
            overflow: 'hidden',
            aspectRatio: '16 / 9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            {cameraError ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#f87171' }}>
                <ShieldAlert size={36} style={{ margin: '0 auto 0.5rem' }} />
                <p style={{ fontWeight: 600 }}>Camera Access Error</p>
                <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.25rem' }}>{cameraError}</p>
              </div>
            ) : pipelineError ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#f87171' }}>
                <ShieldAlert size={36} style={{ margin: '0 auto 0.5rem' }} />
                <p style={{ fontWeight: 600 }}>MediaPipe Loading Error</p>
                <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.25rem' }}>{pipelineError}</p>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)' // Natural mirror feel
                  }}
                />
                <canvas
                  ref={canvasRef}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)', // Synchronized mirrored overlay
                    pointerEvents: 'none'
                  }}
                />
              </>
            )}
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#9ca3af', fontSize: '0.8rem' }}>
            <CheckCircle2 size={15} color="#10b981" />
            <span>Pose & Face Landmarkers operational in GPU video stream mode.</span>
          </div>
        </div>

        {/* Right Column: Status Cards, Test Controls & Event Log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Real-time Status Card */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Gauge size={18} color="#60a5fa" /> Real-Time Vision Status
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
              {/* Pose Status Box */}
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                background: poseDetected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${poseDetected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                  <User size={13} /> Pose Landmarker
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: poseDetected ? '#34d399' : '#9ca3af' }}>
                  {poseDetected ? `DETECTED (${poseLandmarksCount} pts)` : 'NOT DETECTED'}
                </div>
              </div>

              {/* Face Status Box */}
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                background: faceDetected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${faceDetected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                  <Eye size={13} /> Face Landmarker
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: faceDetected ? '#34d399' : '#9ca3af' }}>
                  {faceDetected ? `DETECTED (${faceLandmarksCount} pts)` : 'NOT DETECTED'}
                </div>
              </div>
            </div>

            {/* Inference FPS & Ready Indicator */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              background: 'rgba(0, 0, 0, 0.25)',
              fontSize: '0.8rem',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div>
                <span style={{ color: '#9ca3af' }}>Inference Cadence: </span>
                <strong style={{ color: '#60a5fa' }}>{measuredFps > 0 ? `~${measuredFps} FPS` : 'Measuring...'}</strong>
              </div>
              <div>
                <span style={{ color: '#9ca3af' }}>Engine: </span>
                <strong style={{ color: '#a78bfa' }}>MediaPipe WASM (GPU)</strong>
              </div>
            </div>
          </div>

          {/* Signal Control Box */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Radio size={18} color="#818cf8" /> Cross-Tab Test Controls
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '1.25rem', lineHeight: 1.4 }}>
              Broadcast test signals to any open <code style={{ color: '#e5e7eb' }}>/demo</code> tab to verify instant intervention reactions.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                id="btn-send-test-signal"
                className="btn btn-danger"
                onClick={handleSendTestSignal}
                style={{ width: '100%' }}
              >
                <Send size={16} /> Send Test Signal (Slouching Severity 2)
              </button>

              <button
                id="btn-clear-intervention"
                className="btn btn-secondary"
                onClick={handleSendClear}
                style={{ width: '100%' }}
              >
                <CheckCircle2 size={16} color="#10b981" /> Clear Intervention
              </button>
            </div>

            <div style={{
              marginTop: '1.25rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              background: 'rgba(0, 0, 0, 0.25)',
              fontSize: '0.8rem',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <span style={{ color: '#9ca3af' }}>Last Sent: </span>
              <span style={{ color: '#60a5fa', fontWeight: 500 }}>{lastSentMessage}</span>
            </div>
          </div>

          {/* Activity / Event Log */}
          <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem', color: '#9ca3af' }}>
              Channel Activity
            </h3>
            <div style={{
              flex: 1,
              minHeight: '100px',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '0.5rem',
              padding: '0.75rem',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              overflowY: 'auto',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              color: '#d1d5db'
            }}>
              {receivedMessages.length === 0 ? (
                <div style={{ color: '#6b7280', fontStyle: 'italic' }}>Waiting for channel events (e.g., /demo tab ready)...</div>
              ) : (
                receivedMessages.map((msg, idx) => (
                  <div key={idx} style={{ marginBottom: '0.35rem', wordBreak: 'break-all' }}>
                    {msg}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
