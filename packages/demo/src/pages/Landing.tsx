import React, { useState, useEffect } from 'react';
import './landing.css';
import { Navbar } from '../components/Navbar';
import { DSAVisualization } from '../components/DSAVisualization';
import { CodeToVizSection } from '../components/CodeToVizSection';
import { AQVLVsThreeJSSection } from '../components/AQVLVsThreeJSSection';
import { PipelineSection } from '../components/PipelineSection';
import { FeaturesSection } from '../components/FeaturesSection';
import { Footer } from '../components/Footer';
/* ── Icons ─────────────────────────────────────────────────── */
const ArrowIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);

const PlayCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polygon points="10 8 16 12 10 16 10 8"/>
  </svg>
);

const BookOpenIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);

const SparkleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
  </svg>
);

/* ── Decorative SVG Components ─────────────────────────────── */
const AxesDecoration = ({ style }: { style?: React.CSSProperties }) => (
  <div className="landing-deco" style={style}>
    <svg viewBox="0 0 110 110" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="38" y1="72" x2="12" y2="96" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="38" y1="72" x2="38" y2="18" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"/>
      <polygon points="34,22 38,12 42,22" fill="#f59e0b" stroke="none"/>
      <line x1="38" y1="72" x2="92" y2="72" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"/>
      <polygon points="88,68 98,72 88,76" fill="#f59e0b" stroke="none"/>
      <text x="4" y="107" fontSize="11" fill="currentColor" stroke="none" fontWeight="700" fontFamily="Space Grotesk, sans-serif">z</text>
      <text x="26" y="11" fontSize="11" fill="currentColor" stroke="none" fontWeight="700" fontFamily="Space Grotesk, sans-serif">y</text>
      <text x="94" y="90" fontSize="11" fill="currentColor" stroke="none" fontWeight="700" fontFamily="Space Grotesk, sans-serif">x</text>
    </svg>
  </div>
);

const CubeDecoration = ({ style }: { style?: React.CSSProperties }) => (
  <div className="landing-deco" style={style}>
    <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M50 18 L82 35 L82 68 L50 85 L18 68 L18 35 Z" strokeLinejoin="round"/>
      <line x1="50" y1="18" x2="50" y2="52"/>
      <line x1="50" y1="52" x2="82" y2="35"/>
      <line x1="50" y1="52" x2="18" y2="35"/>
      <line x1="50" y1="52" x2="50" y2="85" strokeDasharray="4 4"/>
    </svg>
  </div>
);

const CrossDecoration = ({ style, color }: { style?: React.CSSProperties; color?: string }) => (
  <div className="landing-deco" style={{ color: color || 'var(--deco-color)', ...style }}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <line x1="12" y1="2" x2="12" y2="22"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
    </svg>
  </div>
);

