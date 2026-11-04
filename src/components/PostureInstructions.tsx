import React, { useEffect, useRef, useState } from 'react';
import type { PostureMetrics } from '../lib/posture/postureMetrics';
import { POSTURE_THRESHOLDS } from '../lib/posture/postureClassifier';

export interface PostureInstructionsProps {
  postureMetrics: PostureMetrics | null;
  onComplete: () => void;
  onDismiss?: () => void;
  isOverlay?: boolean;
}

export type SetupStep = 1 | 2 | 3 | 4 | 5;

export const PostureInstructions: React.FC<PostureInstructionsProps> = ({
  postureMetrics,
  onComplete,
  onDismiss,
}) => {
  const [currentStep, setCurrentStep] = useState<SetupStep>(1);
  // Flash message shown briefly after a step is accepted before advancing
  const [acceptedFlash, setAcceptedFlash] = useState<string | null>(null);

  // Step 5 Hold timer state (ms)
  const REQUIRED_HOLD_MS = 3000;
  const [holdProgressMs, setHoldProgressMs] = useState<number>(0);
  const holdStartTimestampRef = useRef<number | null>(null);

  // ---------------------------------------------------------------------------
  // Condition checks corresponding to the fixed ergonomic thresholds
  // ---------------------------------------------------------------------------
  const isStep1Valid = Boolean(
    postureMetrics?.isValid &&
    (postureMetrics?.confidence ?? 0) >= POSTURE_THRESHOLDS.MIN_CONFIDENCE
  );

  const isStep2Valid = Boolean(
    isStep1Valid &&
    postureMetrics?.shoulderTiltDeg !== null &&
    postureMetrics?.shoulderTiltDeg !== undefined &&
    postureMetrics.shoulderTiltDeg < POSTURE_THRESHOLDS.SHOULDER_TILT_MILD
  );

  const isStep3Valid = Boolean(
    isStep2Valid &&
    postureMetrics?.lateralTiltDeg !== null &&
    postureMetrics?.lateralTiltDeg !== undefined &&
    postureMetrics.lateralTiltDeg < POSTURE_THRESHOLDS.LATERAL_TILT_MILD
  );

  const isStep4HeadForwardValid = Boolean(
    postureMetrics?.headForwardOffset !== null &&
    postureMetrics?.headForwardOffset !== undefined &&
    postureMetrics.headForwardOffset < POSTURE_THRESHOLDS.HEAD_FORWARD_MILD
  );

  const isStep4HeadAngleValid = Boolean(
    postureMetrics?.headTorsoAngleDeg !== null &&
    postureMetrics?.headTorsoAngleDeg !== undefined &&
    postureMetrics.headTorsoAngleDeg < POSTURE_THRESHOLDS.HEAD_TORSO_ANGLE_MILD
  );

  const isStep4Valid = Boolean(isStep3Valid && isStep4HeadForwardValid && isStep4HeadAngleValid);

  const isAllPostureAcceptable = isStep1Valid && isStep2Valid && isStep3Valid && isStep4Valid;

  // ---------------------------------------------------------------------------
  // Automatic step progression for Steps 1 through 4 with acceptance flash
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (currentStep === 1 && isStep1Valid) {
      setAcceptedFlash('FRAME LOCKED');
      timer = setTimeout(() => {
        setAcceptedFlash(null);
        setCurrentStep(2);
      }, 700);
    } else if (currentStep === 2 && isStep2Valid) {
      setAcceptedFlash('SHOULDER ALIGNMENT ACCEPTED');
      timer = setTimeout(() => {
        setAcceptedFlash(null);
        setCurrentStep(3);
      }, 700);
    } else if (currentStep === 3 && isStep3Valid) {
      setAcceptedFlash('TORSO ALIGNMENT ACCEPTED');
      timer = setTimeout(() => {
        setAcceptedFlash(null);
        setCurrentStep(4);
      }, 700);
    } else if (currentStep === 4 && isStep4Valid) {
      setAcceptedFlash('HEAD ALIGNMENT ACCEPTED');
      timer = setTimeout(() => {
        setAcceptedFlash(null);
        setCurrentStep(5);
      }, 700);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [currentStep, isStep1Valid, isStep2Valid, isStep3Valid, isStep4Valid]);

  // ---------------------------------------------------------------------------
  // Step 5 Hold Timer Management
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (currentStep !== 5) {
      setHoldProgressMs(0);
      holdStartTimestampRef.current = null;
      return;
    }

    if (holdProgressMs >= REQUIRED_HOLD_MS) return;

    let animFrame: number;

    const tick = () => {
      if (!isAllPostureAcceptable) {
        holdStartTimestampRef.current = null;
        setHoldProgressMs(0);
        animFrame = requestAnimationFrame(tick);
        return;
      }

      const now = performance.now();
      if (holdStartTimestampRef.current === null) {
        holdStartTimestampRef.current = now;
      }

      const elapsed = Math.min(REQUIRED_HOLD_MS, now - holdStartTimestampRef.current);
      setHoldProgressMs(elapsed);

      if (elapsed < REQUIRED_HOLD_MS) {
        animFrame = requestAnimationFrame(tick);
      }
    };

    animFrame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [currentStep, isAllPostureAcceptable, holdProgressMs]);

  const handleRestart = () => {
    setCurrentStep(1);
    setAcceptedFlash(null);
    setHoldProgressMs(0);
    holdStartTimestampRef.current = null;
  };

  const isHoldComplete = currentStep === 5 && holdProgressMs >= REQUIRED_HOLD_MS;

  // ---------------------------------------------------------------------------
  // Per-step content: instruction + the ONE relevant metric to show
  // ---------------------------------------------------------------------------
  type StepContent = {
    title: string;
    instruction: string;
    guidance: string;
    metricLabel: string;
    metricValue: string;
    metricLimit: string;
    isAccepted: boolean;
  };

  const getStepContent = (): StepContent => {
    switch (currentStep) {
      case 1:
        return {
          title: 'FRAME YOURSELF',
          instruction: 'Position yourself in the camera frame.',
          guidance: 'Move back until your head, shoulders and upper torso are clearly visible.',
          metricLabel: 'PERSON DETECTION',
          metricValue: isStep1Valid ? 'PRESENT' : 'SEARCHING...',
          metricLimit: 'Visible head + shoulders required',
          isAccepted: isStep1Valid,
        };
      case 2:
        return {
          title: 'LEVEL YOUR SHOULDERS',
          instruction: 'Bring your shoulders to the same height.',
          guidance: 'Raise or lower one shoulder until the shoulder line is level.',
          metricLabel: 'SHOULDER TILT',
          metricValue:
            postureMetrics?.shoulderTiltDeg !== null && postureMetrics?.shoulderTiltDeg !== undefined
              ? `${postureMetrics.shoulderTiltDeg}\u00b0`
              : '\u2014',
          metricLimit: `Target: < ${POSTURE_THRESHOLDS.SHOULDER_TILT_MILD}\u00b0`,
          isAccepted: isStep2Valid,
        };
      case 3:
        return {
          title: 'CENTER YOUR TORSO',
          instruction: 'Sit upright with your torso centered.',
          guidance: 'Bring your torso back toward the center without leaning left or right.',
          metricLabel: 'LATERAL TILT',
          metricValue:
            postureMetrics?.lateralTiltDeg !== null && postureMetrics?.lateralTiltDeg !== undefined
              ? `${postureMetrics.lateralTiltDeg}\u00b0`
              : '\u2014',
          metricLimit: `Target: < ${POSTURE_THRESHOLDS.LATERAL_TILT_MILD}\u00b0`,
          isAccepted: isStep3Valid,
        };
      case 4:
        return {
          title: 'ALIGN YOUR HEAD',
          instruction: 'Bring your head back over your shoulders.',
          guidance: !isStep4HeadForwardValid
            ? 'Move your head slightly back toward your shoulders.'
            : 'Raise your chin to reduce the forward neck angle.',
          metricLabel: 'HEAD FORWARD OFFSET',
          metricValue:
            postureMetrics?.headForwardOffset !== null && postureMetrics?.headForwardOffset !== undefined
              ? `${postureMetrics.headForwardOffset}`
              : '\u2014',
          metricLimit: `Target: < ${POSTURE_THRESHOLDS.HEAD_FORWARD_MILD}`,
          isAccepted: isStep4Valid,
        };
      case 5:
        return {
          title: 'HOLD POSTURE',
          instruction: 'Maintain this position for 3 seconds.',
          guidance: isHoldComplete
            ? 'Posture verified. Monitoring is now active.'
            : isAllPostureAcceptable
            ? 'Hold steady. Verifying alignment...'
            : !isStep1Valid
            ? 'Return to the camera frame.'
            : !isStep2Valid
            ? 'Re-level your shoulders.'
            : !isStep3Valid
            ? 'Re-center your torso.'
            : 'Re-align your head.',
          metricLabel: 'HOLD PROGRESS',
          metricValue: isHoldComplete
            ? 'VERIFIED'
            : isAllPostureAcceptable
            ? `${(holdProgressMs / 1000).toFixed(1)}s`
            : 'DEVIATED',
          metricLimit: 'Continuous 3.0 s hold',
          isAccepted: isHoldComplete,
        };
    }
  };

  const step = getStepContent();

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div
      className="glass-panel"
      style={{
        padding: '1.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
      {/* â”€â”€ Top header row â”€â”€ */}
      <div
        className="panel-header"
        style={{ margin: 0, paddingBottom: '0.75rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              backgroundColor: isHoldComplete ? 'var(--signal-good)' : 'var(--ink-muted)',
              display: 'inline-block',
              flexShrink: 0,
            }}
            aria-hidden="true"
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              letterSpacing: '0.08em',
              color: 'var(--ink-muted)',
              fontWeight: 500,
            }}
          >
            POSTURE SETUP
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              letterSpacing: '0.08em',
              color: 'var(--ink-text)',
              fontWeight: 600,
            }}
          >
            // STEP 0{currentStep} / 05
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={handleRestart}
            style={{
              background: 'transparent',
              border: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              color: 'var(--ink-muted)',
              cursor: 'pointer',
              padding: '2px 6px',
              letterSpacing: '0.04em',
            }}
            title="Restart posture setup from Step 1"
            aria-label="Restart posture setup"
          >
            [ RESTART ]
          </button>

          {onDismiss && (
            <button
              onClick={onDismiss}
              style={{
                background: 'transparent',
                border: 'none',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                color: 'var(--ink-muted)',
                cursor: 'pointer',
                padding: '2px 6px',
                letterSpacing: '0.04em',
              }}
              title="Dismiss setup guide"
              aria-label="Dismiss setup guide"
            >
              [ SKIP ]
            </button>
          )}
        </div>
      </div>

      {/* â”€â”€ Progress rail â”€â”€ */}
      <div
        className="setup-progress-rail"
        style={{ gridTemplateColumns: `repeat(5, 1fr)` }}
        role="progressbar"
        aria-valuenow={currentStep}
        aria-valuemin={1}
        aria-valuemax={5}
        aria-label={`Setup step ${currentStep} of 5`}
      >
        {([1, 2, 3, 4, 5] as SetupStep[]).map((s) => {
          const isPassed = currentStep > s || (s === 5 && isHoldComplete);
          const isCurrent = currentStep === s;
          return (
            <div
              key={s}
              className={
                'setup-progress-rail__segment ' +
                (isPassed
                  ? 'setup-progress-rail__segment--done'
                  : isCurrent
                  ? 'setup-progress-rail__segment--active'
                  : 'setup-progress-rail__segment--pending')
              }
            />
          );
        })}
      </div>

      {/* â”€â”€ Main instruction â”€â”€ */}
      <div>
        <div
          className="setup-step-title"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.3rem',
            fontWeight: 600,
            color: 'var(--ink-text)',
            marginBottom: '0.4rem',
            lineHeight: 1.3,
          }}
        >
          {step.title}
        </div>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.95rem',
            lineHeight: 1.55,
            color: 'var(--ink-text)',
            margin: 0,
          }}
        >
          {step.instruction}
        </p>
      </div>

      {/* â”€â”€ Focused metric callout (single metric per step) â”€â”€ */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '1rem 1.25rem',
          backgroundColor: 'var(--ink-bg)',
          border: `1px solid ${step.isAccepted ? 'rgba(79,216,196,0.3)' : 'var(--ink-border)'}`,
          borderLeft: `3px solid ${step.isAccepted || acceptedFlash ? 'var(--signal-good)' : 'var(--ink-border)'}`,
          borderRadius: '2px',
          transition: 'border-color 0.2s ease',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div className="metric-callout">
          <div className="metric-callout__label">{step.metricLabel}</div>
          <div
            className={
              'metric-callout__value ' +
              (step.isAccepted || acceptedFlash
                ? 'metric-callout__value--good'
                : step.metricValue === 'SEARCHING...' || step.metricValue === 'DEVIATED'
                ? 'metric-callout__value--alert'
                : 'metric-callout__value--muted')
            }
            aria-live="polite"
            aria-atomic="true"
          >
            {step.metricValue}
          </div>
          <div className="metric-callout__limit">{step.metricLimit}</div>
        </div>

        {/* Status chip */}
        <div style={{ marginLeft: 'auto' }}>
          {acceptedFlash ? (
            <span className="step-accepted-flash" role="status">
              &#10003; {acceptedFlash}
            </span>
          ) : (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                fontWeight: 600,
                letterSpacing: '0.05em',
                color: step.isAccepted ? 'var(--signal-good)' : 'var(--ink-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              role="status"
            >
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  backgroundColor: step.isAccepted ? 'var(--signal-good)' : 'var(--ink-border)',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
                aria-hidden="true"
              />
              {step.isAccepted ? 'ACCEPTED' : 'REQUIRED'}
            </span>
          )}
        </div>
      </div>

      {/* â”€â”€ Step 5: Hold progress bar â”€â”€ */}
      {currentStep === 5 && (
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
          role="timer"
          aria-label={`Hold progress: ${(holdProgressMs / 1000).toFixed(1)} of 3.0 seconds`}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              color: 'var(--ink-muted)',
            }}
          >
            <span>HOLDING POSTURE</span>
            <span style={{ color: isHoldComplete ? 'var(--signal-good)' : 'var(--ink-text)', fontWeight: 600 }}>
              {(holdProgressMs / 1000).toFixed(1)} / 3.0 s
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: '6px',
              backgroundColor: 'var(--ink-panel)',
              border: '1px solid var(--ink-border)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${(holdProgressMs / REQUIRED_HOLD_MS) * 100}%`,
                height: '100%',
                backgroundColor: isHoldComplete ? 'var(--signal-good)' : 'var(--ink-text)',
                transition: 'width 0.05s linear, background-color 0.25s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* â”€â”€ Guidance line â”€â”€ */}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.72rem',
          lineHeight: 1.5,
          color: step.isAccepted ? 'var(--signal-good)' : 'var(--ink-muted)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem',
        }}
        role="status"
        aria-live="polite"
      >
        <span style={{ flexShrink: 0 }}>// GUIDANCE :</span>
        <span>{step.guidance}</span>
      </div>

      {/* â”€â”€ COMPLETION STATE (Step 5 hold complete) â”€â”€ */}
      {isHoldComplete && (
        <div
          style={{
            borderTop: '1px solid var(--ink-border)',
            paddingTop: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
          role="region"
          aria-label="Posture verified. Ready to begin monitoring."
        >
          {/* Verified headline */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
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
                  color: 'var(--signal-good)',
                }}
              >
                POSTURE VERIFIED
              </span>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.875rem',
                color: 'var(--ink-muted)',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Reference posture established. Posture monitoring is now active.
            </p>
          </div>

          {/* Confirm & Complete Setup button */}
          <button
            id="btn-launch-demo-completed"
            className="btn btn-primary"
            onClick={onComplete}
            style={{
              width: '100%',
              padding: '0.75rem 1.25rem',
              fontFamily: 'var(--font-display)',
              fontSize: '0.9rem',
              letterSpacing: '0.02em',
            }}
            aria-label="Finish calibration and begin monitoring"
          >
            Start Posture Monitoring ✓
          </button>
        </div>
      )}
    </div>
  );
};
