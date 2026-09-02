import React from 'react';
import { BookOpen, Compass, Bell, ArrowUpRight } from 'lucide-react';

interface FeatureItem {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  bgClass: string;
}

const FEATURES: FeatureItem[] = [
  {
    number: '01',
    title: 'Mindful Tools',
    description: 'Simple journals, prompts, and exercises designed to help you pause and reflect.',
    icon: <BookOpen size={22} strokeWidth={1.75} />,
    bgClass: 'qp-feature-card-cream'
  },
  {
    number: '02',
    title: 'Creative Spaces',
    description: 'Room to write, sketch, read, or simply let your thoughts wander.',
    icon: <Compass size={22} strokeWidth={1.75} />,
    bgClass: 'qp-feature-card-mint'
  },
  {
    number: '03',
    title: 'Gentle Reminders',
    description: 'Small invitations to slow down before the day moves on without you.',
    icon: <Bell size={22} strokeWidth={1.75} />,
    bgClass: 'qp-feature-card-cream'
  }
];

export const Features: React.FC = () => {
  return (
    <section className="qp-features-section" id="how-it-works">
      <div className="qp-container">
        {/* Section Header */}
        <div className="qp-features-header">
          <h2 className="qp-features-title">
            Take a little time for yourself.
          </h2>
          <p className="qp-features-subtitle">
            Quiet moments don&rsquo;t need to be complicated. A few intentional minutes can change the way the rest of your day feels.
          </p>
        </div>

        {/* 3-Column Editorial Grid */}
        <div className="qp-features-grid">
          {FEATURES.map((item) => (
            <div key={item.number} className={`qp-feature-card ${item.bgClass}`}>
              <div className="qp-feature-top">
                <span className="qp-feature-number">{item.number}</span>
                <div className="qp-feature-icon-box">
                  {item.icon}
                </div>
              </div>

              <div className="qp-feature-content">
                <h3 className="qp-feature-card-title">
                  <span>{item.title}</span>
                  <ArrowUpRight className="qp-feature-arrow" size={18} strokeWidth={2} />
                </h3>
                <p className="qp-feature-card-desc">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
