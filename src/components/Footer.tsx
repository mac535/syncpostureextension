import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="qp-footer-wrapper">
      <div className="qp-container">
        <div className="qp-footer-top">
          {/* Brand & Mission Statement */}
          <div className="qp-footer-brand-col">
            <div className="qp-brand" style={{ marginBottom: 'var(--space-12)' }}>
              <div className="qp-brand-mark" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3a9 9 0 0 0 9 9c0 4.97-4.03 9-9 9A9 9 0 0 1 3 12C3 7.03 7.03 3 12 3z" />
                  <path d="M12 7v10" />
                  <path d="M8 12c1.5 1 2.5 1 4 0" />
                  <path d="M12 10c1.5-1 2.5-1 4 0" />
                </svg>
              </div>
              <span className="qp-brand-text">Quiet Place</span>
            </div>
            <p className="qp-footer-tagline">
              A slower corner of the internet for reflection, creativity, and a little more room.
            </p>
          </div>

          {/* Navigation Links */}
          <div className="qp-footer-links-grid">
            <div className="qp-footer-col">
              <span className="qp-footer-col-title">Navigation</span>
              <a href="#explore" className="qp-footer-link">Explore</a>
              <a href="#journal" className="qp-footer-link">Journal</a>
              <a href="#how-it-works" className="qp-footer-link">Activities</a>
              <a href="#about" className="qp-footer-link">About</a>
            </div>

            <div className="qp-footer-col">
              <span className="qp-footer-col-title">Company</span>
              <a href="#privacy" className="qp-footer-link">Privacy</a>
              <a href="#contact" className="qp-footer-link">Contact</a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="qp-footer-bottom">
          <p className="qp-footer-copy">
            &copy; {new Date().getFullYear()} Quiet Place. All rights reserved.
          </p>
          <div className="qp-footer-bottom-links">
            <span className="qp-footer-meta-pill">Client-Side Demo Space</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
