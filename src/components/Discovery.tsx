import React from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';

interface PlaceItem {
  id: string;
  category: 'NATURE' | 'SLOW LIVING' | 'CREATIVE' | 'REFLECTION';
  title: string;
  description: string;
  layoutClass: string;
  renderIllustration: () => React.ReactNode;
}

export const Discovery: React.FC = () => {
  const places: PlaceItem[] = [
    {
      id: 'forest-morning',
      category: 'NATURE',
      title: 'Forest Morning',
      description: 'A quiet start surrounded by trees, birdsong, and cool air.',
      layoutClass: 'qp-place-featured',
      renderIllustration: () => (
        <svg viewBox="0 0 540 320" className="qp-card-svg" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="forestSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EAF3EE" />
              <stop offset="100%" stopColor="#DCEBE4" />
            </linearGradient>
            <linearGradient id="forestRidge" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#365B51" />
              <stop offset="100%" stopColor="#173B35" />
            </linearGradient>
          </defs>
          <rect width="540" height="320" fill="url(#forestSky)" />
          {/* Distant misty trees & birds */}
          <circle cx="420" cy="80" r="32" fill="#F8F3E8" opacity="0.8" />
          <path d="M120 70 q10 -8 20 0 q10 -8 20 0" stroke="#78958B" strokeWidth="1.5" fill="none" />
          <path d="M160 55 q8 -6 16 0 q8 -6 16 0" stroke="#78958B" strokeWidth="1.2" fill="none" opacity="0.7" />
          
          <path d="M0 200 Q 140 160 280 190 T 540 170 L 540 320 L 0 320 Z" fill="#78958B" opacity="0.4" />
          <path d="M0 230 Q 180 190 360 220 T 540 210 L 540 320 L 0 320 Z" fill="#5B8276" opacity="0.7" />
          <path d="M0 260 Q 240 220 480 250 L 540 260 L 540 320 L 0 320 Z" fill="url(#forestRidge)" />
          {/* Stylized Pines & Flora */}
          <polygon points="120,170 95,240 145,240" fill="#173B35" />
          <polygon points="120,140 100,200 140,200" fill="#1D4740" />
          <polygon points="190,190 170,250 210,250" fill="#173B35" />
          <polygon points="380,180 355,260 405,260" fill="#173B35" />
          <polygon points="380,150 362,210 398,210" fill="#224E46" />
          {/* Subtle Wildflower Sparkle */}
          <circle cx="280" cy="285" r="3" fill="#E96F67" />
          <circle cx="295" cy="290" r="2" fill="#F4A09A" />
          <circle cx="160" cy="295" r="3" fill="#E96F67" />
        </svg>
      )
    },
    {
      id: 'rainy-afternoon',
      category: 'SLOW LIVING',
      title: 'Rainy Afternoon',
      description: 'A slower afternoon with a book, a warm drink, and nowhere else to be.',
      layoutClass: 'qp-place-standard',
      renderIllustration: () => (
        <svg viewBox="0 0 380 240" className="qp-card-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="380" height="240" fill="#DCEBE4" />
          {/* Window Frame with Rain Slants */}
          <rect x="40" y="30" width="300" height="150" rx="8" fill="#EAF3EE" />
          <line x1="190" y1="30" x2="190" y2="180" stroke="#B3CBC3" strokeWidth="3" />
          <line x1="40" y1="105" x2="340" y2="105" stroke="#B3CBC3" strokeWidth="3" />
          {/* Gentle rain streaks */}
          <line x1="70" y1="45" x2="60" y2="75" stroke="#78958B" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          <line x1="120" y1="65" x2="110" y2="95" stroke="#78958B" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          <line x1="230" y1="45" x2="220" y2="75" stroke="#78958B" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          <line x1="280" y1="80" x2="270" y2="110" stroke="#78958B" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          {/* Warm cup with steam on windowsill */}
          <rect x="0" y="180" width="380" height="60" fill="#F8F3E8" />
          <rect x="150" y="165" width="40" height="30" rx="4" fill="#E96F67" />
          <path d="M190 172 c6 0 10 4 10 9 s-4 9 -10 9" stroke="#E96F67" strokeWidth="2.5" fill="none" />
          <path d="M165 155 q-3 -6 0 -12" stroke="#78958B" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d="M175 152 q-3 -6 0 -12" stroke="#78958B" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      )
    },
    {
      id: 'creative-evening',
      category: 'CREATIVE',
      title: 'Creative Evening',
      description: 'A space to write, sketch, make something, or simply begin.',
      layoutClass: 'qp-place-standard',
      renderIllustration: () => (
        <svg viewBox="0 0 380 240" className="qp-card-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="380" height="240" fill="#F8F3E8" />
          {/* Warm evening room & desk glow */}
          <circle cx="280" cy="70" r="60" fill="#FCFAF5" opacity="0.9" />
          <circle cx="280" cy="70" r="30" fill="#F4A09A" opacity="0.3" />
          {/* Desk Lamp */}
          <path d="M280 40 L 250 80 L 310 80 Z" fill="#365B51" />
          <line x1="280" y1="80" x2="280" y2="150" stroke="#173B35" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="280" cy="150" rx="18" ry="5" fill="#173B35" />
          {/* Wooden desk surface */}
          <rect x="0" y="150" width="380" height="90" fill="#EFE8D8" />
          {/* Open Notebook & Pen */}
          <rect x="70" y="165" width="90" height="55" rx="3" fill="#FCFAF5" stroke="#78958B" strokeWidth="1.5" />
          <line x1="115" y1="165" x2="115" y2="220" stroke="#B3CBC3" strokeWidth="1.5" />
          <line x1="80" y1="180" x2="105" y2="180" stroke="#B3CBC3" strokeWidth="1" />
          <line x1="80" y1="192" x2="105" y2="192" stroke="#B3CBC3" strokeWidth="1" />
          <line x1="125" y1="180" x2="150" y2="180" stroke="#B3CBC3" strokeWidth="1" />
          <line x1="125" y1="192" x2="145" y2="192" stroke="#B3CBC3" strokeWidth="1" />
          {/* Ceramic plant pot */}
          <path d="M190 175 L 195 205 L 215 205 L 220 175 Z" fill="#E96F67" />
          <path d="M205 175 Q 200 155 190 150 Q 205 160 205 175" stroke="#173B35" strokeWidth="2" fill="none" />
          <path d="M205 175 Q 215 152 225 155 Q 215 165 205 175" stroke="#365B51" strokeWidth="2" fill="none" />
        </svg>
      )
    },
    {
      id: 'by-the-water',
      category: 'REFLECTION',
      title: 'By the Water',
      description: 'Let the noise settle for a while.',
      layoutClass: 'qp-place-wide',
      renderIllustration: () => (
        <svg viewBox="0 0 1180 260" className="qp-card-svg" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="waterSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F8F3E8" />
              <stop offset="60%" stopColor="#EAF3EE" />
              <stop offset="100%" stopColor="#DCEBE4" />
            </linearGradient>
            <linearGradient id="lakeWater" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5B8276" />
              <stop offset="100%" stopColor="#173B35" />
            </linearGradient>
          </defs>
          <rect width="1180" height="260" fill="url(#waterSky)" />
          {/* Distant soft hills */}
          <path d="M0 130 Q 300 70 600 110 T 1180 90 L 1180 260 L 0 260 Z" fill="#8DAFA4" opacity="0.6" />
          <path d="M0 150 Q 240 100 520 135 T 1180 120 L 1180 260 L 0 260 Z" fill="#365B51" opacity="0.8" />
          {/* Gentle Lake Surface */}
          <rect y="165" width="1180" height="95" fill="url(#lakeWater)" />
          {/* Water Ripples */}
          <line x1="200" y1="185" x2="380" y2="185" stroke="#DCEBE4" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
          <line x1="600" y1="195" x2="840" y2="195" stroke="#DCEBE4" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
          <line x1="320" y1="215" x2="520" y2="215" stroke="#DCEBE4" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
          <line x1="820" y1="225" x2="980" y2="225" stroke="#DCEBE4" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
          {/* Small wooden dock pier */}
          <polygon points="120,260 150,190 190,190 220,260" fill="#EFE8D8" stroke="#173B35" strokeWidth="1.5" />
        </svg>
      )
    }
  ];

  return (
    <section className="qp-discovery-section" id="explore">
      <div className="qp-container">
        {/* Section Header */}
        <div className="qp-discovery-header">
          <div>
            <h2 className="qp-heading-2">
              Places worth slowing down for.
            </h2>
            <p className="qp-body" style={{ marginTop: 'var(--space-8)' }}>
              Little worlds for the moments when you need to step away, breathe, and reset.
            </p>
          </div>
          <a href="#view-all" className="qp-view-all-link">
            <span>View all</span>
            <ArrowRight size={15} strokeWidth={2} />
          </a>
        </div>

        {/* Editorial Asymmetric Grid */}
        <div className="qp-discovery-grid">
          {/* 1. Large Featured: Forest Morning (Top Left) */}
          <div className="qp-place-card qp-place-forest">
            <div className="qp-place-img-box">
              {places[0].renderIllustration()}
            </div>
            <div className="qp-place-meta">
              <span className="qp-place-category">{places[0].category}</span>
              <h3 className="qp-place-title">
                <span>{places[0].title}</span>
                <ArrowUpRight className="qp-place-arrow" size={18} />
              </h3>
              <p className="qp-place-desc">{places[0].description}</p>
            </div>
          </div>

          {/* Right Column Stack: Rainy Afternoon & Creative Evening */}
          <div className="qp-discovery-subgrid">
            {/* 2. Rainy Afternoon */}
            <div className="qp-place-card qp-place-standard">
              <div className="qp-place-img-box">
                {places[1].renderIllustration()}
              </div>
              <div className="qp-place-meta">
                <span className="qp-place-category">{places[1].category}</span>
                <h3 className="qp-place-title">
                  <span>{places[1].title}</span>
                  <ArrowUpRight className="qp-place-arrow" size={18} />
                </h3>
                <p className="qp-place-desc">{places[1].description}</p>
              </div>
            </div>

            {/* 3. Creative Evening */}
            <div className="qp-place-card qp-place-standard">
              <div className="qp-place-img-box">
                {places[2].renderIllustration()}
              </div>
              <div className="qp-place-meta">
                <span className="qp-place-category">{places[2].category}</span>
                <h3 className="qp-place-title">
                  <span>{places[2].title}</span>
                  <ArrowUpRight className="qp-place-arrow" size={18} />
                </h3>
                <p className="qp-place-desc">{places[2].description}</p>
              </div>
            </div>
          </div>

          {/* 4. Wide Bottom Span: By the Water */}
          <div className="qp-place-card qp-place-wide">
            <div className="qp-place-img-box">
              {places[3].renderIllustration()}
            </div>
            <div className="qp-place-meta">
              <span className="qp-place-category">{places[3].category}</span>
              <h3 className="qp-place-title">
                <span>{places[3].title}</span>
                <ArrowUpRight className="qp-place-arrow" size={18} />
              </h3>
              <p className="qp-place-desc">{places[3].description}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
