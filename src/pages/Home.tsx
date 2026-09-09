import React from 'react';
import { Link } from 'react-router-dom';

export const Home: React.FC = () => {
  return (
    <div style={{ maxWidth: '1080px', margin: '2rem auto 4rem', padding: '0 1.5rem', fontFamily: 'var(--font-display)' }}>
      {/* 1. HERO: Technical Overview & Posture Assessment Diagram */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '2.5rem',
        alignItems: 'center',
        marginBottom: '4rem',
        borderBottom: '1px solid var(--ink-border)',
        paddingBottom: '3.5rem'
      }}>
        {/* Left Side: Copy & Route Actions */}
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            letterSpacing: '0.1em',
            color: 'var(--ink-muted)',
            marginBottom: '0.75rem'
          }}>
            ON-DEVICE ERGONOMIC MONITORING
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2.35rem',
            fontWeight: 600,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            color: 'var(--ink-text)',
            margin: '0 0 1rem'
          }}>
            Real-time postural angle analysis on your machine.
          </h1>

          <p style={{
            color: 'var(--ink-muted)',
            fontSize: '1rem',
            lineHeight: 1.6,
            margin: '0 0 2rem',
            maxWidth: '520px'
          }}>
            A zero-server ergonomics loop running on your hardware: Tab 1 runs continuous vision inference, emitting low-latency posture events over BroadcastChannel to Tab 2.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem' }}>
            <Link to="/dashboard" className="btn btn-primary">
              Open Posture Dashboard
            </Link>
            <Link to="/demo" className="btn btn-secondary">
              Open Demo Workspace
            </Link>
          </div>
        </div>

        {/* Right Side: Static SVG Technical Assessment Diagram */}
        <div style={{
          backgroundColor: 'var(--ink-panel)',
          border: '1px solid var(--ink-border)',
          borderRadius: '4px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div className="panel-header" style={{ marginBottom: '1rem' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', color: 'var(--ink-text)' }}>
              ANGULAR DEFLECTION SCHEMA
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
              REF: ISO 9241-5
            </span>
          </div>

          <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <svg
              viewBox="0 0 460 260"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ width: '100%', height: 'auto', display: 'block' }}
            >
              <defs>
                {/* Dash pattern for vertical reference plumb lines */}
                <marker
                  id="arc-arrow"
                  markerWidth="6"
                  markerHeight="6"
                  refX="5"
                  refY="3"
                  orient="auto"
                >
                  <path d="M1 1L5 3L1 5" fill="none" stroke="var(--signal-alert)" strokeWidth="1" />
                </marker>
              </defs>

              {/* ---------------- LEFT FIGURE (Upright, Good Posture) ---------------- */}
              <g id="figure-upright">
                {/* Status Label Above */}
                <text
                  x="115"
                  y="28"
                  textAnchor="middle"
                  fill="var(--signal-good)"
                  fontFamily="var(--font-mono)"
                  fontSize="11"
                  fontWeight="600"
                  letterSpacing="0.08em"
                >
                  [ GOOD ]
                </text>

                {/* Vertical Plumb Line (dashed) running through ear & shoulder */}
                <line
                  x1="115"
                  y1="52"
                  x2="115"
                  y2="208"
                  stroke="var(--signal-good)"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  opacity="0.85"
                />

                {/* Chair Seat & Backrest Reference (hairline) */}
                <path
                  d="M 50 160 L 50 205 L 145 205"
                  stroke="var(--ink-border)"
                  strokeWidth="1"
                  fill="none"
                />

                {/* Seated Figure Skeleton (Upright) */}
                {/* Head (Profile Circle) */}
                <circle
                  cx="115"
                  cy="70"
                  r="16"
                  stroke="var(--ink-text)"
                  strokeWidth="1.75"
                  fill="none"
                />
                {/* Ear Point (Joint Dot) */}
                <circle cx="115" cy="73" r="2.5" fill="var(--signal-good)" />

                {/* Neck & Spine Path */}
                <path
                  d="M 115 86 L 115 110 L 105 168 L 105 202 L 148 202"
                  stroke="var(--ink-text)"
                  strokeWidth="1.75"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Shoulder & Arm (Relaxed) */}
                <circle cx="115" cy="110" r="2.5" fill="var(--signal-good)" />
                <path
                  d="M 115 110 L 126 150 L 146 150"
                  stroke="var(--ink-text)"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="126" cy="150" r="2" fill="var(--ink-muted)" />

                {/* Hip Joint Dot */}
                <circle cx="105" cy="202" r="2.5" fill="var(--ink-muted)" />

                {/* Angle Metric Below */}
                <text
                  x="115"
                  y="235"
                  textAnchor="middle"
                  fill="var(--signal-good)"
                  fontFamily="var(--font-mono)"
                  fontSize="13"
                  fontWeight="600"
                >
                  0°
                </text>
                <text
                  x="115"
                  y="248"
                  textAnchor="middle"
                  fill="var(--ink-muted)"
                  fontFamily="var(--font-mono)"
                  fontSize="9.5"
                  letterSpacing="0.04em"
                >
                  DEVIATION
                </text>
              </g>

              {/* Dividing Hairline Rule */}
              <line
                x1="230"
                y1="35"
                x2="230"
                y2="235"
                stroke="var(--ink-border)"
                strokeWidth="1"
                strokeDasharray="2 4"
              />

              {/* ---------------- RIGHT FIGURE (Forward Lean, Slouching) ---------------- */}
              <g id="figure-slouching">
                {/* Status Label Above */}
                <text
                  x="345"
                  y="28"
                  textAnchor="middle"
                  fill="var(--signal-alert)"
                  fontFamily="var(--font-mono)"
                  fontSize="11"
                  fontWeight="600"
                  letterSpacing="0.08em"
                >
                  [ SLOUCHING · SEV 2 ]
                </text>

                {/* Chair Seat & Backrest Reference (hairline) */}
                <path
                  d="M 280 160 L 280 205 L 375 205"
                  stroke="var(--ink-border)"
                  strokeWidth="1"
                  fill="none"
                />

                {/* Vertical Reference Plumb Line at Shoulder (dashed) */}
                <line
                  x1="340"
                  y1="52"
                  x2="340"
                  y2="208"
                  stroke="var(--ink-border)"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />

                {/* Deflection Ray (dashed) following actual ear position to shoulder */}
                <line
                  x1="375"
                  y1="68"
                  x2="340"
                  y2="120"
                  stroke="var(--signal-alert)"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />

                {/* Deflection Arc between Vertical and Deflection Ray */}
                <path
                  d="M 340 76 A 44 44 0 0 1 364 84"
                  stroke="var(--signal-alert)"
                  strokeWidth="1.2"
                  fill="none"
                  markerEnd="url(#arc-arrow)"
                />

                {/* Angular Degree Label at Arc */}
                <text
                  x="376"
                  y="92"
                  fill="var(--signal-alert)"
                  fontFamily="var(--font-mono)"
                  fontSize="11.5"
                  fontWeight="600"
                >
                  34°
                </text>

                {/* Seated Figure Skeleton (Slouching / Forward Head) */}
                {/* Head (Profile Circle - shifted forward and downward) */}
                <circle
                  cx="375"
                  cy="68"
                  r="16"
                  stroke="var(--ink-text)"
                  strokeWidth="1.75"
                  fill="none"
                />
                {/* Ear Point (Joint Dot) */}
                <circle cx="375" cy="71" r="2.5" fill="var(--signal-alert)" />

                {/* Neck & Kyphotic Spine Path */}
                <path
                  d="M 368 83 Q 346 102 340 120 Q 320 156 332 202 L 375 202"
                  stroke="var(--ink-text)"
                  strokeWidth="1.75"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Shoulder Joint Dot (protracted forward) */}
                <circle cx="340" cy="120" r="2.5" fill="var(--signal-alert)" />

                {/* Reaching Arm */}
                <path
                  d="M 340 120 L 362 160 L 388 160"
                  stroke="var(--ink-text)"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="362" cy="160" r="2" fill="var(--ink-muted)" />

                {/* Hip Joint Dot */}
                <circle cx="332" cy="202" r="2.5" fill="var(--ink-muted)" />

                {/* Angle Metric Below */}
                <text
                  x="345"
                  y="235"
                  textAnchor="middle"
                  fill="var(--signal-alert)"
                  fontFamily="var(--font-mono)"
                  fontSize="13"
                  fontWeight="600"
                >
                  +34°
                </text>
                <text
                  x="345"
                  y="248"
                  textAnchor="middle"
                  fill="var(--ink-muted)"
                  fontFamily="var(--font-mono)"
                  fontSize="9.5"
                  letterSpacing="0.04em"
                >
                  DEFLECTION
                </text>
              </g>
            </svg>
          </div>
        </div>
      </section>

      {/* 2. ARCHITECTURE HEADER */}
      <section style={{ marginBottom: '2rem' }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          letterSpacing: '0.1em',
          color: 'var(--ink-muted)',
          marginBottom: '0.5rem'
        }}>
          TWO TABS, ONE CHANNEL
        </div>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.45rem',
          fontWeight: 600,
          lineHeight: 1.35,
          color: 'var(--ink-text)',
          margin: 0,
          maxWidth: '720px'
        }}>
          A zero-server ergonomics loop running on your hardware: Tab 1 runs continuous vision inference, emitting low-latency posture events over BroadcastChannel to Tab 2.
        </h2>
      </section>

      {/* 3. SVG TECHNICAL ARCHITECTURE DIAGRAM */}
      <section style={{
        marginBottom: '3rem',
        border: '1px solid var(--ink-border)',
        backgroundColor: 'var(--ink-panel)',
        borderRadius: '4px',
        padding: '1.75rem 1.25rem'
      }}>
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <svg
            viewBox="0 0 800 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: '100%', minWidth: '640px', height: 'auto', display: 'block' }}
          >
            <defs>
              <marker
                id="diagram-arrow"
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="4"
                orient="auto"
              >
                <path d="M1 1L7 4L1 7" fill="none" stroke="#8CA6BC" strokeWidth="1.2" />
              </marker>
            </defs>

            {/* Dashboard Tab Node */}
            <rect
              x="20"
              y="20"
              width="230"
              height="80"
              rx="2"
              fill="#0F2138"
              stroke="#2C4A66"
              strokeWidth="1"
            />
            <text x="35" y="44" fill="#8CA6BC" fontSize="11" fontFamily="var(--font-mono)" letterSpacing="0.05em">
              TAB 01 : DASHBOARD
            </text>
            <text x="35" y="66" fill="#E7EEF3" fontSize="13" fontFamily="var(--font-display)" fontWeight="600">
              Webcam Feed + MediaPipe
            </text>
            <text x="35" y="84" fill="#8CA6BC" fontSize="11" fontFamily="var(--font-mono)">
              Angles & Landmark Engine
            </text>

            {/* Interconnecting Arrow Line */}
            <line
              x1="250"
              y1="60"
              x2="540"
              y2="60"
              stroke="#2C4A66"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <line
              x1="340"
              y1="60"
              x2="450"
              y2="60"
              stroke="#8CA6BC"
              strokeWidth="1"
              markerEnd="url(#diagram-arrow)"
            />

            {/* Channel Protocol Label */}
            <rect
              x="320"
              y="32"
              width="150"
              height="22"
              rx="2"
              fill="#16304A"
              stroke="#2C4A66"
              strokeWidth="1"
            />
            <text
              x="395"
              y="47"
              textAnchor="middle"
              fill="#4FD8C4"
              fontSize="10"
              fontFamily="var(--font-mono)"
              letterSpacing="0.08em"
            >
              BroadcastChannel
            </text>
            <text
              x="395"
              y="80"
              textAnchor="middle"
              fill="#8CA6BC"
              fontSize="10"
              fontFamily="var(--font-mono)"
            >
              posturesync (same-origin)
            </text>

            {/* Demo Tab Node */}
            <rect
              x="550"
              y="20"
              width="230"
              height="80"
              rx="2"
              fill="#0F2138"
              stroke="#2C4A66"
              strokeWidth="1"
            />
            <text x="565" y="44" fill="#8CA6BC" fontSize="11" fontFamily="var(--font-mono)" letterSpacing="0.05em">
              TAB 02 : DEMO ROUTE
            </text>
            <text x="565" y="66" fill="#E7EEF3" fontSize="13" fontFamily="var(--font-display)" fontWeight="600">
              Quiet Place Workspace
            </text>
            <text x="565" y="84" fill="#8CA6BC" fontSize="11" fontFamily="var(--font-mono)">
              Degradation & Blur Reaction
            </text>
          </svg>
        </div>
      </section>

      {/* 4. TWO FLAT PANELS (Describing what each tab does) */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem',
        marginBottom: '3.5rem'
      }}>
        {/* Panel A: Dashboard */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="panel-header">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.08em', color: 'var(--ink-muted)' }}>
                INSTRUMENT PANEL
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                PORT : 01
              </span>
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--ink-text)', margin: '0 0 0.5rem' }}>
              Tab 1: Vision Dashboard
            </h3>
            <p style={{ color: 'var(--ink-muted)', fontSize: '0.875rem', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
              Captures live local video, runs real-time MediaPipe body and facial landmark models, computes angular cervical deflection, and broadcasts state payloads.
            </p>
          </div>
          <Link to="/dashboard" className="btn btn-primary" style={{ width: '100%' }}>
            Open Dashboard Panel
          </Link>
        </div>

        {/* Panel B: Demo Workspace */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="panel-header">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.08em', color: 'var(--ink-muted)' }}>
                TARGET CLIENT
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                PORT : 02
              </span>
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--ink-text)', margin: '0 0 0.5rem' }}>
              Tab 2: Quiet Place Demo
            </h3>
            <p style={{ color: 'var(--ink-muted)', fontSize: '0.875rem', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
              Simulates your everyday workspace. Subscribes to BroadcastChannel telemetry and gently blurs readability when poor posture persists.
            </p>
          </div>
          <Link to="/demo" className="btn btn-secondary" style={{ width: '100%' }}>
            Open Demo Environment
          </Link>
        </div>
      </section>

      {/* 5. SPECIFICATION LIST (Hairline-rule separated rows) */}
      <section style={{
        borderTop: '1px solid var(--ink-border)',
        paddingTop: '1.5rem'
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          letterSpacing: '0.1em',
          color: 'var(--ink-muted)',
          marginBottom: '1rem'
        }}>
          SYSTEM SPECIFICATIONS
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[
            {
              label: 'PROCESSING ARCHITECTURE',
              value: '100% on-device inference via WebAssembly & WebGL. Zero network requests.'
            },
            {
              label: 'IMAGE PERSISTENCE',
              value: 'Zero video or image frames are ever recorded, written to disk, or transmitted.'
            },
            {
              label: 'INTER-PROCESS BUS',
              value: 'Native browser BroadcastChannel API — zero WebSockets, servers, or cloud dependencies.'
            },
            {
              label: 'EXTENSIONS REQUIRED',
              value: 'None. Operates purely inside modern Chromium, Gecko, or WebKit browser runtimes.'
            },
            {
              label: 'LATENCY PROFILE',
              value: 'Sub-35ms frame-to-classification turnaround with exponential moving average smoothing.'
            }
          ].map((row, idx) => (
            <div
              key={idx}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(180px, 240px) 1fr',
                padding: '0.85rem 0',
                borderBottom: '1px solid var(--ink-border)',
                alignItems: 'baseline',
                gap: '1rem'
              }}
            >
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--ink-muted)',
                letterSpacing: '0.04em'
              }}>
                {row.label}
              </span>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.875rem',
                color: 'var(--ink-text)',
                lineHeight: 1.5
              }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

