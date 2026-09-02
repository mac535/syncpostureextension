import React from 'react';
import { ArrowRight } from 'lucide-react';

export const FinalCTA: React.FC = () => {
  return (
    <section className="qp-cta-section" id="find-quiet">
      <div className="qp-container">
        <div className="qp-cta-box">
          {/* Subtle celestial / organic starry vector accents */}
          <div className="qp-cta-decor" aria-hidden="true">
            <svg width="100%" height="100%" viewBox="0 0 1000 360" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Crescent Moon */}
              <path
                d="M120 70 A 18 18 0 0 0 134 94 A 22 22 0 1 1 120 70 Z"
                fill="#FCFAF5"
                opacity="0.85"
              />
              {/* Subtle Botanical Leaf Silhouette (Left) */}
              <path
                d="M60 280 Q 90 220 140 210 Q 120 250 80 290 Z"
                fill="#365B51"
                opacity="0.6"
              />
              <path
                d="M80 290 Q 120 260 170 270 Q 130 290 90 300 Z"
                fill="#365B51"
                opacity="0.4"
              />
              {/* Subtle Botanical Leaf Silhouette (Right) */}
              <path
                d="M920 270 Q 880 210 830 210 Q 860 250 900 280 Z"
                fill="#365B51"
                opacity="0.5"
              />
              {/* Minimalist 4-point stars / sparks */}
              <g fill="#FCFAF5" opacity="0.6">
                <path d="M860 60 Q 860 70 870 70 Q 860 70 860 80 Q 860 70 850 70 Q 860 70 860 60 Z" />
                <path d="M220 150 Q 220 157 227 157 Q 220 157 220 164 Q 220 157 213 157 Q 220 157 220 150 Z" />
                <path d="M780 180 Q 780 186 786 186 Q 780 186 780 192 Q 780 186 774 186 Q 780 186 780 180 Z" />
              </g>
              {/* Tiny soft dots */}
              <circle cx="180" cy="90" r="1.5" fill="#FCFAF5" opacity="0.4" />
              <circle cx="820" cy="110" r="1.5" fill="#FCFAF5" opacity="0.4" />
              <circle cx="280" cy="240" r="1.5" fill="#FCFAF5" opacity="0.3" />
              <circle cx="720" cy="230" r="1.5" fill="#FCFAF5" opacity="0.3" />
            </svg>
          </div>

          <div className="qp-cta-inner">
            <h2 className="qp-cta-title">
              Maybe you don&rsquo;t need another thing to do.
            </h2>
            <p className="qp-cta-desc">
              Sometimes the best thing you can give yourself is a little room.
            </p>
            <div>
              <button className="qp-cta-btn qp-cta-btn-large">
                <span>Find Your Quiet</span>
                <ArrowRight size={16} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
