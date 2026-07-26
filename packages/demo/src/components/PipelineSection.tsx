import React, { useEffect, useState, useRef } from 'react';
import './pipeline.css';

/* ── Icons ───────────────────────────────────────────────────────────── */
const CodeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6"/>
    <polyline points="8 6 2 12 8 18"/>
  </svg>
);

const LexerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <line x1="3" y1="9" x2="21" y2="9"/>
    <line x1="9" y1="21" x2="9" y2="9"/>
  </svg>
);

const ParserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v18"/>
    <path d="M5 8h14"/>
    <path d="M5 16h14"/>
  </svg>
);

const AstIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="3"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <circle cx="12" cy="15" r="3"/>
    <line x1="10" y1="17" x2="7" y2="20"/>
    <line x1="14" y1="17" x2="17" y2="20"/>
  </svg>
);

const OptimizerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const AqirIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
  </svg>
);

const RendererIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polygon points="10 8 16 12 10 16 10 8"/>
  </svg>
);

const VizIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);

/* ── Configuration ───────────────────────────────────────────────────── */
const STAGES = [
  { id: 'code',      label: 'AQVL Code',       desc: 'Raw script',         color: 'yellow', icon: <CodeIcon />,      term: 'aqvl build index.aqvl' },
  { id: 'lexer',     label: 'Lexer',           desc: 'Token stream',       color: 'yellow', icon: <LexerIcon />,     term: '[Lexer] 42 tokens' },
  { id: 'parser',    label: 'Parser',          desc: 'Syntax analysis',    color: 'purple', icon: <ParserIcon />,    term: '[Parser] syntax OK' },
  { id: 'ast',       label: 'AST',             desc: 'Syntax Tree',        color: 'purple', icon: <AstIcon />,       term: '[AST] 18 nodes built' },
  { id: 'optimizer', label: 'Optimizer',       desc: 'Dead code removal',  color: 'blue',   icon: <OptimizerIcon />, term: '[Opt] -4 nodes' },
  { id: 'aqir',      label: 'AQIR',            desc: 'Intermediate rep',   color: 'blue',   icon: <AqirIcon />,      term: '[IR] Generated' },
  { id: 'renderer',  label: 'AQVE Renderer',   desc: 'Layout engine',      color: 'green',  icon: <RendererIcon />,  term: '[Render] Engine layout' },
  { id: 'viz',       label: 'Interactive 3D',  desc: 'Final scene',        color: 'green',  icon: <VizIcon />,       term: '[Scene] Mounted & live' },
];

/* ── Helper Component for a Stage Card ───────────────────────────────── */
function StageCard({ stage, index, activeStage }: { stage: any, index: number, activeStage: number }) {
  const isActive = activeStage === index;
  const isCompleted = activeStage > index;
  const isPending = activeStage < index;
  
  const statusClass = isActive ? 'active' : isCompleted ? 'completed' : 'pending';
  const colorClass = `color-${stage.color}`;

  return (
    <div className={`pipeline-stage ${statusClass} ${colorClass}`}>
      {/* Top Bar */}
      <div className="pipeline-stage-topbar">
        <div className="pipeline-stage-dots">
          <span className="ps-dot" />
          <span className="ps-dot" />
          <span className="ps-dot" />
        </div>
        <div className="pipeline-stage-num">
          0{index + 1}
        </div>
      </div>

      {/* Content */}
      <div className="pipeline-stage-content">
        <div className="pipeline-stage-icon-wrap">
          <div className="pipeline-stage-icon">{stage.icon}</div>
        </div>
        <div className="pipeline-stage-info">
          <h3 className="pipeline-stage-label">{stage.label}</h3>
          <p className="pipeline-stage-desc">{stage.desc}</p>
        </div>
      </div>

      {/* Terminal */}
      <div className="pipeline-terminal">
        <div className="pipeline-terminal-header">
          <span>Output</span>
          <div className="pipeline-terminal-status" />
        </div>
        <div className="pipeline-terminal-body">
          <span className="pipeline-terminal-text">
            {isActive || isCompleted ? `> ${stage.term}` : '> Waiting...'}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────────── */
export function PipelineSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeStage, setActiveStage] = useState(-1);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !mounted) {
          setMounted(true);
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    return () => observer.disconnect();
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    
    let currentStage = 0;
    // Animate stage sequence. We give 1400ms per stage for the "pulse" to travel and text to type.
    const interval = setInterval(() => {
      setActiveStage(currentStage);
      currentStage++;
      if (currentStage > STAGES.length) {
        clearInterval(interval);
      }
    }, 1400); 

    return () => clearInterval(interval);
  }, [mounted]);

  return (
    <section 
      className={`pipeline-section ${mounted ? 'pipeline-section--mounted' : ''}`} 
      ref={sectionRef} 
      aria-label="AQVL Compiler Pipeline" 
      id="pipeline-section"
    >
       <div className="pipeline-header">
           <div className="pipeline-header-label">
             <span className="pipeline-header-label-line" />
             <span className="pipeline-header-label-text">Architecture</span>
             <span className="pipeline-header-label-line" />
           </div>
           <h2 className="pipeline-title">
             The <span className="pipeline-title-accent">Compiler Pipeline.</span>
           </h2>
           <p className="pipeline-subtitle">
             From declarative syntax to interactive 3D structures in under 1 millisecond.
           </p>
       </div>

       <div className="pipeline-container">
          <div className="pipeline-grid">
            
            {/* ── ROW 1: Stages 0 to 3 ── */}
            <div className="pipeline-row pipeline-row--1">
              {STAGES.slice(0, 4).map((stage, i) => (
                <React.Fragment key={stage.id}>
                  <StageCard stage={stage} index={i} activeStage={activeStage} />
                  {i < 3 && (
                    <div className={`pipeline-connector ${activeStage === i ? 'animating' : ''}`}>
                      <div className="pipeline-connector-line" />
                      <div className="pipeline-connector-flow" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* ── VERTICAL CONNECTOR ── */}
            {/* Connects Stage 3 (top right) to Stage 4 (bottom right) */}
            <div className={`pipeline-vertical-conn ${activeStage === 3 ? 'animating' : ''}`}>
              <div className="pipeline-vertical-line">
                 <div className="pipeline-vertical-flow" />
              </div>
            </div>

            {/* ── ROW 2: Stages 4 to 7 (Reversed DOM flow) ── */}
            <div className="pipeline-row pipeline-row--2">
              {STAGES.slice(4, 8).map((stage, offsetI) => {
                const i = offsetI + 4; // actual index 4,5,6,7
                return (
                  <React.Fragment key={stage.id}>
                    <StageCard stage={stage} index={i} activeStage={activeStage} />
                    {offsetI < 3 && (
                      <div className={`pipeline-connector ${activeStage === i ? 'animating' : ''}`}>
                        <div className="pipeline-connector-line" />
                        <div className="pipeline-connector-flow" />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

          </div>
       </div>
    </section>
  );
}
