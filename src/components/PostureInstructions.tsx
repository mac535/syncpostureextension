import React from 'react';

export interface PostureInstructionsProps {
  hasVisiblePerson: boolean;
  onContinue: () => void;
  onDismiss?: () => void;
  isOverlay?: boolean;
}

export const PostureInstructions: React.FC<PostureInstructionsProps> = ({
  hasVisiblePerson,
  onContinue,
  onDismiss,
  isOverlay = false
}) => {
  return (
    <div
      className="glass-panel"
      style={{
        padding: '1.75rem',
        backgroundColor: 'var(--ink-panel)',
        border: '1px solid var(--ink-border)',
        borderRadius: '4px',
        boxShadow: isOverlay ? '0 12px 32px rgba(7, 18, 32, 0.85)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem'
      }}
    >
      {/* Header */}
      <div className="panel-header" style={{ margin: 0, paddingBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              backgroundColor: 'var(--signal-good)',
              display: 'inline-block'
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              letterSpacing: '0.08em',
              color: 'var(--ink-text)',
              fontWeight: 600
            }}
          >
            POSTURE GUIDANCE // ERGONOMIC ORIENTATION
          </span>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--ink-muted)',
              cursor: 'pointer',
              padding: '2px 6px'
            }}
            title="Dismiss guide"
          >
            [ CLOSE ]
          </button>
        )}
      </div>

      {/* Guidance Text */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.95rem',
            lineHeight: 1.6,
            color: 'var(--ink-text)',
            margin: 0
          }}
        >
          Sit upright. Keep your head roughly aligned with your shoulders. Keep your shoulders level. Avoid leaning far forward or to one side. Make sure your face and upper body are visible to the camera.
        </p>
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            lineHeight: 1.5,
            color: 'var(--ink-muted)',
            margin: 0
          }}
        >
          Note: This is an ergonomic guidance checklist. No baseline calibration or metric values are being stored or transmitted.
        </p>
      </div>

      {/* Visibility Status Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          backgroundColor: 'var(--ink-bg)',
          border: '1px solid var(--ink-border)',
          borderRadius: '2px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              backgroundColor: hasVisiblePerson ? 'var(--signal-good)' : 'var(--signal-alert)',
              display: 'inline-block'
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              letterSpacing: '0.06em',
              fontWeight: 600,
              color: hasVisiblePerson ? 'var(--signal-good)' : 'var(--signal-alert)'
            }}
          >
            {hasVisiblePerson ? '[ PERSON DETECTED ]' : '[ POSITION YOURSELF IN FRAME ]'}
          </span>
        </div>

        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.72rem',
            color: 'var(--ink-muted)'
          }}
        >
          {hasVisiblePerson
            ? 'Optical visibility verified'
            : 'Awaiting sufficient torso and shoulder landmarks'}
        </span>
      </div>

      {/* Action Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
        <button
          id="btn-continue-demo"
          className="btn btn-primary"
          onClick={onContinue}
          disabled={!hasVisiblePerson}
          style={{
            minWidth: '220px',
            opacity: hasVisiblePerson ? 1 : 0.45,
            cursor: hasVisiblePerson ? 'pointer' : 'not-allowed'
          }}
        >
          Continue to Demo Website
        </button>
      </div>
    </div>
  );
};
