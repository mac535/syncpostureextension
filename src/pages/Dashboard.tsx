import React, { useEffect, useRef, useState } from 'react';
import { send, onMessage } from '../lib/channel';
import type { SyncMessage } from '../types/messages';
import { useVisionFeed } from '../lib/hooks/useVisionFeed';
import { PostureDebouncer } from '../lib/posture/temporalDebounce';
import type { DebouncerState } from '../lib/posture/temporalDebounce';
import { PostureInstructions } from '../components/PostureInstructions';
import { ShieldAlert, VideoOff } from 'lucide-react';
import { TwentyTwentyTimer } from '../lib/break/twentyTwentyTimer';
import { PrivacyNotice } from '../components/PrivacyNotice';
import { hasPrivacyConsent, setPrivacyConsent } from '../lib/privacy/privacyConsent';

export const Dashboard: React.FC = () => {
  // Privacy Notice & Camera Consent Gate
  const [hasConsent, setHasConsent] = useState<boolean>(() => hasPrivacyConsent());
  const [showPrivacyNotice, setShowPrivacyNotice] = useState<boolean>(() => !hasPrivacyConsent());
  const [userDeclinedConsent, setUserDeclinedConsent] = useState<boolean>(false);

  const handlePrivacyContinue = () => {
    setPrivacyConsent();
    setHasConsent(true);
    setShowPrivacyNotice(false);
    setUserDeclinedConsent(false);
  };

  const handlePrivacyNotNow = () => {
    setShowPrivacyNotice(false);
    setUserDeclinedConsent(true);
  };

  const handleReopenPrivacyNotice = () => {
    setShowPrivacyNotice(true);
  };

  const isCameraEnabled = hasConsent && !userDeclinedConsent;

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
    postureClassification,
    personCount,
    detectionMode,
    leftEAR,
    rightEAR,
    averageEAR,
    eyesClosed,
    eyeState,
    blinkDetected,
    blinkCount,
    blinksPerMinute,
    blinkRateStatus,
    lowBlinkRate,
    blinkTimestamps,
    observationProgress,
    stateMachineState,
    lastBlinkTimestampMs,
  } = useVisionFeed({ active: isCameraEnabled, hasConsent: isCameraEnabled });

  // Posture Instructions Orientation state
  const [hasSeenInstructions, setHasSeenInstructions] = useState<boolean>(() => {
    return localStorage.getItem('postureInstructionsSeen') === 'true';
  });

  // Secondary tab launch error state
  const [popupBlocked, setPopupBlocked] = useState<boolean>(false);

  // Target window reference name for secondary tab reuse
  const DEMO_WINDOW_NAME = 'syncPostureDemo';

  const launchDemoTab = () => {
    try {
      const demoUrl = `${window.location.origin}/demo`;
      const secondaryTab = window.open(demoUrl, DEMO_WINDOW_NAME);
      if (!secondaryTab || secondaryTab.closed || typeof secondaryTab.closed === 'undefined') {
        setPopupBlocked(true);
      } else {
        setPopupBlocked(false);
        secondaryTab.focus();
      }
    } catch (err) {
      console.error('Failed to open secondary tab:', err);
      setPopupBlocked(true);
    }
  };

  const handleCompleteInstructions = () => {
    localStorage.setItem('postureInstructionsSeen', 'true');
    setHasSeenInstructions(true);
    // Emit SETUP_COMPLETE over BroadcastChannel so secondary tabs know setup is valid
    send({ type: 'SETUP_COMPLETE' });
    // Keep Dashboard alive! Open secondary tab without unmounting Dashboard
    launchDemoTab();
  };

  const handleDismissInstructions = () => {
    localStorage.setItem('postureInstructionsSeen', 'true');
    setHasSeenInstructions(true);
  };

  const handleRestartSetup = () => {
    localStorage.removeItem('postureInstructionsSeen');
    setHasSeenInstructions(false);
  };

  // ---------- Demo Tab Connection State ----------
  const [demoConnected, setDemoConnected] = useState<boolean>(false);
  const demoHeartbeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------- Broadcast Log State ----------
  const [lastSentMessage, setLastSentMessage] = useState<string>('None yet');
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);
  const lastLogSampleTimeRef = useRef<number>(0);
  const lastTelemetryBroadcastTimeRef = useRef<number>(0);

  // ---------- Auto-broadcast via PostureDebouncer ----------
  const [smoothedScore, setSmoothedScore] = useState<number>(0);
  const [debouncerState, setDebouncerState] = useState<DebouncerState>('idle');

  // Stable ref so the debouncer instance survives re-renders
  const debouncerRef = useRef<PostureDebouncer | null>(null);
  const prevDetectionModeRef = useRef<string>(detectionMode);

  if (!debouncerRef.current) {
    debouncerRef.current = new PostureDebouncer({
      onTriggered: (score) => {
        void score;
      },
      onCleared: () => {},
      onScoreUpdate: (score) => setSmoothedScore(score),
    });
  }

  // Reset debouncer whenever camera goes offline
  useEffect(() => {
    if (!cameraActive) {
      debouncerRef.current?.reset();
    }
  }, [cameraActive]);

  // Handle clean mode switching:
  // When transitioning to multi_person or no_person: reset debouncer and immediately clear any intervention on Demo
  // When transitioning back to single_person: ensure clean re-entry without stale debouncer scores
  useEffect(() => {
    const prevMode = prevDetectionModeRef.current;
    prevDetectionModeRef.current = detectionMode;

    if (detectionMode !== 'single_person') {
      debouncerRef.current?.reset();
      setSmoothedScore(0);
      setDebouncerState('idle');
      // If we previously had an intervention triggered or were in single_person mode, broadcast CLEAR_INTERVENTION
      send({ type: 'CLEAR_INTERVENTION' });
    } else if (prevMode !== 'single_person') {
      // Clean re-entry into single_person mode
      debouncerRef.current?.reset();
      setSmoothedScore(0);
      setDebouncerState('idle');
    }
  }, [detectionMode]);

  // Feed postureClassification into the debouncer and broadcast throttled continuous telemetry
  useEffect(() => {
    const debouncer = debouncerRef.current;
    if (!debouncer) return;

    // 1. Determine raw score: if multi-person, no-person, insufficient_data, score is 0
    const isSingle = detectionMode === 'single_person';
    const isInsufficient =
      !isSingle ||
      !postureMetrics?.isValid ||
      postureClassification.status === 'insufficient_data';
    const rawScore = isInsufficient ? 0 : (postureClassification.deviationScore ?? 0);

    // 2. Capture debouncer state transitions
    const prevState = debouncer.currentState;
    debouncer.update(rawScore);
    const nextState = debouncer.currentState;

    if (prevState !== nextState) {
      setDebouncerState(nextState);
    }

    // 3. Compute telemetry properties
    // When posture is good or insufficient data, intensity is 0
    const rawSmoothed = debouncer.currentSmoothedScore;
    let clampedIntensity = Math.max(0, Math.min(1, rawSmoothed));

    const status = isInsufficient ? 'insufficient_data' : postureClassification.status;
    if (status === 'good' || status === 'insufficient_data') {
      clampedIntensity = 0;
    }

    const severity = isInsufficient || status === 'good' ? 0 : postureClassification.severity;
    const now = Date.now();

    // 4. Immediate sends on critical state transitions
    const isStateTransition = prevState !== nextState;

    if (prevState !== 'triggered' && nextState === 'triggered') {
      // Sustained bad posture triggered
      const triggerStatus = status === 'good' || status === 'insufficient_data' ? 'slouching' : status;
      send({
        type: 'POSTURE_STATUS',
        status: triggerStatus,
        severity: severity > 0 ? severity : 1,
        intensity: clampedIntensity > 0 ? clampedIntensity : 0.35,
      });
    } else if (prevState === 'recovering' && nextState === 'idle') {
      // Clear intervention
      send({ type: 'CLEAR_INTERVENTION' });
    }

    // 5. Throttled continuous telemetry broadcast (approx ~10Hz / 100ms interval or immediate on state change)
    const timeSinceLastBroadcast = now - lastTelemetryBroadcastTimeRef.current;
    if (isStateTransition || timeSinceLastBroadcast >= 95) {
      lastTelemetryBroadcastTimeRef.current = now;

      send({
        type: 'POSTURE_TELEMETRY',
        status,
        severity,
        intensity: Number(clampedIntensity.toFixed(3)),
        debouncerState: nextState,
        timestamp: now
      });

      // 6. Log sampling: log immediately on state change, or sample approx once per second
      const timeSinceLastLog = now - lastLogSampleTimeRef.current;
      if (isStateTransition || timeSinceLastLog >= 1000) {
        lastLogSampleTimeRef.current = now;
        const logEntry = `POSTURE_TELEMETRY status=${status} severity=${severity} intensity=${clampedIntensity.toFixed(2)} state=${nextState}`;
        setLastSentMessage(`${logEntry} at ${new Date(now).toLocaleTimeString()}`);
        setReceivedMessages((prev) => [
          `[${new Date(now).toLocaleTimeString()}] Broadcast: ${logEntry}`,
          ...prev.slice(0, 9)
        ]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postureClassification, postureMetrics, detectionMode]);

  // ---------- Blink Alert BroadcastChannel Integration ----------
  // Tracks previous lowBlinkRate so we only emit BLINK_ALERT on the
  // exact transition false→true (alert activated) or true→false (recovered).
  // Never emits per-frame; always at most one message per state change.
  const prevLowBlinkRateRef = useRef<boolean>(false);
  const lastBlinkAlertRateRef = useRef<number | null>(null);

  useEffect(() => {
    const prevLow = prevLowBlinkRateRef.current;
    prevLowBlinkRateRef.current = lowBlinkRate;

    if (blinkRateStatus !== 'active') {
      // Still collecting: never send alert regardless of rate
      return;
    }

    if (!prevLow && lowBlinkRate) {
      // Transition: normal → low blink alert ACTIVATED
      // Send BLINK_ALERT once when the debounced condition fires
      const rate = blinksPerMinute ?? 0;
      lastBlinkAlertRateRef.current = rate;
      send({ type: 'BLINK_ALERT', blinksPerMin: rate });

      const now = Date.now();
      setLastSentMessage(`BLINK_ALERT blinksPerMin=${rate} at ${new Date(now).toLocaleTimeString()}`);
      setReceivedMessages((prev) => [
        `[${new Date(now).toLocaleTimeString()}] Broadcast: BLINK_ALERT (rate=${rate}/min — LOW)`,
        ...prev.slice(0, 9)
      ]);
    } else if (prevLow && !lowBlinkRate) {
      // Transition: low blink alert CLEARED — tell Demo to clear its intervention
      lastBlinkAlertRateRef.current = null;
      send({ type: 'CLEAR_INTERVENTION' });

      const now = Date.now();
      setLastSentMessage(`CLEAR_INTERVENTION (blink recovered) at ${new Date(now).toLocaleTimeString()}`);
      setReceivedMessages((prev) => [
        `[${new Date(now).toLocaleTimeString()}] Broadcast: CLEAR_INTERVENTION (blink rate recovered)`,
        ...prev.slice(0, 9)
      ]);
    } else if (lowBlinkRate && blinksPerMinute !== null) {
      // Alert is still active: re-broadcast if rate has changed meaningfully (±2 bpm)
      // so Demo always shows the latest rate while the alert is live
      const prev = lastBlinkAlertRateRef.current;
      if (prev === null || Math.abs(blinksPerMinute - prev) >= 2) {
        lastBlinkAlertRateRef.current = blinksPerMinute;
        send({ type: 'BLINK_ALERT', blinksPerMin: blinksPerMinute });
      }
    }
  // Depend only on the debounced boolean and rate; not on per-frame state
  }, [lowBlinkRate, blinksPerMinute, blinkRateStatus]);

  // ---------- 20-20-20 Authoritative Eye Break Timer Engine ----------
  const twentyTwentyTimerRef = useRef<TwentyTwentyTimer | null>(null);
  if (!twentyTwentyTimerRef.current) {
    twentyTwentyTimerRef.current = new TwentyTwentyTimer();
    if (typeof window !== 'undefined') {
      (window as any).__twentyTwentyTimer = twentyTwentyTimerRef.current;
    }
  }

  useEffect(() => {
    const timer = twentyTwentyTimerRef.current;
    if (!timer) return;

    if (cameraActive) {
      timer.start();
    } else {
      timer.pause();
      return;
    }

    let prevState = timer.getSnapshot().state;

    const intervalId = setInterval(() => {
      const snap = timer.update();
      const currentState = snap.state;

      if (currentState === 'break') {
        const remainingSeconds = Math.ceil(snap.breakRemainingMs / 1000);
        send({
          type: 'BREAK_REMINDER',
          state: 'break',
          remainingSeconds
        });
      } else if (prevState === 'break' && currentState === 'monitoring') {
        send({
          type: 'BREAK_REMINDER',
          state: 'complete',
          remainingSeconds: 0
        });
      }

      prevState = currentState;
    }, 500);

    return () => {
      clearInterval(intervalId);
    };
  }, [cameraActive]);

  // ---------- Channel Activity & Demo Heartbeat Listener ----------
  useEffect(() => {
    const unsubscribe = onMessage((msg: SyncMessage) => {
      const timestamp = new Date().toLocaleTimeString();

      if (msg.type === 'DEMO_READY') {
        setDemoConnected(true);
        // Reset timeout for demo presence
        if (demoHeartbeatTimeoutRef.current) {
          clearTimeout(demoHeartbeatTimeoutRef.current);
        }
        demoHeartbeatTimeoutRef.current = setTimeout(() => {
          setDemoConnected(false);
        }, 15000);

        setReceivedMessages((prev) => [
          `[${timestamp}] Received: DEMO_READY (Demo Tab Connected)`,
          ...prev.slice(0, 9)
        ]);

        // Synchronize initial state to newly connected Demo
        const debouncer = debouncerRef.current;
        const currentDebouncerState = debouncer?.currentState ?? 'idle';
        const isInsufficient =
          !postureMetrics?.isValid ||
          postureClassification.status === 'insufficient_data';
        const currentStatus = isInsufficient ? 'insufficient_data' : postureClassification.status;
        const currentIntensity =
          currentStatus === 'good' || currentStatus === 'insufficient_data'
            ? 0
            : Math.max(0, Math.min(1, debouncer?.currentSmoothedScore ?? 0));

        send({
          type: 'POSTURE_TELEMETRY',
          status: currentStatus,
          severity: currentStatus === 'good' || isInsufficient ? 0 : postureClassification.severity,
          intensity: Number(currentIntensity.toFixed(3)),
          debouncerState: currentDebouncerState,
          timestamp: Date.now()
        });

        if (currentDebouncerState === 'triggered' && currentStatus !== 'good' && currentStatus !== 'insufficient_data') {
          send({
            type: 'POSTURE_STATUS',
            status: currentStatus,
            severity: postureClassification.severity,
            intensity: currentIntensity
          });
        }

        // Synchronize 20-20-20 break state if break is currently active
        const timerSnap = twentyTwentyTimerRef.current?.getSnapshot();
        if (timerSnap && timerSnap.state === 'break') {
          send({
            type: 'BREAK_REMINDER',
            state: 'break',
            remainingSeconds: Math.ceil(timerSnap.breakRemainingMs / 1000)
          });
        }
      } else {
        setReceivedMessages((prev) => [
          `[${timestamp}] Received: ${msg.type} ${JSON.stringify(msg)}`,
          ...prev.slice(0, 9)
        ]);
      }
    });

    return () => {
      unsubscribe();
      if (demoHeartbeatTimeoutRef.current) {
        clearTimeout(demoHeartbeatTimeoutRef.current);
      }
    };
  }, [postureClassification, postureMetrics]);

  const handleSendTestSignal = () => {
    const msg: SyncMessage = {
      type: 'POSTURE_STATUS',
      status: 'slouching',
      severity: 2,
      intensity: 0.6
    };
    send(msg);
    setLastSentMessage(`MANUAL POSTURE_STATUS (slouching, severity: 2, intensity: 0.6) at ${new Date().toLocaleTimeString()}`);
  };

  const handleSendClear = () => {
    const msg: SyncMessage = {
      type: 'CLEAR_INTERVENTION'
    };
    send(msg);
    setLastSentMessage(`MANUAL CLEAR_INTERVENTION at ${new Date().toLocaleTimeString()}`);
  };

  return (
    <div className="dashboard-wrapper">
      {/* Header bar */}
      <div className="dashboard-header-bar">
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--ink-text)', margin: '0 0 0.65rem' }}>
            POSTURE MONITOR READOUT
          </h1>

          {/* 4-state monitoring status strip */}
          <div className="status-row" role="status" aria-label="System status">
            {/* 1. Camera */}
            <span className="status-item">
              <span
                className={`status-dot ${cameraActive ? 'status-dot--good status-dot--pulse' : 'status-dot--alert'}`}
                aria-hidden="true"
              />
              <span className={cameraActive ? 'status-label--good' : 'status-label--alert'}>
                {cameraActive ? 'CAMERA LIVE' : 'CAMERA OFF'}
              </span>
            </span>

            {/* 2. MediaPipe */}
            <span className="status-item">
              <span
                className={`status-dot ${pipelineReady ? 'status-dot--good' : pipelineLoading ? 'status-dot--muted' : 'status-dot--alert'}`}
                aria-hidden="true"
              />
              <span className={pipelineReady ? 'status-label--good' : pipelineLoading ? 'status-label--muted' : 'status-label--alert'}>
                {pipelineReady ? 'MEDIAPIPE READY' : pipelineLoading ? 'MEDIAPIPE INIT...' : 'MEDIAPIPE ERROR'}
              </span>
            </span>

            {/* 3. Posture verified */}
            <span className="status-item">
              <span
                className={`status-dot ${hasSeenInstructions ? 'status-dot--good' : 'status-dot--muted'}`}
                aria-hidden="true"
              />
              <span className={hasSeenInstructions ? 'status-label--good' : 'status-label--muted'}>
                {hasSeenInstructions ? 'POSTURE VERIFIED' : 'SETUP PENDING'}
              </span>
            </span>

            {/* 4. Demo tab */}
            <span className="status-item">
              <span
                className={`status-dot ${demoConnected ? 'status-dot--good status-dot--pulse' : 'status-dot--muted'}`}
                aria-hidden="true"
              />
              <span className={demoConnected ? 'status-label--good' : 'status-label--muted'}>
                {demoConnected ? 'DEMO CONNECTED' : 'DEMO WAITING'}
              </span>
            </span>
          </div>
        </div>

        {/* Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {hasSeenInstructions && (
            <>
              <button
                id="btn-launch-demo-header"
                className="btn btn-primary"
                onClick={launchDemoTab}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.35rem 0.85rem',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                Launch Demo Workspace ↗
              </button>
              <button
                id="btn-review-posture-guide"
                onClick={handleRestartSetup}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--ink-border)',
                  borderRadius: '3px',
                  padding: '0.35rem 0.75rem',
                  color: 'var(--ink-muted)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--ink-text)';
                  e.currentTarget.style.borderColor = 'var(--ink-text)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--ink-muted)';
                  e.currentTarget.style.borderColor = 'var(--ink-border)';
                }}
              >
                [ RESTART SETUP ]
              </button>
            </>
          )}
        </div>
      </div>

      {/* Posture Setup Wizard Screen / Step (Orientation) */}
      {!hasSeenInstructions ? (
        <div style={{ marginBottom: '2rem' }}>
          <PostureInstructions
            postureMetrics={postureMetrics}
            onComplete={handleCompleteInstructions}
            onDismiss={handleDismissInstructions}
          />
        </div>
      ) : (
        /* Posture Locked / Monitoring Active Post-Setup Banner */
        <div
          style={{
            backgroundColor: 'var(--ink-panel)',
            border: '1px solid rgba(79,216,196,0.2)',
            borderLeft: '3px solid var(--signal-good)',
            borderRadius: '4px',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
          role="status"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  backgroundColor: 'var(--signal-good)',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
                aria-hidden="true"
              />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'var(--signal-good)'
                }}
              >
                POSTURE VERIFIED — MONITORING ACTIVE
              </span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              color: 'var(--ink-muted)',
              flexWrap: 'wrap'
            }}>
              <span>TAB 01 // MONITOR <span style={{ color: 'var(--signal-good)' }}>● ACTIVE</span></span>
              <span style={{ color: 'var(--ink-border)' }}>·</span>
              <span>TAB 02 // WORKSPACE <span style={{ color: demoConnected ? 'var(--signal-good)' : 'var(--ink-muted)' }}>{demoConnected ? '● CONNECTED' : '○ WAITING'}</span></span>
            </div>
          </div>

          <button
            id="btn-launch-demo-banner"
            className="btn btn-secondary"
            onClick={launchDemoTab}
            style={{
              fontSize: '0.72rem',
              padding: '0.35rem 0.85rem',
              fontFamily: 'var(--font-mono)'
            }}
            aria-label="Open Demo Workspace in a new tab"
          >
            Open Demo Workspace &#8599;
          </button>
        </div>
      )}

      {/* Popup Blocked Warning Notice */}
      {popupBlocked && (
        <div
          style={{
            backgroundColor: 'rgba(255, 107, 74, 0.12)',
            border: '1px solid var(--signal-alert)',
            borderRadius: '4px',
            padding: '0.85rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            color: 'var(--ink-text)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem'
          }}
        >
          <span>Demo tab could not be opened automatically. Use OPEN DEMO WORKSPACE to continue.</span>
          <button
            className="btn btn-danger"
            onClick={launchDemoTab}
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.85rem' }}
          >
            OPEN DEMO WORKSPACE
          </button>
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div className="dashboard-grid">
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
              {!hasConsent || userDeclinedConsent ? (
                <div style={{ textAlign: 'center', padding: '1.75rem 1.25rem', color: 'var(--ink-text)' }}>
                  <VideoOff size={32} style={{ margin: '0 auto 0.75rem', color: 'var(--ink-muted)' }} />
                  <p style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--ink-text)', letterSpacing: '0.04em' }}>
                    CAMERA ACCESS REQUIRED
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', margin: '0.4rem auto 1rem', maxWidth: '320px', lineHeight: 1.45 }}>
                    PostureSync needs camera access to provide real-time posture and blink monitoring.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleReopenPrivacyNotice}
                    style={{ fontSize: '0.8rem', padding: '0.45rem 1rem' }}
                  >
                    Allow Camera
                  </button>
                </div>
              ) : cameraError ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--signal-alert)' }}>
                  <ShieldAlert size={32} style={{ margin: '0 auto 0.5rem' }} />
                  <p style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                    {cameraError.includes('browser settings') ? 'CAMERA ACCESS BLOCKED' : 'CAMERA ACCESS ERROR'}
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: '0.35rem', maxWidth: '340px', lineHeight: 1.4 }}>
                    {cameraError}
                  </p>
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

            {/* Compact Head Count Indicator directly below webcam */}
            <div
              style={{
                marginTop: '0.85rem',
                padding: '0.65rem 0.85rem',
                backgroundColor: 'var(--ink-bg)',
                border: '1px solid var(--ink-border)',
                borderLeft:
                  detectionMode === 'multi_person'
                    ? '3px solid var(--signal-alert)'
                    : detectionMode === 'single_person'
                    ? '3px solid var(--signal-good)'
                    : '3px solid var(--ink-border)',
                borderRadius: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontFamily: 'var(--font-mono)'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '0.68rem', letterSpacing: '0.08em', color: 'var(--ink-muted)' }}>
                  HEAD COUNT
                </span>
                <span
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    lineHeight: 1.1,
                    color:
                      detectionMode === 'multi_person'
                        ? 'var(--signal-alert)'
                        : detectionMode === 'single_person'
                        ? 'var(--signal-good)'
                        : 'var(--ink-muted)'
                  }}
                >
                  {personCount}
                </span>
              </div>

              <div style={{ textAlign: 'right' }}>
                {detectionMode === 'single_person' && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      color: 'var(--signal-good)'
                    }}
                  >
                    POSTURE MONITORING ACTIVE
                  </span>
                )}
                {detectionMode === 'multi_person' && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      color: 'var(--signal-alert)'
                    }}
                  >
                    MULTI-PERSON MODE
                  </span>
                )}
                {detectionMode === 'no_person' && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--ink-muted)',
                      letterSpacing: '0.04em'
                    }}
                  >
                    NO SUBJECT DETECTED
                  </span>
                )}
              </div>
            </div>

            <div style={{
              marginTop: '0.65rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              color: 'var(--ink-muted)'
            }}>
              <span>INFERENCE RATE : <span style={{ color: 'var(--ink-text)' }}>{measuredFps} FPS</span></span>
              <span>{poseDetected ? '33 LANDMARKS ACTIVE' : 'POSE SENSOR PAUSED'}</span>
            </div>
          </div>

          {/* Blink Monitoring — Developer Telemetry Panel */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div className="panel-header" style={{ marginBottom: '0.85rem' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', color: 'var(--ink-text)' }}>
                OCULAR TELEMETRY // BLINK MONITOR
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                fontWeight: 600,
                color: eyesClosed ? 'var(--signal-alert)' : 'var(--signal-good)'
              }}>
                [ {eyeState} ]
              </span>
            </div>

            {/* ── Top row: BLINK RATE + BLINKS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.65rem' }}>
              {/* Blink Rate */}
              <div style={{
                background: lowBlinkRate ? 'rgba(255,107,74,0.08)' : 'var(--ink-bg)',
                padding: '0.65rem 0.85rem',
                borderRadius: '2px',
                border: `1px solid ${lowBlinkRate ? 'var(--signal-alert)' : 'var(--ink-border)'}`,
                borderLeft: `3px solid ${lowBlinkRate ? 'var(--signal-alert)' : blinkRateStatus === 'active' ? 'var(--signal-good)' : 'var(--ink-border)'}`,
                transition: 'all 0.2s ease'
              }}>
                <div style={{ color: 'var(--ink-muted)', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', marginBottom: '4px' }}>BLINK RATE</div>
                <div style={{ fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                  {blinkRateStatus === 'collecting' ? (
                    <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                      Collecting blink data&hellip;<br />
                      <span style={{ fontSize: '0.65rem', color: 'var(--ink-border)' }}>{Math.round(observationProgress * 100)}% of 30s</span>
                    </span>
                  ) : (
                    <>
                      <span style={{ fontSize: '1.5rem', fontWeight: 700, color: lowBlinkRate ? 'var(--signal-alert)' : 'var(--signal-good)' }}>
                        {blinksPerMinute ?? '—'}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginLeft: '4px' }}>blinks/min</span>
                      {lowBlinkRate && (
                        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--signal-alert)', marginTop: '3px', letterSpacing: '0.06em' }}>⚠ LOW (&lt; 10)</div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Blink count + last blink */}
              <div style={{
                background: blinkDetected ? 'rgba(79,216,196,0.12)' : 'var(--ink-bg)',
                padding: '0.65rem 0.85rem',
                borderRadius: '2px',
                border: `1px solid ${blinkDetected ? 'var(--signal-good)' : 'var(--ink-border)'}`,
                borderLeft: '3px solid var(--signal-good)',
                transition: 'all 0.15s ease'
              }}>
                <div style={{ color: 'var(--ink-muted)', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', marginBottom: '4px' }}>BLINKS</div>
                <div style={{ fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--signal-good)' }}>{blinkCount}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginLeft: '4px' }}>total</span>
                  {blinkDetected && (
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--signal-good)', marginTop: '3px', letterSpacing: '0.04em' }}>● BLINK DETECTED</div>
                  )}
                </div>
              </div>
            </div>

            {/* ── EAR row: Left | Right | Avg ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.65rem' }}>
              {[
                { label: 'LEFT EAR',  value: leftEAR },
                { label: 'RIGHT EAR', value: rightEAR },
                { label: 'AVG EAR',   value: averageEAR, highlight: true },
              ].map(({ label, value, highlight }) => (
                <div key={label} style={{
                  background: 'var(--ink-bg)',
                  padding: '0.45rem 0.6rem',
                  borderRadius: '2px',
                  border: '1px solid var(--ink-border)',
                  fontFamily: 'var(--font-mono)'
                }}>
                  <div style={{ color: 'var(--ink-muted)', fontSize: '0.62rem', marginBottom: '2px' }}>{label}</div>
                  <div style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: highlight
                      ? eyesClosed ? 'var(--signal-alert)' : 'var(--signal-good)'
                      : 'var(--ink-text)'
                  }}>
                    {value.toFixed(3)}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Status row: Eye State | Status | Low Blink ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.65rem' }}>
              <div style={{ background: 'var(--ink-bg)', padding: '0.45rem 0.6rem', borderRadius: '2px', border: '1px solid var(--ink-border)', fontFamily: 'var(--font-mono)' }}>
                <div style={{ color: 'var(--ink-muted)', fontSize: '0.62rem', marginBottom: '2px' }}>EYE STATE</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: eyesClosed ? 'var(--signal-alert)' : 'var(--signal-good)' }}>
                  {eyeState}
                </div>
              </div>
              <div style={{ background: 'var(--ink-bg)', padding: '0.45rem 0.6rem', borderRadius: '2px', border: '1px solid var(--ink-border)', fontFamily: 'var(--font-mono)' }}>
                <div style={{ color: 'var(--ink-muted)', fontSize: '0.62rem', marginBottom: '2px' }}>STATUS</div>
                <div style={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: blinkRateStatus === 'active' ? 'var(--signal-good)' : 'var(--ink-muted)'
                }}>
                  {blinkRateStatus.toUpperCase()}
                </div>
              </div>
              <div style={{
                background: lowBlinkRate ? 'rgba(255,107,74,0.08)' : 'var(--ink-bg)',
                padding: '0.45rem 0.6rem',
                borderRadius: '2px',
                border: `1px solid ${lowBlinkRate ? 'var(--signal-alert)' : 'var(--ink-border)'}`,
                fontFamily: 'var(--font-mono)'
              }}>
                <div style={{ color: 'var(--ink-muted)', fontSize: '0.62rem', marginBottom: '2px' }}>LOW BLINK RATE</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: lowBlinkRate ? 'var(--signal-alert)' : 'var(--signal-good)' }}>
                  {lowBlinkRate ? 'LOW' : 'NORMAL'}
                </div>
              </div>
            </div>

            {/* ── Dev detail row: SM state | window count | last blink ── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '0.5rem',
              padding: '0.5rem 0.65rem',
              background: 'var(--ink-bg)',
              border: '1px solid var(--ink-border)',
              borderRadius: '2px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              color: 'var(--ink-muted)'
            }}>
              <div>
                <span>SM STATE</span><br />
                <span style={{ color: 'var(--ink-text)' }}>{stateMachineState}</span>
              </div>
              <div>
                <span>WINDOW</span><br />
                <span style={{ color: 'var(--ink-text)' }}>{blinkTimestamps.length} in 60s</span>
              </div>
              <div>
                <span>LAST BLINK</span><br />
                <span style={{ color: 'var(--ink-text)' }}>
                  {lastBlinkTimestampMs !== null
                    ? `${((performance.now() - lastBlinkTimestampMs) / 1000).toFixed(1)}s ago`
                    : '—'}
                </span>
              </div>
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

            {/* Debouncer / Auto-broadcast Status */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '0.5rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '2px',
              background: 'var(--ink-bg)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
              border: '1px solid var(--ink-border)'
            }}>
              <div>
                <span style={{ color: 'var(--ink-muted)' }}>SMOOTHED SCORE // </span>
                <span style={{
                  color: smoothedScore >= 0.30 ? 'var(--signal-alert)' : smoothedScore >= 0.15 ? 'var(--ink-text)' : 'var(--signal-good)'
                }}>
                  {smoothedScore.toFixed(3)}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--ink-muted)' }}>DEBOUNCE // </span>
                <span style={{
                  color:
                    debouncerState === 'triggered' ? 'var(--signal-alert)' :
                    debouncerState === 'accumulating' ? 'var(--ink-text)' :
                    debouncerState === 'recovering' ? 'var(--ink-muted)' :
                    'var(--signal-good)'
                }}>
                  {debouncerState.toUpperCase()}
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

      {/* Privacy Notice Modal Gate */}
      <PrivacyNotice
        isOpen={showPrivacyNotice}
        onContinue={handlePrivacyContinue}
        onNotNow={handlePrivacyNotNow}
      />
    </div>
  );
};
