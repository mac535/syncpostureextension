import React, { useEffect, useRef, useState } from 'react';
import { send, onMessage } from '../lib/channel';
import type { SyncMessage } from '../types/messages';
import { Header } from '../components/Header';
import { Hero } from '../components/Hero';
import { Features } from '../components/Features';
import { Discovery } from '../components/Discovery';
import { Journal } from '../components/Journal';
import { FinalCTA } from '../components/FinalCTA';
import { Footer } from '../components/Footer';
import { AlertCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Intensity -> filter mapping
// blurPx   : 0 at 0.0, up to 36px at 1.0 (past 32 so text is solidly illegible near top)
// brightness: 1.0 -> 0.5 (halved at max)
// saturate  : 1.0 -> 0.55 (nearly greyscale at max)
// ---------------------------------------------------------------------------
function intensityToFilter(intensity: number): string {
  const i = Math.max(0, Math.min(1, intensity));
  const blurPx      = i * 36;
  const brightness  = 1 - i * 0.5;
  const saturate    = 1 - i * 0.45;
  return `blur(${blurPx.toFixed(2)}px) brightness(${brightness.toFixed(3)}) saturate(${saturate.toFixed(3)})`;
}

// How fast intensity decays toward 0 per animation frame (~60fps) on recovery
const DECAY_RATE = 0.012; // roughly 1.2 pp per frame -> ~0 in ~80 frames (~1.3 s)

export const Demo: React.FC = () => {
  // The live "target" intensity set by incoming messages
  const [intensity, setIntensity] = useState<number>(0);
  // The rendered (possibly mid-decay) intensity value
  const renderedIntensityRef = useRef<number>(0);
  const [displayIntensity, setDisplayIntensity] = useState<number>(0);

  // Alert detail text (null when fully clear)
  const [alertDetail, setAlertDetail] = useState<string | null>(null);

  // rAF handle for the recovery decay loop
  const decayRafRef = useRef<number | null>(null);

  // ---------------------------------------------------------------------------
  // Recovery decay animation
  // When intensity target drops to 0 (CLEAR_INTERVENTION received), we don't
  // snap to 0 -- we run an rAF loop that steps renderedIntensity toward 0.
  // ---------------------------------------------------------------------------
  const startDecay = () => {
    if (decayRafRef.current !== null) return; // already running
    const step = () => {
      const current = renderedIntensityRef.current;
      const next = Math.max(0, current - DECAY_RATE);
      renderedIntensityRef.current = next;
      setDisplayIntensity(next);
      if (next > 0.001) {
        decayRafRef.current = requestAnimationFrame(step);
      } else {
        decayRafRef.current = null;
        setAlertDetail(null); // hide alert card once fully recovered
      }
    };
    decayRafRef.current = requestAnimationFrame(step);
  };

  const stopDecay = () => {
    if (decayRafRef.current !== null) {
      cancelAnimationFrame(decayRafRef.current);
      decayRafRef.current = null;
    }
  };

  // When a new intensity target arrives:
  //   - If > 0: snap renderedIntensityRef up immediately (CSS transition animates)
  //   - If = 0: leave renderedIntensityRef at its current value and start the
  //             decay loop, which will step it down to 0 over ~1.3 s
  useEffect(() => {
    stopDecay(); // cancel any in-progress decay before deciding what to do

    if (intensity > 0) {
      // New non-zero intensity: update immediately so CSS transition takes over
      renderedIntensityRef.current = intensity;
      setDisplayIntensity(intensity);
    } else {
      // Intensity cleared to 0: decay from wherever we currently are
      startDecay();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intensity]);

  // Clean up on unmount
  useEffect(() => {
    return () => stopDecay();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // BroadcastChannel listener
  // ---------------------------------------------------------------------------
  useEffect(() => {
    send({ type: 'DEMO_READY' });

    const unsubscribe = onMessage((msg: SyncMessage) => {
      if (msg.type === 'POSTURE_STATUS') {
        // Always use the continuous intensity value from the broadcaster
        const incoming = typeof msg.intensity === 'number' ? msg.intensity : 0;
        setIntensity(incoming);
        setAlertDetail(`${msg.status.toUpperCase()} detected`);
      } else if (msg.type === 'CLEAR_INTERVENTION') {
        // Trigger the decay animation; alert text cleared once intensity reaches 0
        setIntensity(0);
      } else if (msg.type === 'BLINK_ALERT') {
        setIntensity(0.5); // moderate intervention for blink alerts
        setAlertDetail(`Low blink rate (${msg.blinksPerMin}/min). Rest your eyes.`);
      }
    });

    return () => { unsubscribe(); };
  }, []);

  // ---------------------------------------------------------------------------
  // Derived visual values from displayIntensity (the animated/decaying value)
  // ---------------------------------------------------------------------------
  const i = displayIntensity;
  const isActive = i > 0.01;
  const vignetteOpacity = i * 0.7; // 0 -> invisible, 1.0 -> 0.7 opacity

  const contentStyle: React.CSSProperties = {
    filter: intensityToFilter(i),
    pointerEvents: isActive ? 'none' : 'auto',
    userSelect: isActive ? 'none' : 'auto',
  };

  return (
    <div className="qp-page">
      {/* Vignette overlay — always mounted, opacity driven by intensity */}
      <div
        className="intervention-overlay"
        style={{ opacity: vignetteOpacity, pointerEvents: 'none' }}
        aria-hidden="true"
      />

      {/* Posture Notice card — outside .demo-content-wrapper so it's never blurred */}
      {isActive && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 60,
            backgroundColor: 'var(--qp-cream-light)',
            border: '1px solid rgba(233, 111, 103, 0.4)',
            padding: 'var(--space-32) var(--space-48)',
            borderRadius: '16px',
            boxShadow: '0 24px 48px rgba(23, 59, 53, 0.2), 0 0 40px rgba(233, 111, 103, 0.25)',
            textAlign: 'center',
            maxWidth: '520px',
            pointerEvents: 'auto',
            color: 'var(--qp-forest)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(233, 111, 103, 0.15)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--qp-coral)',
              marginBottom: 'var(--space-16)',
            }}
          >
            <AlertCircle size={32} strokeWidth={2} />
          </div>
          <h2 className="qp-heading-3" style={{ marginBottom: 'var(--space-8)' }}>
            Posture Notice
          </h2>
          {alertDetail && (
            <p style={{ color: 'var(--qp-coral)', fontWeight: 600, fontSize: '0.95rem', marginBottom: 'var(--space-12)' }}>
              {alertDetail}
            </p>
          )}
          <p className="qp-body-sm" style={{ color: 'var(--qp-forest-muted)' }}>
            Sustained posture deviation detected. This will clear gradually as your posture improves — no action needed here.
          </p>
        </div>
      )}

      {/* Main Content Area — filter applied inline, animated by CSS transition */}
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


