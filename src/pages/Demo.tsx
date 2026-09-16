import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { send, onMessage } from '../lib/channel';
import type { SyncMessage } from '../types/messages';
import { Header } from '../components/Header';
import { Hero } from '../components/Hero';
import { Features } from '../components/Features';
import { Discovery } from '../components/Discovery';
import { Journal } from '../components/Journal';
import { FinalCTA } from '../components/FinalCTA';
import { Footer } from '../components/Footer';
import { ShieldAlert } from 'lucide-react';

// ---------------------------------------------------------------------------
// Nonlinear progressive visual degradation mapping:
// Base curve:
// 0.0 - 0.25 (Low)     : 0 -> 10px blur, 1.0 -> 0.88 brightness, 1.0 -> 0.85 sat
// 0.25 - 0.50 (Medium) : 10 -> 28px blur, 0.88 -> 0.70 brightness, 0.85 -> 0.60 sat
// 0.50 - 0.75 (High)   : 28 -> 48px blur, 0.70 -> 0.48 brightness, 0.60 -> 0.35 sat
// 0.75 - 1.0 (Critical): 48 -> 72px blur, 0.48 -> 0.30 brightness, 0.35 -> 0.20 sat
// ---------------------------------------------------------------------------
function calculateVisualParameters(effectiveIntensity: number) {
  const i = Math.max(0, Math.min(1, effectiveIntensity));

  let blurPx = 0;
  let brightness = 1.0;
  let saturate = 1.0;

  if (i <= 0.01) {
    blurPx = 0;
    brightness = 1.0;
    saturate = 1.0;
  } else if (i <= 0.25) {
    const t = i / 0.25;
    blurPx = t * 10;
    brightness = 1.0 - t * 0.12;
    saturate = 1.0 - t * 0.15;
  } else if (i <= 0.5) {
    const t = (i - 0.25) / 0.25;
    blurPx = 10 + t * 18;
    brightness = 0.88 - t * 0.18;
    saturate = 0.85 - t * 0.25;
  } else if (i <= 0.75) {
    const t = (i - 0.5) / 0.25;
    blurPx = 28 + t * 20;
    brightness = 0.70 - t * 0.22;
    saturate = 0.60 - t * 0.25;
  } else {
    const t = (i - 0.75) / 0.25;
    blurPx = 48 + t * 24;
    brightness = 0.48 - t * 0.18;
    saturate = 0.35 - t * 0.15;
  }

  const vignette = i * 0.75;
  const filter = `blur(${blurPx.toFixed(1)}px) brightness(${brightness.toFixed(3)}) saturate(${saturate.toFixed(3)})`;

  return { blurPx, brightness, saturate, vignette, filter };
}

// Recovery step per frame: ~60fps -> decays 1.0 to 0.0 in ~1.4 seconds
const DECAY_RATE_PER_FRAME = 0.012;

