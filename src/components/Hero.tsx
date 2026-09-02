import React from 'react';
import { ArrowRight } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <section className="qp-hero-section">
      <div className="qp-container" style={{ textAlign: 'center' }}>
        {/* Eyebrow */}
        <div className="qp-eyebrow">
          A slower corner of the internet
        </div>

        {/* Editorial Headline */}
        <h1 className="qp-hero-title">
          Make Space<br />
          For Something Quiet.
        </h1>

        {/* Description */}
        <p className="qp-hero-desc">
          A gentle space for reflection, creativity, and small moments that make the day feel a little lighter.
        </p>

        {/* Hero CTA Action Buttons */}
        <div className="qp-hero-buttons">
          <a href="#explore" className="qp-cta-btn" style={{ padding: '12px 28px', fontSize: '0.98rem' }}>
            <span>Explore Quiet Places</span>
            <ArrowRight size={16} strokeWidth={2} />
          </a>

          <a href="#how-it-works" className="qp-hero-secondary-btn">
            How it works
          </a>
        </div>

        {/* Atmospheric Landscape Illustration (Pure Vector SVG / HTML, 0 external images) */}
        <div className="qp-hero-landscape-wrapper">
          <svg
            viewBox="0 0 1200 460"
            className="qp-landscape-svg"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Illustration of a serene natural landscape with hills, trees, and warm sun"
          >
            <defs>
              {/* Sky Gradient */}
              <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#F8F3E8" />
                <stop offset="60%" stopColor="#EAF3EE" />
                <stop offset="100%" stopColor="#DCEBE4" />
              </linearGradient>

              {/* Distant Mountains Gradient */}
              <linearGradient id="distantHillsGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#B3CBC3" />
                <stop offset="100%" stopColor="#8DAFA4" />
              </linearGradient>

              {/* Mid Hills Gradient */}
              <linearGradient id="midHillsGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#5B8276" />
                <stop offset="100%" stopColor="#3B6358" />
              </linearGradient>

              {/* Foreground Rolling Meadow Gradient */}
              <linearGradient id="foreHillsGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#2D544B" />
                <stop offset="100%" stopColor="#173B35" />
              </linearGradient>

              {/* Sun Glow */}
              <radialGradient id="sunGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FDE8CD" stopOpacity="0.9" />
                <stop offset="60%" stopColor="#F4A09A" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#F4A09A" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Background Sky Canvas */}
            <rect width="1200" height="460" rx="24" fill="url(#skyGrad)" />

            {/* Subtle Sun / Dawn Glow */}
            <circle cx="760" cy="170" r="110" fill="url(#sunGrad)" />
            <circle cx="760" cy="170" r="48" fill="#FBF3DE" opacity="0.9" />

            {/* Soft Cream Cloud Silhouettes */}
            <g fill="#FCFAF5" opacity="0.75">
              <path d="M220 140 c15-20 45-20 60 0 c15-10 35-5 45 10 c12 0 25 10 20 25 c-5 10-85 10-125 0 c-10-10-10-25 0-35 z" />
              <path d="M880 110 c20-18 55-15 70 5 c18-8 40-2 48 15 c15 2 25 15 18 28 c-10 10-100 8-136 0 c-12-15-10-38 0-48 z" />
            </g>

            {/* Distant Blue-Green Mountains */}
            <path
              d="M0 340 Q 180 220 380 280 T 820 250 T 1200 290 L 1200 460 L 0 460 Z"
              fill="url(#distantHillsGrad)"
              opacity="0.85"
            />

            {/* Midground Forest Hills */}
            <path
              d="M0 370 Q 260 270 540 330 T 1000 310 Q 1120 320 1200 350 L 1200 460 L 0 460 Z"
              fill="url(#midHillsGrad)"
            />

            {/* Atmospheric Water / Meadow Reflection */}
            <path
              d="M340 390 Q 600 365 860 390 Q 1020 405 1200 400 L 1200 460 L 0 460 L 0 410 Q 160 415 340 390 Z"
              fill="#224840"
              opacity="0.5"
            />

            {/* Foreground Organic Ridge & Gentle Slope */}
            <path
              d="M0 405 Q 320 345 640 400 T 1200 380 L 1200 460 L 0 460 Z"
              fill="url(#foreHillsGrad)"
            />

            {/* Decorative Organic Trees (Stylized Minimalist Silhouettes) */}
            <g fill="#173B35">
              {/* Tree Cluster Left */}
              <path d="M140 400 c0-28 20-48 40-48 s40 20 40 48 c0 15-18 25-40 25 s-40-10-40-25 z" fill="#13332D" />
              <path d="M100 420 c0-22 16-38 32-38 s32 16 32 38 c0 12-14 20-32 20 s-32-8-32-20 z" fill="#173B35" />
              <path d="M210 415 c0-20 14-34 28-34 s28 14 28 34 c0 10-12 18-28 18 s-28-8-28-18 z" fill="#1A403A" />

              {/* Tree Cluster Mid-Right */}
              <path d="M780 395 c0-32 22-54 45-54 s45 22 45 54 c0 18-20 28-45 28 s-45-10-45-28 z" fill="#102D27" />
              <path d="M850 410 c0-22 15-36 30-36 s30 14 30 36 c0 12-13 20-30 20 s-30-8-30-20 z" fill="#173B35" />

              {/* Delicate Botanical Grass & Flora Details */}
              <path d="M480 435 Q 485 410 495 405 Q 492 425 490 435" stroke="#78958B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <path d="M495 435 Q 503 415 515 412 Q 508 428 504 435" stroke="#78958B" strokeWidth="2" fill="none" strokeLinecap="round" />
              <path d="M472 438 Q 470 420 464 416 Q 468 429 470 438" stroke="#78958B" strokeWidth="2" fill="none" strokeLinecap="round" />
              
              {/* Subtle Coral Wildflower Dots */}
              <circle cx="500" cy="412" r="3.5" fill="#E96F67" />
              <circle cx="518" cy="418" r="2.5" fill="#F4A09A" />
              <circle cx="462" cy="422" r="3" fill="#E96F67" />
            </g>
          </svg>
        </div>
      </div>
    </section>
  );
};
