import React, { useEffect, useState } from 'react';
import './features-section.css';

/* ── Icons ─────────────────────────────────────────────────── */
const CodeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

const BoxIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const ZapIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const CPUIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
    <rect x="9" y="9" width="6" height="6" />
    <line x1="9" y1="1" x2="9" y2="4" />
    <line x1="15" y1="1" x2="15" y2="4" />
    <line x1="9" y1="20" x2="9" y2="23" />
    <line x1="15" y1="20" x2="15" y2="23" />
    <line x1="20" y1="9" x2="23" y2="9" />
    <line x1="20" y1="14" x2="23" y2="14" />
    <line x1="1" y1="9" x2="4" y2="9" />
    <line x1="1" y1="14" x2="4" y2="14" />
  </svg>
);

const BrainIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
  </svg>
);

const TerminalIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

/* ── Component ─────────────────────────────────────────────── */
export function FeaturesSection() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section 
      className={`features-section ${mounted ? 'features-section--mounted' : ''}`}
      aria-label="AQVL Features"
      id="features"
    >
      <div className="features-header">
        <div className="features-label">
          <span className="features-label-line" />
          <span className="features-label-text">Features</span>
          <span className="features-label-line" />
        </div>
        <h2 className="features-title">
          Built for <span className="features-title-accent">Power</span> & <span className="features-title-accent">Clarity</span>
        </h2>
        <p className="features-subtitle">
          Everything you need to build interactive educational 3D environments, packed into a robust, declarative language.
        </p>
      </div>

      <div className="features-bento">
        {/* Block 1: Declarative Visualization Language */}
        <div className="feat-card feat-card--large feat-card--purple">
          <div className="feat-card-bg-icon">
            <CodeIcon />
          </div>
          <div className="feat-card-header">
            <div className="feat-icon-wrap feat-icon-wrap--purple">
              <CodeIcon />
            </div>
            <h3 className="feat-card-title">Declarative Visualization Language</h3>
          </div>
          <p className="feat-card-desc">
            Express complex algorithms with semantic syntax. Say exactly <em>what</em> should happen, and AQVL handles the <em>how</em> of 3D animation, state management, and camera framing.
          </p>
          <div className="feat-card-interactive">
            <div className="feat-pseudo-code">
              <code>SCENE "Binary Tree"</code>
              <code>DECLARE BINARY_TREE bst</code>
              <code>ROOT 50</code>
            </div>
          </div>
        </div>

        {/* Block 2: Real-Time 3D Rendering */}
        <div className="feat-card feat-card--tall feat-card--yellow">
          <div className="feat-card-bg-icon">
            <BoxIcon />
          </div>
          <div className="feat-card-header">
            <div className="feat-icon-wrap feat-icon-wrap--yellow">
              <BoxIcon />
            </div>
            <h3 className="feat-card-title">Real-Time 3D Rendering</h3>
          </div>
          <p className="feat-card-desc">
            Silky smooth 60 FPS graphics powered by WebGL. Automatic lighting, shadows, and camera transitions make every scene look professional out of the box.
          </p>
          <div className="feat-card-cube-anim">
            <div className="feat-cube-wrapper">
              <div className="feat-cube-face feat-cube-front"></div>
              <div className="feat-cube-face feat-cube-back"></div>
              <div className="feat-cube-face feat-cube-right"></div>
              <div className="feat-cube-face feat-cube-left"></div>
              <div className="feat-cube-face feat-cube-top"></div>
              <div className="feat-cube-face feat-cube-bottom"></div>
            </div>
          </div>
        </div>

        {/* Block 3: Interactive Algorithm Animations */}
        <div className="feat-card feat-card--blue">
          <div className="feat-card-header">
            <div className="feat-icon-wrap feat-icon-wrap--blue">
              <ZapIcon />
            </div>
            <h3 className="feat-card-title">Interactive Animations</h3>
          </div>
          <p className="feat-card-desc">
            Granular execution control. Pause, step forward, or scrub backwards through complex algorithmic states in real-time.
          </p>
          <div className="feat-card-scrubber">
            <div className="feat-scrub-bar">
              <div className="feat-scrub-progress"></div>
              <div className="feat-scrub-handle"></div>
            </div>
          </div>
        </div>

        {/* Block 4: Built for DSA */}
        <div className="feat-card feat-card--green">
          <div className="feat-card-header">
            <div className="feat-icon-wrap feat-icon-wrap--green">
              <BrainIcon />
            </div>
            <h3 className="feat-card-title">Built for DSA & Beyond</h3>
          </div>
          <p className="feat-card-desc">
            Natively understands Trees, Graphs, and Arrays. Easily extensible for AI/ML tensors, Neural Networks, and Blockchain ledgers.
          </p>
          <div className="feat-tags">
            <span className="feat-tag">Sorting</span>
            <span className="feat-tag">Graphs</span>
            <span className="feat-tag">AI/ML</span>
          </div>
        </div>

        {/* Block 5: Compiler-Driven Architecture */}
        <div className="feat-card feat-card--wide feat-card--dark">
          <div className="feat-card-header">
            <div className="feat-icon-wrap feat-icon-wrap--white">
              <CPUIcon />
            </div>
            <h3 className="feat-card-title">Compiler-Driven Architecture</h3>
          </div>
          <p className="feat-card-desc">
            A true programming language under the hood. Our Lexer, Parser, and custom AQIR (Intermediate Representation) ensure extreme performance and safety for complex visual logic.
          </p>
          <div className="feat-pipeline-vis">
            <div className="feat-pipe-node">Source</div>
            <div className="feat-pipe-arrow">→</div>
            <div className="feat-pipe-node">AST</div>
            <div className="feat-pipe-arrow">→</div>
            <div className="feat-pipe-node">AQIR</div>
            <div className="feat-pipe-arrow">→</div>
            <div className="feat-pipe-node feat-pipe-node--glow">WebGL Engine</div>
          </div>
        </div>

        {/* Block 6: Developer-Friendly Stack */}
        <div className="feat-card feat-card--pink">
          <div className="feat-card-header">
            <div className="feat-icon-wrap feat-icon-wrap--pink">
              <TerminalIcon />
            </div>
            <h3 className="feat-card-title">Modern Web Stack</h3>
          </div>
          <p className="feat-card-desc">
            Drop-in React component integration. Export your scenes and embed them into any modern web application effortlessly.
          </p>
        </div>
      </div>
    </section>
  );
}