export const Demo: React.FC = () => {
  // Check if posture setup has been completed in Dashboard
  const [isSetupComplete, setIsSetupComplete] = useState<boolean>(() => {
    return localStorage.getItem('postureInstructionsSeen') === 'true';
  });

  // Re-verify setup completion on focus or storage change
  useEffect(() => {
    const checkSetup = () => {
      setIsSetupComplete(localStorage.getItem('postureInstructionsSeen') === 'true');
    };
    window.addEventListener('focus', checkSetup);
    window.addEventListener('storage', checkSetup);
    return () => {
      window.removeEventListener('focus', checkSetup);
      window.removeEventListener('storage', checkSetup);
    };
  }, []);

  // Raw posture intensity and status from telemetry
  const [baseIntensity, setBaseIntensity] = useState<number>(0);
  const [isInterventionTriggered, setIsInterventionTriggered] = useState<boolean>(false);
  const [isInsufficientData, setIsInsufficientData] = useState<boolean>(false);

  // Time escalation tracking: timestamp when sustained deviation was triggered
  const triggeredStartTimestampRef = useRef<number | null>(null);

  // Effective rendered intensity (incorporating base telemetry + time escalation or recovery decay)
  const renderedIntensityRef = useRef<number>(0);
  const [displayIntensity, setDisplayIntensity] = useState<number>(0);

  // rAF loop handle
  const animationFrameRef = useRef<number | null>(null);

  // ---------------------------------------------------------------------------
  // Progressive Animation & Decay Engine
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    const updateInterventionFrame = () => {
      if (!isMounted) return;

      const now = performance.now();

      if (isInterventionTriggered && !isInsufficientData) {
        // Compute time escalation:
        // 0-2s: 0.0 bonus
        // 2-5s: up to +0.15 bonus
        // 5-8s: up to +0.30 bonus
        // 8-12s: up to +0.45 bonus
        // 12s+: up to +0.65 bonus
        if (triggeredStartTimestampRef.current === null) {
          triggeredStartTimestampRef.current = now;
        }

        const elapsedSec = (now - triggeredStartTimestampRef.current) / 1000;
        let timeEscalationBonus = 0;
        if (elapsedSec > 2) {
          timeEscalationBonus = Math.min(0.65, (elapsedSec - 2) * 0.065);
        }

        const targetEffective = Math.min(1.0, baseIntensity + timeEscalationBonus);

        // Smoothly approach target if higher
        const current = renderedIntensityRef.current;
        const next = current < targetEffective
          ? Math.min(targetEffective, current + 0.02)
          : Math.max(targetEffective, current - 0.015);

        renderedIntensityRef.current = next;
        setDisplayIntensity(next);
      } else {
        // Recovery / Good Posture / Insufficient Data: Reset time escalation timestamp and decay toward 0.0
        triggeredStartTimestampRef.current = null;

        const current = renderedIntensityRef.current;
        if (current > 0.001) {
          const next = Math.max(0, current - DECAY_RATE_PER_FRAME);
          renderedIntensityRef.current = next;
          setDisplayIntensity(next);
        } else if (current !== 0) {
          renderedIntensityRef.current = 0;
          setDisplayIntensity(0);
        }
      }

      animationFrameRef.current = requestAnimationFrame(updateInterventionFrame);
    };

    animationFrameRef.current = requestAnimationFrame(updateInterventionFrame);

    return () => {
      isMounted = false;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isInterventionTriggered, baseIntensity, isInsufficientData]);

  // ---------------------------------------------------------------------------
  // BroadcastChannel listener & Demo Heartbeat
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Broadcast readiness immediately and periodically so Dashboard connection indicator stays live
    send({ type: 'DEMO_READY' });
    const readyHeartbeat = setInterval(() => {
      send({ type: 'DEMO_READY' });
    }, 10000);

    const unsubscribe = onMessage((msg: SyncMessage) => {
      if (msg.type === 'SETUP_COMPLETE') {
        setIsSetupComplete(true);
      } else if (msg.type === 'POSTURE_TELEMETRY') {
        if (msg.status === 'insufficient_data') {
          setIsInsufficientData(true);
          setIsInterventionTriggered(false);
          setBaseIntensity(0);
        } else {
          setIsInsufficientData(false);

          if (msg.status === 'good' || msg.debouncerState === 'idle') {
            setIsInterventionTriggered(false);
            setBaseIntensity(0);
          } else if (msg.debouncerState === 'triggered') {
            setIsInterventionTriggered(true);
            const incoming = Math.max(0.2, Math.min(1.0, msg.intensity));
            setBaseIntensity(incoming);
          } else if (msg.debouncerState === 'recovering') {
            setIsInterventionTriggered(false);
            setBaseIntensity(Math.max(0, Math.min(1.0, msg.intensity)));
          }
        }
      } else if (msg.type === 'POSTURE_STATUS') {
        // Direct trigger compatibility
        setIsInsufficientData(false);
        setIsInterventionTriggered(true);
        const incoming = typeof msg.intensity === 'number' ? Math.max(0.25, Math.min(1.0, msg.intensity)) : 0.4;
        setBaseIntensity(incoming);
      } else if (msg.type === 'CLEAR_INTERVENTION') {
        setIsInterventionTriggered(false);
        setBaseIntensity(0);
      } else if (msg.type === 'BLINK_ALERT') {
        setIsInsufficientData(false);
        setIsInterventionTriggered(true);
        setBaseIntensity(0.4);
      }
    });

    return () => {
      clearInterval(readyHeartbeat);
      unsubscribe();
    };
  }, []);

  const visualParams = calculateVisualParameters(displayIntensity);

  // prefers-reduced-motion: skip blur filter, use opacity degradation only
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Content filter: apply blur only when not reduced-motion
  const contentFilter = prefersReducedMotion
    ? `opacity(${Math.max(0.3, 1 - displayIntensity * 0.7).toFixed(3)})`
    : visualParams.filter;

  // Scrolling is explicitly PRESERVED: pointer-events remain enabled, filter is visual only
  const contentStyle: React.CSSProperties = {
    filter: contentFilter,
    transition: prefersReducedMotion ? 'opacity 0.4s ease-out' : 'filter 0.9s cubic-bezier(0.16, 1, 0.3, 1)',
    position: 'relative',
    minHeight: '100vh',
    width: '100%',
    overflowX: 'hidden'
  };

  // If setup has not been completed in Dashboard, display the gate screen
  if (!isSetupComplete) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--ink-bg)',
          color: 'var(--ink-text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          fontFamily: 'var(--font-display)'
        }}
      >
        <div
          style={{
            maxWidth: '520px',
            width: '100%',
            backgroundColor: 'var(--ink-panel)',
            border: '1px solid var(--ink-border)',
            borderRadius: '4px',
            padding: '2.25rem 2rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          <div
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 107, 74, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--signal-alert)',
              marginBottom: '1.25rem'
            }}
          >
            <ShieldAlert size={26} />
          </div>

          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              letterSpacing: '0.08em',
              color: 'var(--signal-alert)',
              marginBottom: '0.5rem',
              fontWeight: 600
            }}
          >
            POSTURE SETUP REQUIRED
          </div>

          <h1
            style={{
              fontSize: '1.35rem',
              fontWeight: 600,
              lineHeight: 1.35,
              color: 'var(--ink-text)',
              margin: '0 0 1rem'
            }}
          >
            Guided posture setup must be completed first.
          </h1>

          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.9rem',
              lineHeight: 1.6,
              color: 'var(--ink-muted)',
              margin: '0 0 2rem'
            }}
          >
            Complete the guided posture setup in Dashboard before starting the intervention demo.
          </p>

          <Link
            to="/dashboard"
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '0.75rem 1.25rem',
              fontFamily: 'var(--font-display)',
              fontSize: '0.9rem'
            }}
          >
            Open Posture Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="qp-page" style={{ position: 'relative' }}>
      {/* Subtle vignette overlay — visual only, no text, pointer-events none */}
      <div
        className="intervention-overlay"
        style={{ opacity: visualParams.vignette, pointerEvents: 'none' }}
        aria-hidden="true"
      />

      {/* Main Content Area — scrolling remains 100% active, filter applies visually */}
      <div className="demo-content-wrapper" style={contentStyle}>
        <Header />
        <Hero />
        <Features />
        <Discovery />
        <Journal />
        <FinalCTA />
        <Footer />
      </div>
    </div>
  );
};


