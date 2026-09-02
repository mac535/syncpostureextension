import React, { useEffect, useState } from 'react';
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

export const Demo: React.FC = () => {
  const [isInterventionActive, setIsInterventionActive] = useState<boolean>(false);
  const [activeAlertDetail, setActiveAlertDetail] = useState<string | null>(null);

  useEffect(() => {
    // Notify any open dashboard that this demo tab is active
    send({ type: 'DEMO_READY' });

    // Listen on BroadcastChannel for intervention commands
    const unsubscribe = onMessage((msg: SyncMessage) => {
      if (msg.type === 'POSTURE_STATUS') {
        if (msg.severity >= 2) {
          setIsInterventionActive(true);
          setActiveAlertDetail(`Posture Alert: ${msg.status.toUpperCase()} (Severity ${msg.severity}) detected`);
        } else {
          setIsInterventionActive(false);
          setActiveAlertDetail(null);
        }
      } else if (msg.type === 'CLEAR_INTERVENTION') {
        setIsInterventionActive(false);
        setActiveAlertDetail(null);
      } else if (msg.type === 'BLINK_ALERT') {
        setIsInterventionActive(true);
        setActiveAlertDetail(`Blink Alert: Low blink rate (${msg.blinksPerMin}/min). Rest your eyes.`);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="qp-page">
      {/* Visual Intervention Overlay when Bad Posture is Triggered */}
      {isInterventionActive && (
        <div className="intervention-overlay">
          <div style={{
            backgroundColor: 'var(--qp-cream-light)',
            border: '1px solid rgba(233, 111, 103, 0.4)',
            padding: 'var(--space-32) var(--space-48)',
            borderRadius: '16px',
            boxShadow: '0 24px 48px rgba(23, 59, 53, 0.2), 0 0 40px rgba(233, 111, 103, 0.25)',
            textAlign: 'center',
            maxWidth: '520px',
            pointerEvents: 'auto',
            color: 'var(--qp-forest)'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(233, 111, 103, 0.15)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--qp-coral)',
              marginBottom: 'var(--space-16)'
            }}>
              <AlertCircle size={32} strokeWidth={2} />
            </div>
            <h2 className="qp-heading-3" style={{ marginBottom: 'var(--space-8)' }}>
              Posture Notice
            </h2>
            <p style={{ color: 'var(--qp-coral)', fontWeight: 600, fontSize: '0.95rem', marginBottom: 'var(--space-12)' }}>
              {activeAlertDetail}
            </p>
            <p className="qp-body-sm" style={{ color: 'var(--qp-forest-muted)' }}>
              Gently align your spine, drop your shoulders, and look straight ahead. Clear the alert on your dashboard tab to resume reading.
            </p>
          </div>
        </div>
      )}

      {/* Main Content Area (blurs when intervention is triggered) */}
      <div className={`demo-content-wrapper ${isInterventionActive ? 'blurred' : ''}`}>
        {/* Navigation Header */}
        <Header />

        {/* Hero Section */}
        <Hero />

        {/* Philosophy & Core Features Section */}
        <Features />

        {/* Places / Discovery Section */}
        <Discovery />

        {/* Journal / Editorial Section */}
        <Journal />

        {/* Closing Calm CTA Section */}
        <FinalCTA />

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
};
