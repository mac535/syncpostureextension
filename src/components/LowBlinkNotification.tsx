import React from 'react';
import { Eye } from 'lucide-react';

export interface LowBlinkNotificationProps {
  visible: boolean;
  blinkRate: number | null;
}

/**
 * Purely presentational low-blink-rate notification for the Demo tab.
 *
 * - Floats at bottom-left of the viewport (fixed, z-index 9999)
 * - Styled with dark/navy background, warning accent, and subtle glow
 * - Non-blocking floating card; does not push content or interfere with scrolling
 * - Contains entrance animation and no continuous looping animations
 */
export const LowBlinkNotification: React.FC<LowBlinkNotificationProps> = ({
  visible,
  blinkRate
}) => {
  if (!visible) return null;

  const displayRate = blinkRate !== null ? Math.round(blinkRate) : 0;

  return (
    <aside
      className="low-blink-card"
      role="status"
      aria-live="polite"
      aria-label="Low blink rate alert"
    >
      <div className="low-blink-header">
        <Eye className="low-blink-icon" aria-hidden="true" />
        <span className="low-blink-title">BLINK RATE LOW</span>
      </div>

      <p className="low-blink-text">
        Your recent blink rate is below the recommended level.
      </p>

      <p className="low-blink-hint">
        Try blinking naturally a few times.
      </p>

      <div className="low-blink-badge">
        <span>{displayRate} blinks/min</span>
      </div>
    </aside>
  );
};
