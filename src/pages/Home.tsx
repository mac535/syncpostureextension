import React from 'react';
import { Link } from 'react-router-dom';

export const Home: React.FC = () => {
  return (
    <div style={{ maxWidth: '1080px', margin: '2rem auto 4.5rem', padding: '0 1.5rem', fontFamily: 'var(--font-display)' }}>
      {/* =========================================================================
          SECTION 1 — HERO: What syncPosture is & Angular Deflection Concept
          ========================================================================= */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '2.5rem',
          alignItems: 'center',
          marginBottom: '4rem',
          borderBottom: '1px solid var(--ink-border)',
          paddingBottom: '3.5rem'
        }}
      >
        {/* Left Column: Mission, Value & Direct CTAs */}
        <div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              letterSpacing: '0.1em',
              color: 'var(--ink-muted)',
              marginBottom: '0.75rem'
            }}
          >
            ON-DEVICE ERGONOMIC MONITORING
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2.35rem',
              fontWeight: 600,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              color: 'var(--ink-text)',
              margin: '0 0 1rem'
            }}
          >
            Real-time posture intelligence, running entirely on your machine.
          </h1>

          <p
            style={{
              color: 'var(--ink-muted)',
              fontSize: '1rem',
              lineHeight: 1.6,
              margin: '0 0 2rem',
              maxWidth: '520px'
            }}
          >
            syncPosture uses on-device vision to detect sustained posture deviation and turn it into a real-time workspace intervention — without sending video to a server.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem' }}>
            <Link to="/dashboard" className="btn btn-primary">
              Open Posture Dashboard
            </Link>
          </div>
        </div>

        {/* Right Column: Angular Deflection SVG Instrument Schema */}
        <div
          style={{
            backgroundColor: 'var(--ink-panel)',
            border: '1px solid var(--ink-border)',
            borderRadius: '4px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
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
                <circle
                  cx="115"
                  cy="70"
                  r="16"
                  stroke="var(--ink-text)"
                  strokeWidth="1.75"
                  fill="none"
                />
                <circle cx="115" cy="73" r="2.5" fill="var(--signal-good)" />

                <path
                  d="M 115 86 L 115 110 L 105 168 L 105 202 L 148 202"
                  stroke="var(--ink-text)"
                  strokeWidth="1.75"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

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
                <circle cx="105" cy="202" r="2.5" fill="var(--ink-muted)" />

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

                <path
                  d="M 280 160 L 280 205 L 375 205"
                  stroke="var(--ink-border)"
                  strokeWidth="1"
                  fill="none"
                />

                <line
                  x1="340"
                  y1="52"
                  x2="340"
                  y2="208"
                  stroke="var(--ink-border)"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />

                <line
                  x1="375"
                  y1="68"
                  x2="340"
                  y2="120"
                  stroke="var(--signal-alert)"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />

                <path
                  d="M 340 76 A 44 44 0 0 1 364 84"
                  stroke="var(--signal-alert)"
                  strokeWidth="1.2"
                  fill="none"
                  markerEnd="url(#arc-arrow)"
                />

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

                <circle
                  cx="375"
                  cy="68"
                  r="16"
                  stroke="var(--ink-text)"
                  strokeWidth="1.75"
                  fill="none"
                />
                <circle cx="375" cy="71" r="2.5" fill="var(--signal-alert)" />

                <path
                  d="M 368 83 Q 346 102 340 120 Q 320 156 332 202 L 375 202"
                  stroke="var(--ink-text)"
                  strokeWidth="1.75"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <circle cx="340" cy="120" r="2.5" fill="var(--signal-alert)" />
                <path
                  d="M 340 120 L 362 160 L 388 160"
                  stroke="var(--ink-text)"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="362" cy="160" r="2" fill="var(--ink-muted)" />
                <circle cx="332" cy="202" r="2.5" fill="var(--ink-muted)" />

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

      {/* =========================================================================
          SECTION 2 — SIGNAL PIPELINE: Engineering Signal Diagram
          ========================================================================= */}
      <section style={{ marginBottom: '4rem' }}>
        <div style={{ marginBottom: '1.75rem' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              letterSpacing: '0.1em',
              color: 'var(--ink-muted)',
              marginBottom: '0.5rem'
            }}
          >
            SIGNAL PIPELINE
          </div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.45rem',
              fontWeight: 600,
              lineHeight: 1.35,
              color: 'var(--ink-text)',
              margin: 0
            }}
          >
            From camera frame to ergonomic intervention.
          </h2>
        </div>

        {/* 4-Stage Horizontal Instrument Flow */}
        <div
          style={{
            backgroundColor: 'var(--ink-panel)',
            border: '1px solid var(--ink-border)',
            borderRadius: '4px',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))'
            }}
          >
            {[
              {
                step: '01',
                phase: 'CAPTURE',
                label: 'Webcam frame',
                detail: 'Raw visual stream via getUserMedia'
              },
              {
                step: '02',
                phase: 'INTERPRET',
                label: 'Pose + facial landmarks',
                detail: 'Sub-35ms MediaPipe spatial inference'
              },
              {
                step: '03',
                phase: 'CLASSIFY',
                label: 'Posture geometry + temporal smoothing',
                detail: 'Multi-axis vectors with EMA filtering'
              },
              {
                step: '04',
                phase: 'INTERVENE',
                label: 'Posture signal → workspace response',
                detail: 'Progressive defocus on sustained deviation'
              }
            ].map((stage, idx) => (
              <div
                key={stage.step}
                style={{
                  padding: '1.5rem',
                  position: 'relative',
                  borderRight: idx < 3 ? '1px solid var(--ink-border)' : 'none',
                  borderBottom: '1px solid var(--ink-border)'
                }}
              >
                {/* Header: Stage index and phase */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    marginBottom: '1rem'
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.725rem',
                      fontWeight: 500,
                      color: 'var(--signal-good)',
                      letterSpacing: '0.08em'
                    }}
                  >
                    {stage.step} // {stage.phase}
                  </span>
                  {idx < 3 && (
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        color: 'var(--ink-muted)',
                        opacity: 0.5
                      }}
                      aria-hidden="true"
                    >
                      →
                    </span>
                  )}
                </div>

                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    color: 'var(--ink-text)',
                    lineHeight: 1.4,
                    marginBottom: '0.35rem'
                  }}
                >
                  {stage.label}
                </div>

                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: 'var(--ink-muted)',
                    lineHeight: 1.45
                  }}
                >
                  {stage.detail}
                </div>
              </div>
            ))}
          </div>

          {/* Technical bus annotation footer */}
          <div
            style={{
              padding: '0.8rem 1.25rem',
              backgroundColor: 'rgba(15, 33, 56, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.725rem',
                letterSpacing: '0.08em',
                color: 'var(--ink-muted)'
              }}
            >
              INTER-TAB SIGNAL BUS // BroadcastChannel // posturesync
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.725rem',
                color: 'var(--signal-good)'
              }}
            >
              SAME-ORIGIN EVENT DISPATCH
            </span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3 — WHAT THE ENGINE OBSERVES: 2x2 Posture Geometry Matrix
          ========================================================================= */}
      <section style={{ marginBottom: '4rem' }}>
        <div style={{ marginBottom: '1.75rem' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              letterSpacing: '0.1em',
              color: 'var(--ink-muted)',
              marginBottom: '0.5rem'
            }}
          >
            POSTURE GEOMETRY
          </div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.45rem',
              fontWeight: 600,
              lineHeight: 1.35,
              color: 'var(--ink-text)',
              margin: 0
            }}
          >
            What the vision engine actually observes.
          </h2>
        </div>

        {/* 2x2 Technical Matrix */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1rem',
            marginBottom: '1.25rem'
          }}
        >
          {[
            {
              index: '01',
              metric: 'HEAD ALIGNMENT',
              symbol: 'headForwardOffset',
              desc: 'Forward head displacement relative to the shoulder reference, normalized to shoulder width.'
            },
            {
              index: '02',
              metric: 'LATERAL LEAN',
              symbol: 'lateralTiltDeg',
              desc: 'Torso deviation from the vertical reference plumb line through the shoulder and hip midpoint.'
            },
            {
              index: '03',
              metric: 'SHOULDER BALANCE',
              symbol: 'shoulderTiltDeg',
              desc: 'Tilt of the shoulder line relative to horizontal, tracking asymmetric elevation or drooping.'
            },
            {
              index: '04',
              metric: 'HEAD–TORSO ALIGNMENT',
              symbol: 'headTorsoAngleDeg',
              desc: 'Angular relationship between the head vector and torso reference, isolating cervical spine flexion.'
            }
          ].map((item) => (
            <div
              key={item.index}
              style={{
                backgroundColor: 'var(--ink-panel)',
                border: '1px solid var(--ink-border)',
                borderRadius: '4px',
                padding: '1.35rem 1.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem'
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--signal-good)',
                      letterSpacing: '0.04em'
                    }}
                  >
                    {item.index}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.7rem',
                      color: 'var(--ink-muted)',
                      letterSpacing: '0.04em'
                    }}
                  >
                    {item.symbol}
                  </span>
                </div>

                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    color: 'var(--ink-text)',
                    marginBottom: '0.5rem'
                  }}
                >
                  {item.metric}
                </div>

                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.85rem',
                    color: 'var(--ink-muted)',
                    lineHeight: 1.55,
                    margin: 0
                  }}
                >
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Small Technical Note */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: 'var(--ink-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0'
          }}
        >
          <span style={{ color: 'var(--signal-good)' }}>// NOTE:</span>
          <span>The system smooths frame-level measurements and waits for sustained deviation before triggering an intervention.</span>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4 — LOCAL BY DESIGN: Architectural Privacy & Boundary Table
          ========================================================================= */}
      <section
        style={{
          marginBottom: '4rem',
          borderTop: '1px solid var(--ink-border)',
          paddingTop: '2.5rem'
        }}
      >
        <div style={{ marginBottom: '1.75rem' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              letterSpacing: '0.1em',
              color: 'var(--ink-muted)',
              marginBottom: '0.5rem'
            }}
          >
            LOCAL BY DESIGN
          </div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.45rem',
              fontWeight: 600,
              lineHeight: 1.35,
              color: 'var(--ink-text)',
              margin: 0
            }}
          >
            Privacy is part of the architecture.
          </h2>
        </div>

        {/* Technical Specification Table */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[
            {
              label: 'COMPUTATION',
              value: 'On-device vision inference',
              note: 'Posture inference runs locally after the required vision assets are available to the browser.'
            },
            {
              label: 'VIDEO',
              value: 'Frames are not intentionally recorded or transmitted by the application',
              note: 'Camera memory buffers remain strictly isolated within browser WebGL and CPU contexts.'
            },
            {
              label: 'SIGNAL BUS',
              value: 'Native BroadcastChannel for same-origin tab communication',
              note: 'Zero telemetry leaks outside the local browser instance; no external relay required.'
            },
            {
              label: 'INFRASTRUCTURE',
              value: 'No application backend or WebSocket dependency',
              note: 'Operates entirely client-side without authentication servers, databases, or remote workers.'
            }
          ].map((row) => (
            <div
              key={row.label}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(180px, 240px) 1fr',
                padding: '1.1rem 0',
                borderBottom: '1px solid var(--ink-border)',
                alignItems: 'baseline',
                gap: '1.5rem'
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--ink-muted)',
                  letterSpacing: '0.06em'
                }}
              >
                {row.label}
              </span>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.925rem',
                    fontWeight: 500,
                    color: 'var(--ink-text)',
                    lineHeight: 1.45,
                    marginBottom: '0.2rem'
                  }}
                >
                  {row.value}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: 'var(--ink-muted)',
                    lineHeight: 1.45
                  }}
                >
                  {row.note}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================================
          SECTION 5 — FINAL ACTION STRIP: Action Execution & Status
          ========================================================================= */}
      <section
        style={{
          backgroundColor: 'var(--ink-panel)',
          border: '1px solid var(--ink-border)',
          borderRadius: '4px',
          padding: '2rem 2.25rem'
        }}
      >
        <div style={{ maxWidth: '640px', marginBottom: '1.75rem' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              letterSpacing: '0.1em',
              color: 'var(--ink-muted)',
              marginBottom: '0.5rem'
            }}
          >
            READY TO RUN
          </div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.45rem',
              fontWeight: 600,
              lineHeight: 1.3,
              color: 'var(--ink-text)',
              margin: '0 0 0.65rem'
            }}
          >
            See the signal become an intervention.
          </h2>
          <p
            style={{
              color: 'var(--ink-muted)',
              fontSize: '0.9rem',
              lineHeight: 1.55,
              margin: 0
            }}
          >
            Open the dashboard to inspect live posture telemetry.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.85rem',
            marginBottom: '1.5rem'
          }}
        >
          <Link to="/dashboard" className="btn btn-primary">
            Open Dashboard
          </Link>
        </div>

        <div
          style={{
            borderTop: '1px solid var(--ink-border)',
            paddingTop: '0.85rem',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            letterSpacing: '0.08em',
            color: 'var(--ink-muted)'
          }}
        >
          LOCAL INFERENCE / REAL-TIME TELEMETRY / CLIENT-SIDE PROCESSING
        </div>
      </section>
    </div>
  );
};


