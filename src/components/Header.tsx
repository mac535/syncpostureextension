import React, { useState } from 'react';
import { Search, Menu, X, ArrowRight } from 'lucide-react';

export const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="qp-header-wrapper">
      <div className="qp-container">
        <div className="qp-header-inner">
          {/* Brand / Logo */}
          <div className="qp-brand">
            <div className="qp-brand-mark" aria-hidden="true">
              {/* Original botanical/leaf & sun emblem in pure SVG */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a9 9 0 0 0 9 9c0 4.97-4.03 9-9 9A9 9 0 0 1 3 12C3 7.03 7.03 3 12 3z" />
                <path d="M12 7v10" />
                <path d="M8 12c1.5 1 2.5 1 4 0" />
                <path d="M12 10c1.5-1 2.5-1 4 0" />
              </svg>
            </div>
            <span className="qp-brand-text">Quiet Place</span>
          </div>

          {/* Center Navigation Links */}
          <nav className="qp-nav" aria-label="Main Navigation">
            <a href="#explore" className="qp-nav-link">Explore</a>
            <a href="#journal" className="qp-nav-link">Journal</a>
            <a href="#activities" className="qp-nav-link">Activities</a>
            <a href="#about" className="qp-nav-link">About</a>
          </nav>

          {/* Right Action Items */}
          <div className="qp-actions">
            <button className="qp-icon-btn" aria-label="Search">
              <Search size={19} strokeWidth={1.8} />
            </button>

            <button className="qp-signin-btn">
              Sign in
            </button>

            <button className="qp-cta-btn">
              <span>Find Your Quiet</span>
              <ArrowRight size={15} strokeWidth={2} />
            </button>

            <button
              className="qp-mobile-toggle"
              aria-label="Toggle Menu"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="qp-mobile-menu">
          <a href="#explore" className="qp-nav-link" onClick={() => setMobileMenuOpen(false)}>Explore</a>
          <a href="#journal" className="qp-nav-link" onClick={() => setMobileMenuOpen(false)}>Journal</a>
          <a href="#activities" className="qp-nav-link" onClick={() => setMobileMenuOpen(false)}>Activities</a>
          <a href="#about" className="qp-nav-link" onClick={() => setMobileMenuOpen(false)}>About</a>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button className="qp-signin-btn" style={{ flex: 1, padding: '10px 0', border: '1px solid var(--qp-border)' }}>
              Sign in
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
