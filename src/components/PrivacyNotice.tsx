import React, { useEffect, useRef } from 'react';
import { ShieldCheck, Video, Eye, Lock } from 'lucide-react';

export interface PrivacyNoticeProps {
  isOpen: boolean;
  onContinue: () => void;
  onNotNow: () => void;
}

/**
 * PrivacyNotice
 *
 * Accessible privacy consent modal shown before any camera access is requested.
 * Explains local in-browser processing, lack of server video uploads, on-device inference,
 * and gives the user an explicit choice to Continue or opt out with 'Not now'.
 */
export const PrivacyNotice: React.FC<PrivacyNoticeProps> = ({
  isOpen,
  onContinue,
  onNotNow
}) => {
  const continueButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus the primary button when modal opens
    continueButtonRef.current?.focus();

    // Close on Escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onNotNow();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onNotNow]);

  if (!isOpen) return null;

  return (
    <div
      className="privacy-modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onNotNow();
        }
      }}
    >
      <div
        className="privacy-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-modal-title"
        aria-describedby="privacy-modal-desc"
      >
        {/* Header Badge */}
        <div className="privacy-modal-header">
          <div className="privacy-modal-badge">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>PRIVACY FIRST</span>
          </div>
        </div>

        {/* Title */}
        <h2 id="privacy-modal-title" className="privacy-modal-title">
          Camera Access &amp; On-Device Processing
        </h2>

        {/* Description Body */}
        <div id="privacy-modal-desc" className="privacy-modal-body">
          <p className="privacy-modal-lead">
            PostureSync uses your camera to analyze posture alignment and blink behavior.
          </p>

          <div className="privacy-highlight-box">
            <div className="privacy-highlight-item">
              <Lock size={16} className="privacy-highlight-icon" />
              <div>
                <strong>Local Video Processing:</strong> Camera frames are processed locally in your browser for real-time detection. The application does not intentionally upload your camera feed or video to a server.
              </div>
            </div>

            <div className="privacy-highlight-item">
              <Eye size={16} className="privacy-highlight-icon" />
              <div>
                <strong>On-Device Vision:</strong> Posture and blink detection run directly on your device.
              </div>
            </div>

            <div className="privacy-highlight-item">
              <Video size={16} className="privacy-highlight-icon" />
              <div>
                <strong>Camera Requirement:</strong> Camera access is required for real-time posture and blink monitoring. You can deny access if you prefer not to use camera-based features.
              </div>
            </div>
          </div>

          <p className="privacy-modal-footnote">
            Application and MediaPipe model assets may be downloaded by your browser to run on-device inference. Camera access can be stopped or revoked at any time through your browser controls.
          </p>
        </div>

        {/* Actions */}
        <div className="privacy-modal-actions">
          <button
            type="button"
            className="btn btn-secondary privacy-btn-not-now"
            onClick={onNotNow}
          >
            Not now
          </button>
          <button
            ref={continueButtonRef}
            type="button"
            className="btn btn-primary privacy-btn-continue"
            onClick={onContinue}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};