const DotGrid = ({ cols, rows, style, color }: {
  cols: number; rows: number;
  style?: React.CSSProperties;
  color?: string;
}) => (
  <div style={{
    position: 'absolute',
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 7px)`,
    gridTemplateRows: `repeat(${rows}, 7px)`,
    gap: '4px',
    pointerEvents: 'none',
    zIndex: 5,
    ...style
  }}>
    {Array.from({ length: cols * rows }).map((_, i) => (
      <span key={i} style={{
        width: '4px', height: '4px',
        borderRadius: '50%',
        background: color || 'var(--deco-color)',
        opacity: 0.5,
        display: 'block'
      }}/>
    ))}
  </div>
);

const CustomCursor = () => {
  const cursorRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ticking = false;
    let mouseX = -100;
    let mouseY = -100;

    const moveCursor = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!ticking) {
        requestAnimationFrame(() => {
          if (cursorRef.current) {
            cursorRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('mousemove', moveCursor, { passive: true });

    return () => {
      window.removeEventListener('mousemove', moveCursor);
    };
  }, []);

  return (
    <div 
      ref={cursorRef}
      className="custom-cursor-wrapper"
      style={{ transform: 'translate3d(-100px, -100px, 0)' }}
    >
      <div className="scroll-cube-container">
        <div className="scroll-cube">
          <div className="scroll-cube-face scroll-cube-face--front" />
          <div className="scroll-cube-face scroll-cube-face--back" />
          <div className="scroll-cube-face scroll-cube-face--right" />
          <div className="scroll-cube-face scroll-cube-face--left" />
          <div className="scroll-cube-face scroll-cube-face--top" />
          <div className="scroll-cube-face scroll-cube-face--bottom" />
        </div>
      </div>
    </div>
  );
};

const BackgroundDecorations = ({ isDark }: { isDark: boolean }) => {
  const elements = [
    // Section 1 / Top
    { type: 'text', content: 'DSA', top: '5%', left: '8%', rot: -15, delay: 0, color: 'var(--purple)', size: '20px' },
    { type: 'text', content: '{ }', top: '8%', left: '85%', rot: 10, delay: 1, color: 'var(--blue)', size: '24px' },
    { type: 'text', content: 'Tree', top: '15%', left: '15%', rot: -5, delay: 2, color: 'var(--green)' },
    { type: 'text', content: 'Graph', top: '12%', left: '75%', rot: 25, delay: 0.5, color: 'var(--pink)' },
    { type: 'text', content: 'O(log n)', top: '18%', left: '5%', rot: -20, delay: 1.5, color: 'var(--yellow)' },
    { type: 'text', content: 'Stack', top: '22%', left: '88%', rot: 15, delay: 2.5, color: 'var(--text-muted)' },
    
    // Section 2
    { type: 'text', content: '( )', top: '30%', left: '90%', rot: 0, delay: 0, color: 'var(--text-muted)', size: '28px' },
    { type: 'text', content: 'Queue', top: '28%', left: '12%', rot: -10, delay: 1, color: 'var(--blue)' },
    { type: 'text', content: '< >', top: '35%', left: '8%', rot: 5, delay: 2, color: 'var(--green)', size: '22px' },
    { type: 'text', content: '[ ]', top: '38%', left: '85%', rot: -15, delay: 0.5, color: 'var(--purple)', size: '26px' },
    { type: 'text', content: 'Heap', top: '42%', left: '25%', rot: -5, delay: 1.2, color: 'var(--pink)' },
    
    // Section 3
    { type: 'text', content: 'O(1)', top: '50%', left: '15%', rot: 10, delay: 0.8, color: 'var(--yellow)' },
    { type: 'text', content: 'Trie', top: '48%', left: '85%', rot: -8, delay: 0.3, color: 'var(--text-muted)' },
    { type: 'text', content: 'BFS', top: '55%', left: '8%', rot: 12, delay: 1.8, color: 'var(--green)' },
    { type: 'text', content: 'DFS', top: '58%', left: '92%', rot: -18, delay: 0.7, color: 'var(--blue)' },
    
    // Section 4
    { type: 'text', content: 'Sort', top: '65%', left: '18%', rot: 22, delay: 1.4, color: 'var(--purple)' },
    { type: 'text', content: 'Search', top: '68%', left: '78%', rot: 14, delay: 0.9, color: 'var(--pink)' },
    { type: 'text', content: 'Array', top: '75%', left: '12%', rot: -12, delay: 2.1, color: 'var(--text-muted)' },
    { type: 'text', content: 'Linked List', top: '78%', left: '88%', rot: 8, delay: 2.3, color: 'var(--green)' },

    // Section 5 / Bottom
    { type: 'text', content: 'AQVL', top: '85%', left: '5%', rot: -15, delay: 0, color: 'var(--yellow)', size: '20px' },
    { type: 'text', content: '{ }', top: '88%', left: '85%', rot: 10, delay: 1, color: 'var(--blue)' },
    { type: 'text', content: 'Tree', top: '92%', left: '15%', rot: -5, delay: 2, color: 'var(--pink)' },
    { type: 'text', content: 'Graph', top: '95%', left: '90%', rot: 25, delay: 0.5, color: 'var(--purple)' },
    { type: 'text', content: 'O(n log n)', top: '98%', left: '10%', rot: -20, delay: 1.5, color: 'var(--text-muted)' },
    
    // Middle scatter
    { type: 'text', content: 'Node', top: '25%', left: '45%', rot: 15, delay: 2.5, color: 'var(--green)' },
    { type: 'text', content: 'Edge', top: '45%', left: '60%', rot: -10, delay: 0.5, color: 'var(--purple)' },
    { type: 'text', content: 'Root', top: '62%', left: '35%', rot: 5, delay: 1.2, color: 'var(--pink)' },
    { type: 'text', content: 'Leaf', top: '82%', left: '55%', rot: -8, delay: 0.8, color: 'var(--yellow)' },
  ];

  return (
    <>
      {elements.map((el, i) => (
        <div key={`text-${i}`} className="landing-deco bg-deco-text" style={{
          top: el.top, left: el.left,
          color: el.color,
          fontSize: el.size || '16px',
          animation: `floatY ${6 + (i % 4)}s ease-in-out infinite`,
          animationDelay: `${el.delay}s`,
          transform: `rotate(${el.rot}deg)`
        }}>
          {el.content}
        </div>
      ))}
      
      {/* Extra Geometric Shapes */}
      <CubeDecoration style={{
        top: '25%', right: '10%',
        width: '40px', height: '40px',
        color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        animation: 'floatY 9s ease-in-out infinite',
      }}/>
      <CubeDecoration style={{
        top: '70%', left: '8%',
        width: '30px', height: '30px',
        color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        animation: 'floatY 12s ease-in-out infinite reverse',
      }}/>
      <AxesDecoration style={{
        top: '55%', right: '5%',
        width: '60px', height: '60px',
        color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
        animation: 'floatX 10s ease-in-out infinite',
      }}/>
      <CrossDecoration
        color={isDark ? 'rgba(52,211,153,0.3)' : 'rgba(52,211,153,0.5)'}
        style={{
          top: '45%', left: '15%',
          width: '18px', height: '18px',
          animation: 'floatX 5s ease-in-out infinite reverse',
        }}
      />
      <CrossDecoration
        color={isDark ? 'rgba(244,114,182,0.3)' : 'rgba(244,114,182,0.5)'}
        style={{
          top: '85%', right: '20%',
          width: '24px', height: '24px',
          animation: 'floatY 7s ease-in-out infinite',
        }}
      />
    </>
  );
};



/* ══════════════════════════════════════════════════════════════
   Main Landing Component
═══════════════════════════════════════════════════════════════ */
export default function Landing() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem('aqvl-docs-theme') ?? 'dark') as 'light' | 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('aqvl-docs-theme', next);
  };

  const isDark = theme === 'dark';

  return (
    <div className="landing-root" data-theme={theme}>

      {/* ── Navbar ── */}
      <Navbar theme={theme} onToggleTheme={toggleTheme} />

      {/* ── Ambient Background Decorations ── */}
      <AxesDecoration style={{
        top: '22%', left: '2%',
        width: '110px', height: '110px',
        color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.2)',
        animation: 'floatY 8s ease-in-out infinite',
      }}/>

      <CubeDecoration style={{
        top: '60%', left: '1.5%',
        width: '60px', height: '60px',
        color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
        animation: 'floatY 11s ease-in-out infinite reverse',
      }}/>

      <CrossDecoration
        color={isDark ? 'rgba(168,85,247,0.6)' : 'rgba(168,85,247,0.45)'}
        style={{
          top: '75%', left: '2%',
          width: '26px', height: '26px',
          animation: 'floatX 5s ease-in-out infinite',
        }}
      />

      <DotGrid cols={5} rows={4} color={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'}
        style={{ top: '14%', right: '2%' }}
      />

      <CrossDecoration
        color={isDark ? 'rgba(96,165,250,0.6)' : 'rgba(59,130,246,0.5)'}
        style={{
          top: '12%', left: '40%',
          width: '20px', height: '20px',
          animation: 'floatY 7s ease-in-out infinite',
        }}
      />

      <CrossDecoration
        color={isDark ? 'rgba(253,224,71,0.7)' : 'rgba(161,140,0,0.45)'}
        style={{
          top: '28%', right: '1.5%',
          width: '20px', height: '20px',
          animation: 'floatX 6s ease-in-out infinite reverse',
        }}
      />

      <BackgroundDecorations isDark={isDark} />

      <CustomCursor />

      {/* ── Main Content ── */}
      <div className="landing-content">

        {/* ════════════════════════════════════════
            SECTION 1: HERO
        ════════════════════════════════════════ */}
        <section
          className={`landing-hero-section ${mounted ? 'landing-hero-section--mounted' : ''}`}
          aria-label="Hero section"
          id="hero"
          style={{ position: 'relative' }}
        >

          {/* Left: Value Proposition */}
          <div className="hero-left">

            {/* Status badge */}
            <div className="hero-tag-row">
              <span className="hero-tag">
                <SparkleIcon />
                Now in Beta
              </span>
              <span className="hero-tag hero-tag--outline">
                DSA · v0.1
              </span>
            </div>

            {/* Title */}
            <h1 className="hero-title" id="hero-headline">
              <span className="hero-title-line">Visualize</span>
              <span className="hero-title-line hero-title-line--accent">
                Algorithms
                <span className="hero-title-underline-svg" aria-hidden="true">
                  <svg viewBox="0 0 260 12" preserveAspectRatio="none" fill="none">
                    <path
                      d="M0 9 Q 32 3 65 9 Q 97 14 130 9 Q 162 3 195 9 Q 228 14 260 9"
                      stroke={isDark ? '#a78bfa' : '#7c3aed'}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </span>
              <span className="hero-title-line">in 3D.</span>
            </h1>

            {/* Description */}
            <p className="hero-description">
              AQVL is a declarative language that turns data structures and algorithms
              into interactive, animated 3D scenes — built for educators and engineers who
              want to <strong>show</strong> how algorithms think, not just explain them.
            </p>

            {/* Feature chips */}
            <div className="hero-chips">
              <span className="hero-chip hero-chip--blue">Binary Trees</span>
              <span className="hero-chip hero-chip--purple">Graph Traversal</span>
              <span className="hero-chip hero-chip--green">Sorting</span>
              <span className="hero-chip hero-chip--yellow">Linked Lists</span>
            </div>

            {/* CTA Buttons */}
            <div className="hero-ctas" role="group" aria-label="Primary calls to action">
              <a
                href="#/playground"
                className="hero-cta hero-cta--primary"
                id="hero-cta-playground"
              >
                <PlayCircleIcon />
                <span>Open Playground</span>
                <span className="hero-cta-arrow"><ArrowIcon /></span>
              </a>

              <a
                href="#/docs"
                className="hero-cta hero-cta--secondary"
                id="hero-cta-docs"
              >
                <BookOpenIcon />
                <span>Documentation</span>
              </a>
            </div>

            {/* Trust row */}
            <div className="hero-trust-row">
              <div className="hero-trust-item">
                <span className="hero-trust-dot hero-trust-dot--green" />
                <span>Sub-ms compilation</span>
              </div>
              <div className="hero-trust-item">
                <span className="hero-trust-dot hero-trust-dot--blue" />
                <span>60 FPS rendering</span>
              </div>
              <div className="hero-trust-item">
                <span className="hero-trust-dot hero-trust-dot--purple" />
                <span>Zero boilerplate</span>
              </div>
            </div>
          </div>

          {/* Right: 3D DSA Visualization */}
          <div className="hero-right" aria-label="Live DSA visualization">
            <DSAVisualization />
          </div>
        </section>

        {/* ════════════════════════════════════════
            SECTION 2: CODE TO VIZ SHOWCASE
        ════════════════════════════════════════ */}
        <CodeToVizSection />

        {/* ════════════════════════════════════════
            SECTION 3: FEATURES SHOWCASE
        ════════════════════════════════════════ */}
        <FeaturesSection />

        {/* ════════════════════════════════════════
            SECTION 4: AQVL VS Three.js
        ════════════════════════════════════════ */}
        <AQVLVsThreeJSSection />

        {/* ════════════════════════════════════════
            SECTION 4: COMPILER PIPELINE
        ════════════════════════════════════════ */}
        <PipelineSection />

        {/* ════════════════════════════════════════
            FOOTER
        ════════════════════════════════════════ */}
      </div>
      <Footer />
    </div>
  );
}
