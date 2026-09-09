import React, { useEffect, useState } from 'react';
import { send, onMessage } from '../lib/channel';
import type { SyncMessage } from '../types/messages';
import { useVisionFeed } from '../lib/hooks/useVisionFeed';
import { ShieldAlert } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const {
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
  } = useVisionFeed({ active: true });

  // Broadcast Log State
  const [lastSentMessage, setLastSentMessage] = useState<string>('None yet');
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);

  // Listen for cross-tab messages (e.g., DEMO_READY)
  useEffect(() => {
    const unsubscribe = onMessage((msg: SyncMessage) => {
      const timestamp = new Date().toLocaleTimeString();
      setReceivedMessages((prev) => [
        `[${timestamp}] Received: ${msg.type} ${JSON.stringify(msg)}`,
        ...prev.slice(0, 9)
      ]);
    });

    return () => {
      unsubscribe();
    };
  }, []);

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
    <div style={{ maxWidth: '1240px', margin: '2rem auto 4rem', padding: '0 1.5rem', fontFamily: 'var(--font-display)' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--ink-border)', paddingBottom: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--ink-text)', margin: 0 }}>
              POSTURE MONITOR READOUT
            </h1>

            {/* Status indicators: plain --font-mono labels preceded by small square indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.04em' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: cameraActive ? 'var(--ink-text)' : 'var(--ink-muted)' }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  backgroundColor: cameraActive ? 'var(--signal-good)' : 'var(--signal-alert)',
                  display: 'inline-block'
                }} />
                {cameraActive ? 'CAMERA: LIVE' : 'CAMERA: OFF'}
              </span>

              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: pipelineReady ? 'var(--ink-text)' : 'var(--ink-muted)' }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  backgroundColor: pipelineReady ? 'var(--signal-good)' : pipelineLoading ? 'var(--ink-muted)' : 'var(--signal-alert)',
                  display: 'inline-block'
                }} />
                {pipelineReady ? 'MEDIAPIPE: READY' : pipelineLoading ? 'MEDIAPIPE: INITIALIZING' : 'MEDIAPIPE: ERROR'}
              </span>
            </div>
          </div>

          <p style={{ color: 'var(--ink-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', marginTop: '0.5rem', margin: 0 }}>
            BROADCAST CHANNEL : <span style={{ color: 'var(--ink-text)' }}>posturesync</span> (same-origin)
          </p>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', gap: '1.5rem' }}>
        {/* Left Column: Live Webcam View with Canvas Landmark Overlay */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header" style={{ marginBottom: '1rem' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', color: 'var(--ink-text)' }}>
                OPTICAL FEED // GEOMETRY OVERLAY
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                LOCAL WASM
              </span>
            </div>

            <div style={{
              position: 'relative',
              width: '100%',
              backgroundColor: '#071220',
              borderRadius: '2px',
              overflow: 'hidden',
              aspectRatio: '16 / 9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--ink-border)'
            }}>
              {cameraError ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--signal-alert)' }}>
                  <ShieldAlert size={32} style={{ margin: '0 auto 0.5rem' }} />
                  <p style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>CAMERA ACCESS ERROR</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: '0.25rem' }}>{cameraError}</p>
                </div>
              ) : pipelineError ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--signal-alert)' }}>
                  <ShieldAlert size={32} style={{ margin: '0 auto 0.5rem' }} />
                  <p style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>MEDIAPIPE ERROR</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: '0.25rem' }}>{pipelineError}</p>
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
                      transform: 'scaleX(-1)'
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
                      transform: 'scaleX(-1)',
                      pointerEvents: 'none'
                    }}
                  />
                </>
              )}
            </div>

            <div style={{
              marginTop: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--ink-muted)'
            }}>
              <span>INFERENCE RATE : <span style={{ color: 'var(--ink-text)' }}>{measuredFps} FPS</span></span>
              <span>{poseDetected ? '33 LANDMARKS ACTIVE' : 'NO SUBJECT DETECTED'}</span>
            </div>
          </div>

          {/* Cross-Tab Signal Controls */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div className="panel-header">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', color: 'var(--ink-text)' }}>
                TELEMETRY BUS CONTROL
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                SIMULATION
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
              Transmit test signal events over <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-text)' }}>BroadcastChannel</span> to verify target workspace reactions.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                id="btn-send-test-signal"
                className="btn btn-danger"
                onClick={handleSendTestSignal}
              >
                Send Test (Slouching 2)
              </button>

              <button
                id="btn-clear-intervention"
                className="btn btn-secondary"
                onClick={handleSendClear}
              >
                Clear Intervention
              </button>
            </div>

            <div style={{
              marginTop: '0.85rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '2px',
              background: 'var(--ink-bg)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
              border: '1px solid var(--ink-border)'
            }}>
              <span style={{ color: 'var(--ink-muted)' }}>LAST EMITTED // </span>
              <span style={{ color: 'var(--ink-text)' }}>{lastSentMessage}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Real-Time Posture Analytics, Classifier & Visibility Debug */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Posture Classification Status Card */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div className="panel-header" style={{ alignItems: 'baseline' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', color: 'var(--ink-text)' }}>
                POSTURE INTELLIGENCE CLASSIFIER
              </span>

              {/* Bracketed --font-mono label style */}
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.06em',
                color:
                  postureClassification.status === 'good' ? 'var(--signal-good)' :
                  postureClassification.status === 'insufficient_data' ? 'var(--ink-muted)' :
                  'var(--signal-alert)'
              }}>
                [ {postureClassification.status.toUpperCase().replace('_', ' ')}{postureClassification.severity > 0 ? ` · SEV ${postureClassification.severity}` : ''} ]
              </span>
            </div>

            {/* Diagnostic Reason */}
            <div style={{
              padding: '0.65rem 0.85rem',
              borderRadius: '2px',
              background: 'var(--ink-bg)',
              fontSize: '0.8rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--ink-muted)',
              marginBottom: '1rem',
              border: '1px solid var(--ink-border)'
            }}>
              <span style={{ color: 'var(--ink-text)' }}>DIAGNOSIS : </span>
              {postureClassification.reason}
            </div>

            {/* Live Metrics Grid with 3px left border-accent stripe on threshold breach */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
              {/* Lateral Tilt */}
              {(() => {
                const isBreached = (postureMetrics?.lateralTiltDeg ?? 0) >= 6;
                return (
                  <div style={{
                    padding: '0.65rem 0.75rem',
                    borderRadius: '2px',
                    background: 'var(--ink-bg)',
                    border: '1px solid var(--ink-border)',
                    borderLeft: isBreached ? '3px solid var(--signal-alert)' : '1px solid var(--ink-border)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--ink-muted)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', marginBottom: '0.25rem' }}>
                      <span>LATERAL TILT</span>
                      {isBreached && <span style={{ color: 'var(--signal-alert)', fontSize: '0.65rem' }}>WARN</span>}
                    </div>
                    <div style={{ fontSize: '1.15rem', fontFamily: 'var(--font-mono)', fontWeight: 500, color: isBreached ? 'var(--signal-alert)' : 'var(--ink-text)' }}>
                      {postureMetrics?.lateralTiltDeg !== null && postureMetrics?.lateralTiltDeg !== undefined
                        ? `${postureMetrics.lateralTiltDeg}°`
                        : '—'}
                      {postureMetrics?.leanDirection !== 'neutral' && postureMetrics?.lateralTiltDeg !== null && postureMetrics?.lateralTiltDeg !== undefined ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginLeft: '6px' }}>({postureMetrics?.leanDirection})</span>
                      ) : null}
                    </div>
                  </div>
                );
              })()}

              {/* Shoulder Tilt */}
              {(() => {
                const isBreached = (postureMetrics?.shoulderTiltDeg ?? 0) >= 5;
                return (
                  <div style={{
                    padding: '0.65rem 0.75rem',
                    borderRadius: '2px',
                    background: 'var(--ink-bg)',
                    border: '1px solid var(--ink-border)',
                    borderLeft: isBreached ? '3px solid var(--signal-alert)' : '1px solid var(--ink-border)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--ink-muted)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', marginBottom: '0.25rem' }}>
                      <span>SHOULDER TILT</span>
                      {isBreached && <span style={{ color: 'var(--signal-alert)', fontSize: '0.65rem' }}>WARN</span>}
                    </div>
                    <div style={{ fontSize: '1.15rem', fontFamily: 'var(--font-mono)', fontWeight: 500, color: isBreached ? 'var(--signal-alert)' : 'var(--ink-text)' }}>
                      {postureMetrics?.shoulderTiltDeg !== null && postureMetrics?.shoulderTiltDeg !== undefined
                        ? `${postureMetrics.shoulderTiltDeg}°`
                        : '—'}
                    </div>
                  </div>
                );
              })()}

              {/* Head Forward Offset */}
              {(() => {
                const isBreached = (postureMetrics?.headForwardOffset ?? 0) >= 0.16;
                return (
                  <div style={{
                    padding: '0.65rem 0.75rem',
                    borderRadius: '2px',
                    background: 'var(--ink-bg)',
                    border: '1px solid var(--ink-border)',
                    borderLeft: isBreached ? '3px solid var(--signal-alert)' : '1px solid var(--ink-border)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--ink-muted)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', marginBottom: '0.25rem' }}>
                      <span>HEAD OFFSET</span>
                      {isBreached && <span style={{ color: 'var(--signal-alert)', fontSize: '0.65rem' }}>WARN</span>}
                    </div>
                    <div style={{ fontSize: '1.15rem', fontFamily: 'var(--font-mono)', fontWeight: 500, color: isBreached ? 'var(--signal-alert)' : 'var(--ink-text)' }}>
                      {postureMetrics?.headForwardOffset !== null && postureMetrics?.headForwardOffset !== undefined
                        ? postureMetrics.headForwardOffset
                        : '—'}
                    </div>
                  </div>
                );
              })()}

              {/* Head Torso Angle */}
              {(() => {
                const isBreached = (postureMetrics?.headTorsoAngleDeg ?? 0) >= 18;
                return (
                  <div style={{
                    padding: '0.65rem 0.75rem',
                    borderRadius: '2px',
                    background: 'var(--ink-bg)',
                    border: '1px solid var(--ink-border)',
                    borderLeft: isBreached ? '3px solid var(--signal-alert)' : '1px solid var(--ink-border)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--ink-muted)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', marginBottom: '0.25rem' }}>
                      <span>HEAD-TORSO ANGLE</span>
                      {isBreached && <span style={{ color: 'var(--signal-alert)', fontSize: '0.65rem' }}>WARN</span>}
                    </div>
                    <div style={{ fontSize: '1.15rem', fontFamily: 'var(--font-mono)', fontWeight: 500, color: isBreached ? 'var(--signal-alert)' : 'var(--ink-text)' }}>
                      {postureMetrics?.headTorsoAngleDeg !== null && postureMetrics?.headTorsoAngleDeg !== undefined
                        ? `${postureMetrics.headTorsoAngleDeg}°`
                        : '—'}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Confidence & Landmark Health Bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '0.85rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '2px',
              background: 'var(--ink-bg)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
              border: '1px solid var(--ink-border)'
            }}>
              <div>
                <span style={{ color: 'var(--ink-muted)' }}>CONFIDENCE // </span>
                <span style={{ color: (postureMetrics?.confidence ?? 0) > 0.4 ? 'var(--signal-good)' : 'var(--ink-muted)' }}>
                  {postureMetrics ? `${Math.round(postureMetrics.confidence * 100)}%` : '0%'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--ink-muted)' }}>STATE // </span>
                <span style={{ color: poseDetected ? 'var(--signal-good)' : 'var(--ink-muted)' }}>
                  {poseDetected ? 'LOCKED' : 'SEARCHING'}
                </span>
              </div>
            </div>
          </div>

          {/* Developer Landmark Visibility Debug Table */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div className="panel-header">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', color: 'var(--ink-text)' }}>
                LANDMARK VISIBILITY MATRIX
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                RAW SCORE
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
              {[
                { label: 'NOSE', val: postureMetrics?.visibilityDebug.nose },
                { label: 'L. EAR', val: postureMetrics?.visibilityDebug.leftEar },
                { label: 'R. EAR', val: postureMetrics?.visibilityDebug.rightEar },
                { label: 'L. SHOULDER', val: postureMetrics?.visibilityDebug.leftShoulder },
                { label: 'R. SHOULDER', val: postureMetrics?.visibilityDebug.rightShoulder },
                { label: 'L. HIP', val: postureMetrics?.visibilityDebug.leftHip },
                { label: 'R. HIP', val: postureMetrics?.visibilityDebug.rightHip },
                { label: 'CONFIDENCE', val: postureMetrics?.confidence !== undefined ? Number(postureMetrics.confidence.toFixed(2)) : undefined }
              ].map((item, idx) => {
                const numericVal = typeof item.val === 'number' ? item.val : null;
                const isGood = numericVal !== null && numericVal > 0.3;
                return (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--ink-bg)',
                      padding: '0.4rem 0.55rem',
                      borderRadius: '2px',
                      border: '1px solid var(--ink-border)'
                    }}
                  >
                    <div style={{ color: 'var(--ink-muted)', fontSize: '0.65rem', marginBottom: '2px' }}>{item.label}</div>
                    <div style={{ color: isGood ? 'var(--signal-good)' : 'var(--ink-muted)' }}>
                      {item.val ?? 'N/A'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Activity / Event Log */}
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', color: 'var(--ink-text)' }}>
                CHANNEL ACTIVITY LOG
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                EVENT BUS
              </span>
            </div>

            <div style={{
              minHeight: '75px',
              backgroundColor: 'var(--ink-bg)',
              borderRadius: '2px',
              padding: '0.65rem',
              fontSize: '0.72rem',
              fontFamily: 'var(--font-mono)',
              overflowY: 'auto',
              border: '1px solid var(--ink-border)',
              color: 'var(--ink-muted)'
            }}>
              {receivedMessages.length === 0 ? (
                <div style={{ color: 'var(--ink-muted)', fontStyle: 'italic' }}>No incoming channel events logged.</div>
              ) : (
                receivedMessages.map((msg, idx) => (
                  <div key={idx} style={{ marginBottom: '0.25rem', wordBreak: 'break-all', color: 'var(--ink-text)' }}>
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
