import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Video, LayoutDashboard, Radio, Cpu, Sparkles } from 'lucide-react';

export const Home: React.FC = () => {
  return (
    <div style={{ maxWidth: '1000px', margin: '3rem auto', padding: '0 1.5rem' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.4rem 1rem',
          borderRadius: '9999px',
          background: 'rgba(99, 102, 241, 0.15)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          color: '#818cf8',
          fontSize: '0.85rem',
          fontWeight: 600,
          marginBottom: '1.25rem'
        }}>
          <Sparkles size={16} /> Privacy-First On-Device Ergonomics
        </div>
        
        <h1 style={{
          fontSize: '3rem',
          fontWeight: 800,
          lineHeight: 1.2,
          marginBottom: '1rem',
          background: 'linear-gradient(135deg, #ffffff 40%, #9ca3af 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          syncPosture Architecture
        </h1>
        
        <p style={{
          fontSize: '1.15rem',
          color: '#9ca3af',
          maxWidth: '650px',
          margin: '0 auto',
          lineHeight: 1.6
        }}>
          A zero-server, cross-tab posture & blink rate monitor. Open the Dashboard in one tab and your work in another — your screen softly blurs when your posture slips.
        </p>
      </div>

      {/* Two Tab Workflow Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem',
        marginBottom: '3rem'
      }}>
        {/* Tab A Card */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#60a5fa',
              marginBottom: '1.25rem'
            }}>
              <Video size={24} />
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.5rem' }}>Tab 1: Dashboard</h2>
            <p style={{ color: '#9ca3af', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Hosts the live webcam feed, runs on-device vision models, and emits posture events via the <code style={{ color: '#60a5fa' }}>BroadcastChannel</code> API.
            </p>
          </div>
          <Link to="/dashboard" className="btn btn-primary" style={{ width: '100%' }}>
            <Video size={18} /> Open Posture Dashboard
          </Link>
        </div>

        {/* Tab B Card */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34d399',
              marginBottom: '1.25rem'
            }}>
              <LayoutDashboard size={24} />
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.5rem' }}>Tab 2: Demo Workspace</h2>
            <p style={{ color: '#9ca3af', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Simulates a productive browser tab. Listens for alerts and applies dynamic blur/vignette visual feedback to enforce healthy posture.
            </p>
          </div>
          <Link to="/demo" className="btn btn-secondary" style={{ width: '100%' }}>
            <LayoutDashboard size={18} /> Open Demo Workspace
          </Link>
        </div>
      </div>

      {/* Privacy Highlights */}
      <div className="glass-panel" style={{ padding: '1.5rem 2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ShieldCheck color="#10b981" size={24} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>100% Client-Side</div>
            <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Zero video frames leave your machine</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Radio color="#6366f1" size={24} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>BroadcastChannel API</div>
            <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Seamless cross-tab sync without WebSockets</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Cpu color="#f59e0b" size={24} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>No Extensions Needed</div>
            <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Runs anywhere with standard web tech</div>
          </div>
        </div>
      </div>
    </div>
  );
};
