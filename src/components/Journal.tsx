import React from 'react';
import { ArrowUpRight, Clock } from 'lucide-react';

interface Article {
  id: string;
  category: 'ATTENTION' | 'CREATIVITY' | 'SLOW LIVING';
  title: string;
  excerpt: string;
  readTime: string;
}

const ARTICLES: Article[] = [
  {
    id: 'art-1',
    category: 'ATTENTION',
    title: 'Why your brain needs moments of doing nothing',
    excerpt: "We've become remarkably good at filling every quiet moment. But sometimes the space between tasks is where our best ideas begin.",
    readTime: '5 min read'
  },
  {
    id: 'art-2',
    category: 'CREATIVITY',
    title: 'Making creativity part of an ordinary day',
    excerpt: "You don't need a studio, an afternoon, or perfect conditions to make something. Start with ten minutes.",
    readTime: '4 min read'
  },
  {
    id: 'art-3',
    category: 'SLOW LIVING',
    title: 'The small rituals that make a day feel slower',
    excerpt: 'A morning walk. A notebook beside the bed. Tea before opening your inbox. Small rituals can change the texture of an entire day.',
    readTime: '6 min read'
  }
];

export const Journal: React.FC = () => {
  return (
    <section className="qp-journal-section" id="journal">
      <div className="qp-container">
        {/* Section Header */}
        <div className="qp-journal-header">
          <div className="qp-eyebrow" style={{ marginBottom: 'var(--space-12)' }}>
            From the Journal
          </div>
          <h2 className="qp-heading-2" style={{ marginBottom: 'var(--space-12)' }}>
            Things worth thinking about.
          </h2>
          <p className="qp-body" style={{ maxWidth: '640px' }}>
            Notes on creativity, attention, rest, and finding a little more space in an increasingly busy day.
          </p>
        </div>

        {/* Editorial Journal Layout: 1 Featured Large Story + 2 Stacked Stories */}
        <div className="qp-journal-grid">
          {/* Main Featured Article (Left) */}
          <article className="qp-journal-card qp-journal-featured">
            <div className="qp-journal-featured-art">
              <svg viewBox="0 0 540 260" className="qp-card-svg" xmlns="http://www.w3.org/2000/svg">
                <rect width="540" height="260" fill="#EAF3EE" />
                {/* Abstract mindful ripple circles */}
                <circle cx="270" cy="130" r="100" stroke="#B3CBC3" strokeWidth="1.5" fill="none" opacity="0.4" />
                <circle cx="270" cy="130" r="70" stroke="#78958B" strokeWidth="1.5" fill="none" opacity="0.6" />
                <circle cx="270" cy="130" r="40" stroke="#365B51" strokeWidth="2" fill="none" opacity="0.8" />
                <circle cx="270" cy="130" r="14" fill="#E96F67" />
                <path d="M120 180 Q 270 140 420 180" stroke="#78958B" strokeWidth="2" fill="none" strokeDasharray="4 6" />
              </svg>
            </div>

            <div className="qp-journal-content">
              <div className="qp-journal-meta">
                <span className="qp-journal-cat">{ARTICLES[0].category}</span>
                <span className="qp-journal-time">
                  <Clock size={13} /> {ARTICLES[0].readTime}
                </span>
              </div>

              <h3 className="qp-journal-title qp-journal-featured-title">
                <span>{ARTICLES[0].title}</span>
                <ArrowUpRight className="qp-journal-arrow" size={22} strokeWidth={2} />
              </h3>

              <p className="qp-journal-excerpt">
                {ARTICLES[0].excerpt}
              </p>
            </div>
          </article>

          {/* Secondary Stack (Right) */}
          <div className="qp-journal-side-stack">
            {ARTICLES.slice(1).map((article) => (
              <article key={article.id} className="qp-journal-card qp-journal-side">
                <div className="qp-journal-content">
                  <div className="qp-journal-meta">
                    <span className="qp-journal-cat">{article.category}</span>
                    <span className="qp-journal-time">
                      <Clock size={13} /> {article.readTime}
                    </span>
                  </div>

                  <h3 className="qp-journal-title">
                    <span>{article.title}</span>
                    <ArrowUpRight className="qp-journal-arrow" size={18} strokeWidth={2} />
                  </h3>

                  <p className="qp-journal-excerpt">
                    {article.excerpt}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
