import React from 'react';
import { Eye, CheckCircle2, Clock } from 'lucide-react';

export interface EyeBreakInterventionProps {
  visible: boolean;
  remainingSeconds: number;
  isComplete?: boolean;
}

/**
 * EyeBreakIntervention
 *
 * Cinematic 20-20-20 eye-break intervention card for the Demo tab.
 * - Displays when 20 minutes of continuous monitoring has elapsed.
 * - Shows a 20-second countdown derived from the authoritative timer.
 * - Reminds the user to look 20 feet (6 meters) away for an ergonomic eye reset.
 * - Renders a brief 'BREAK COMPLETE' state before clearing.
 * - Purely presentational; does not run its own interval or duplicate timer state.
 */
export const EyeBreakIntervention: React.FC<EyeBreakInterventionProps> = ({
  visible,
  remainingSeconds,
  isComplete = false
}) => {
  if (!visible) return null;

  const secondsPadded = String(Math.max(0, remainingSeconds)).padStart(2, '0');
  const progressRatio = Math.max(0, Math.min(1, (20 - remainingSeconds) / 20));

  return (
    <div
      className="eye-break-overlay"
      role="alertdialog"
      aria-modal="false"
      aria-label="20-20-20 Eye Break Reminder"
    >
      <div className="eye-break-card">
        {isComplete ? (
          <div className="eye-break-complete-view">
            <div className="eye-break-icon-wrap complete">
              <CheckCircle2 size={32} />
            </div>
            <div className="eye-break-complete-badge">BREAK COMPLETE</div>
            <h2 className="eye-break-title">Eyes Refreshed</h2>
            <p className="eye-break-desc">
              Great job! Resuming active posture &amp; vision monitoring.
            </p>
          </div>
        ) : (
          <div className="eye-break-active-view">
            {/* Pill Header */}
            <div className="eye-break-header">
              <div className="eye-break-pill">
                <Clock size={13} />
                <span>20 — 20 — 20</span>
              </div>
            </div>

            {/* Title */}
            <h2 className="eye-break-title">TIME FOR AN EYE BREAK</h2>

            {/* Instruction */}
            <div className="eye-break-instruction-box">
              <div className="eye-break-instruction-main">
                <Eye size={18} className="eye-break-instruction-icon" />
                <span>Look 20 ft / 6 m away</span>
              </div>
              <span className="eye-break-instruction-sub">
                (approximately 6 meters)
              </span>
            </div>

            {/* Authoritative Countdown */}
            <div className="eye-break-countdown-wrap">
              <div className="eye-break-countdown-display">
                00:{secondsPadded}
              </div>
              <div className="eye-break-progress-bar">
                <div
                  className="eye-break-progress-fill"
                  style={{ width: `${(progressRatio * 100).toFixed(1)}%` }}
                />
              </div>
            </div>

            {/* Ergonomic reset message */}
            <p className="eye-break-desc">
              Give your eyes a short reset by focusing on a distant object.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
