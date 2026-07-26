import React, { useEffect, useRef, useState, useCallback } from 'react';

/* ─────────────────────────────────────────────────────────────────────────────
   AQVL CODE TO VIZ — Section 2
   Demonstrates: Binary Search Tree construction & traversal
   Layout: Split-screen · Left = animated code editor · Right = live 3D BST
   Everything is automated and loops seamlessly.
───────────────────────────────────────────────────────────────────────────── */

// ── AQVL code lines to type out ─────────────────────────────────────────────
const AQVL_LINES = [
  { text: 'SCENE "Binary Search Tree"',              color: 'kw' },
  { text: '',                                         color: 'plain' },
  { text: 'DECLARE',                                  color: 'kw' },
  { text: '    BINARY_TREE bst',                      color: 'type' },
  { text: '',                                         color: 'plain' },
  { text: 'SEQUENCE',                                 color: 'kw' },
  { text: '    // 1. Build the tree',                 color: 'comment' },
  { text: '    ROOT 50',                              color: 'cmd' },
  { text: '    CHILD 50 30',                          color: 'cmd' },
  { text: '    CHILD 50 70',                          color: 'cmd' },
  { text: '    CHILD 30 20',                          color: 'cmd' },
  { text: '    CHILD 30 40',                          color: 'cmd' },
  { text: '    CHILD 70 60',                          color: 'cmd' },
  { text: '    CHILD 70 80',                          color: 'cmd' },
  { text: '',                                         color: 'plain' },
  { text: '    // 2. Traverse & search',              color: 'comment' },
  { text: '    INORDER',                              color: 'cmd' },
  { text: '    SEARCH 60',                            color: 'cmd' },
  { text: 'END',                                      color: 'kw' },
];

// ── Timing constants (ms) ────────────────────────────────────────────────────
const CHAR_DELAY     = 38;   // ms per character
const LINE_GAP       = 340;  // pause after each line completes
const PHASE_PAUSE    = 900;  // pause before visualization reacts
const LOOP_RESTART   = 3200; // pause at end before restart
const NODE_STAGGER   = 260;  // ms between node appearances in viz

// ── Tree node data ────────────────────────────────────────────────────────────
interface TreeNode {
  id: string;
  val: number;
  x: number; // 0..1 relative SVG coordinate
  y: number;
  parentId: string | null;
  depth: number;
}

const TREE_NODES: TreeNode[] = [
  { id: 'n50', val: 50, x: 0.50, y: 0.11, parentId: null,  depth: 0 },
  { id: 'n30', val: 30, x: 0.28, y: 0.30, parentId: 'n50', depth: 1 },
  { id: 'n70', val: 70, x: 0.72, y: 0.30, parentId: 'n50', depth: 1 },
  { id: 'n20', val: 20, x: 0.14, y: 0.55, parentId: 'n30', depth: 2 },
  { id: 'n40', val: 40, x: 0.40, y: 0.55, parentId: 'n30', depth: 2 },
  { id: 'n60', val: 60, x: 0.60, y: 0.55, parentId: 'n70', depth: 2 },
  { id: 'n80', val: 80, x: 0.86, y: 0.55, parentId: 'n70', depth: 2 },
];

// Lines that trigger node additions (0-indexed line index → node id to reveal)
const LINE_TO_NODE: Record<number, string[]> = {
  7:  ['n50'],
  8:  ['n30'],
  9:  ['n70'],
  10: ['n20'],
  11: ['n40'],
  12: ['n60'],
  13: ['n80'],
};

// Lines that trigger traversal highlight sequence
const INORDER_ORDER  = ['n20','n30','n40','n50','n60','n70','n80'];
const SEARCH_PATH    = ['n50','n70','n60'];

// ── Syntax color map ─────────────────────────────────────────────────────────
function tokenize(line: string, colorKey: string): React.ReactNode {
  if (!line.trim()) return <>&nbsp;</>;

  if (colorKey === 'comment') return <span className="ctv-tok-comment">{line}</span>;
  if (colorKey === 'kw')      return <span className="ctv-tok-kw">{line}</span>;

  if (colorKey === 'type') {
    // "    BINARY_TREE bst"
    const parts = line.trimStart().split(' ');
    return (
      <>
        <span style={{ opacity: 0 }}>{'    '}</span>
        <span className="ctv-tok-type">{parts[0]}</span>
        {' '}
        <span className="ctv-tok-ident">{parts.slice(1).join(' ')}</span>
      </>
    );
  }

  if (colorKey === 'cmd') {
    const trimmed = line.trimStart();
    const indent = line.length - trimmed.length;
    const parts = trimmed.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);
    return (
      <>
        {indent > 0 && <span style={{ opacity: 0 }}>{' '.repeat(indent)}</span>}
        <span className="ctv-tok-cmd">{cmd}</span>
        {args.length > 0 && (
          <>
            {' '}
            {args.map((a, i) => (
              <React.Fragment key={i}>
                {i > 0 && ' '}
                <span className="ctv-tok-num">{a}</span>
              </React.Fragment>
            ))}
          </>
        )}
      </>
    );
  }

  return <span>{line}</span>;
}

// ── Main component ────────────────────────────────────────────────────────────
export function CodeToVizSection() {
  /* State */
  const [visibleLines, setVisibleLines] = useState<{ text: string; colorKey: string }[]>([]);
  const [currentLineIdx, setCurrentLineIdx] = useState(-1);
  const [currentLineTyped, setCurrentLineTyped] = useState('');
  const [activeLine, setActiveLine]   = useState(-1);
  const [revealedNodes, setRevealedNodes]   = useState<Set<string>>(new Set());
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [searchNodes, setSearchNodes] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<'build'|'inorder'|'search'|'done'>('build');
  const [cursorBlink, setCursorBlink] = useState(true);
  const [mounted, setMounted] = useState(false);

  const codeScrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const delay = (ms: number) => new Promise<void>(res => {
    timerRef.current = setTimeout(res, ms);
  });

  /* Cursor blinking */
  useEffect(() => {
    const id = setInterval(() => setCursorBlink(b => !b), 530);
    return () => clearInterval(id);
  }, []);

  /* Auto-scroll code panel */
  useEffect(() => {
    if (codeScrollRef.current) {
      codeScrollRef.current.scrollTop = codeScrollRef.current.scrollHeight;
    }
  }, [visibleLines, currentLineTyped]);

  /* ── Main animation loop ─────────────────────────────────── */
  const runLoop = useCallback(async () => {
    cancelRef.current = false;

    // Reset
    setVisibleLines([]);
    setCurrentLineIdx(-1);
    setCurrentLineTyped('');
    setActiveLine(-1);
    setRevealedNodes(new Set());
    setHighlightedNodes(new Set());
    setSearchNodes(new Set());
    setPhase('build');

    await delay(600);
    if (cancelRef.current) return;

    // Type each line
    for (let li = 0; li < AQVL_LINES.length; li++) {
      if (cancelRef.current) return;
      const { text, color } = AQVL_LINES[li];
      setCurrentLineIdx(li);
      setActiveLine(li);

      // Type characters one by one
      for (let ci = 0; ci <= text.length; ci++) {
        if (cancelRef.current) return;
        setCurrentLineTyped(text.slice(0, ci));
        if (ci < text.length) await delay(CHAR_DELAY);
      }

      // Commit line
      setVisibleLines(prev => [...prev, { text, colorKey: color }]);
      setCurrentLineTyped('');
      setCurrentLineIdx(-1);
      setActiveLine(li);

      // Trigger node reveal if applicable
      if (LINE_TO_NODE[li]) {
        const nodeId = LINE_TO_NODE[li][0];
        await delay(PHASE_PAUSE * 0.5);
        setRevealedNodes(prev => {
          const next = new Set(prev);
          next.add(nodeId);
          return next;
        });
      }

      await delay(LINE_GAP);
    }

    // ── INORDER traversal highlight ────────────────────────
    if (cancelRef.current) return;
    setPhase('inorder');
    setActiveLine(16); // INORDER line
    for (const nodeId of INORDER_ORDER) {
      if (cancelRef.current) return;
      setHighlightedNodes(new Set([nodeId]));
      await delay(NODE_STAGGER * 1.6);
    }
    setHighlightedNodes(new Set(INORDER_ORDER)); // all lit up
    await delay(600);

    // ── SEARCH highlight ────────────────────────────────────
    if (cancelRef.current) return;
    setPhase('search');
    setHighlightedNodes(new Set());
    setActiveLine(17); // SEARCH line
    for (const nodeId of SEARCH_PATH) {
      if (cancelRef.current) return;
      setSearchNodes(prev => {
        const next = new Set(prev);
        next.add(nodeId);
        return next;
      });
      await delay(NODE_STAGGER * 2);
    }

    setPhase('done');
    await delay(LOOP_RESTART);

    // Loop
    if (!cancelRef.current) runLoop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setMounted(true);
    const id = setTimeout(() => runLoop(), 400);
    return () => {
      cancelRef.current = true;
      clearTimer();
      clearTimeout(id);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Tree SVG helpers ───────────────────────────────────── */
  const W = 320, H = 260; // SVG viewBox

  function nodeState(id: string): 'hidden'|'visible'|'highlight'|'search' {
    if (!revealedNodes.has(id)) return 'hidden';
    if (searchNodes.has(id))    return 'search';
    if (highlightedNodes.has(id)) return 'highlight';
    return 'visible';
  }

  const nodeMap = Object.fromEntries(TREE_NODES.map(n => [n.id, n]));

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <section
      className={`ctv-section ${mounted ? 'ctv-section--mounted' : ''}`}
      aria-label="AQVL code-to-visualization showcase"
      id="code-to-viz"
    >
      {/* Section header */}
      <div className="ctv-header">
        <div className="ctv-header-label">
          <span className="ctv-header-label-line" />
          <span className="ctv-header-label-text">How It Works</span>
          <span className="ctv-header-label-line" />
        </div>
        <h2 className="ctv-title">
          Write Code.{' '}
          <span className="ctv-title-accent">Watch It Come Alive.</span>
        </h2>
        <p className="ctv-subtitle">
          AQVL compiles your declarative script into an interactive 3D scene — in milliseconds.
        </p>
      </div>

      {/* Split screen */}
      <div className="ctv-split">

        {/* ── Left: Code Editor ──────────────────────────── */}
        <div className="ctv-editor-wrap">
          {/* Editor chrome */}
          <div className="ctv-editor-chrome">
            <div className="ctv-editor-dots">
              <span className="ctv-dot ctv-dot--red" />
              <span className="ctv-dot ctv-dot--yellow" />
              <span className="ctv-dot ctv-dot--green" />
            </div>
            <div className="ctv-editor-title">bst_demo.aqvl</div>
            <div className="ctv-editor-badge">
              <span className="ctv-editor-badge-dot" />
              Live
            </div>
          </div>

          {/* Gutter + lines */}
          <div className="ctv-editor-body" ref={codeScrollRef}>
            <div className="ctv-editor-gutter">
              {AQVL_LINES.map((_, i) => (
                <div
                  key={i}
                  className={`ctv-gutter-num ${activeLine === i ? 'ctv-gutter-num--active' : ''}`}
                >
                  {i + 1}
                </div>
              ))}
            </div>
            <div className="ctv-editor-lines">
              {/* Committed lines */}
              {visibleLines.map((ln, i) => (
                <div
                  key={i}
                  className={`ctv-line ${activeLine === i ? 'ctv-line--active' : ''}`}
                >
                  <span className="ctv-line-text">
                    {tokenize(ln.text, ln.colorKey)}
                  </span>
                </div>
              ))}

              {/* Currently typing line */}
              {currentLineIdx >= 0 && (
                <div className="ctv-line ctv-line--typing">
                  <span className="ctv-line-text">
                    {tokenize(
                      currentLineTyped,
                      AQVL_LINES[currentLineIdx]?.color ?? 'plain'
                    )}
                  </span>
                  <span
                    className="ctv-cursor"
                    style={{ opacity: cursorBlink ? 1 : 0 }}
                  />
                </div>
              )}

              {/* Remaining placeholder lines (ghost) */}
              {visibleLines.length < AQVL_LINES.length &&
                AQVL_LINES.slice(
                  visibleLines.length + (currentLineIdx >= 0 ? 1 : 0)
                ).map((ln, i) => (
                  <div key={`ghost-${i}`} className="ctv-line ctv-line--ghost">
                    <span className="ctv-line-text ctv-ghost-text">
                      {ln.text || ' '}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Editor status bar */}
          <div className="ctv-editor-status">
            <span className="ctv-status-item">AQVL</span>
            <span className="ctv-status-sep" />
            <span className="ctv-status-item ctv-status-item--active">
              {phase === 'build'   && '⬤ Building…'}
              {phase === 'inorder' && '⬤ Traversing Inorder…'}
              {phase === 'search'  && '⬤ Searching 60…'}
              {phase === 'done'    && '✓ Complete'}
            </span>
            <span className="ctv-status-sep" />
            <span className="ctv-status-item">{visibleLines.length} / {AQVL_LINES.length} lines</span>
          </div>
        </div>

        {/* ── Arrow connector ────────────────────────────── */}
        <div className="ctv-connector" aria-hidden="true">
          <div className="ctv-connector-pill">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="13 17 18 12 13 7"/>
              <polyline points="6 17 11 12 6 7"/>
            </svg>
            <span>compiles to</span>
          </div>
          <div className="ctv-connector-line" />
        </div>

        {/* ── Right: 3D Visualization ─────────────────────── */}
        <div className="ctv-viz-wrap">
          <div className="ctv-viz-chrome">
            <div className="ctv-editor-dots">
              <span className="ctv-dot ctv-dot--red" />
              <span className="ctv-dot ctv-dot--yellow" />
              <span className="ctv-dot ctv-dot--green" />
            </div>
            <div className="ctv-editor-title">3D Viewport — Binary Search Tree</div>
            <div className={`ctv-viz-status ${phase === 'done' ? 'ctv-viz-status--done' : 'ctv-viz-status--running'}`}>
              <span className="ctv-viz-status-dot" />
              {phase === 'done' ? 'Scene Ready' : 'Rendering…'}
            </div>
          </div>

          <div className="ctv-viz-body">
            {/* Grid floor */}
            <div className="ctv-viz-grid" aria-hidden="true" />

            {/* Depth labels */}
            <div className="ctv-depth-labels" aria-hidden="true">
              {['Root', 'Depth 1', 'Depth 2'].map((label, d) => (
                <div
                  key={d}
                  className="ctv-depth-label"
                  style={{ top: `${11 + d * 24}%` }}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* SVG Tree */}
            <svg
              className="ctv-tree-svg"
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="xMidYMid meet"
              aria-label="Binary Search Tree visualization"
            >
              {/* Defs: gradients & glow */}
              <defs>
                <radialGradient id="ctv-node-grad-default" cx="35%" cy="30%" r="65%">
                  <stop offset="0%" stopColor="#3b3b5c" />
                  <stop offset="100%" stopColor="#1a1a2e" />
                </radialGradient>
                <radialGradient id="ctv-node-grad-highlight" cx="35%" cy="30%" r="65%">
                  <stop offset="0%" stopColor="#8b6ff0" />
                  <stop offset="100%" stopColor="#5b2db0" />
                </radialGradient>
                <radialGradient id="ctv-node-grad-search" cx="35%" cy="30%" r="65%">
                  <stop offset="0%" stopColor="#fde47a" />
                  <stop offset="100%" stopColor="#ca8a04" />
                </radialGradient>
                <filter id="ctv-glow-purple" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <filter id="ctv-glow-yellow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <filter id="ctv-drop-shadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="rgba(0,0,0,0.5)" />
                </filter>
              </defs>

              {/* Edges */}
              {TREE_NODES.filter(n => n.parentId).map(n => {
                const parent = nodeMap[n.parentId!];
                const nState  = nodeState(n.id);
                const pState  = nodeState(n.parentId!);
                const visible = nState !== 'hidden' && pState !== 'hidden';
                const isSearch  = nState === 'search' || pState === 'search';
                const isHighlight = nState === 'highlight' || pState === 'highlight';
                return (
                  <line
                    key={`edge-${n.id}`}
                    x1={parent.x * W}
                    y1={parent.y * H}
                    x2={n.x * W}
                    y2={n.y * H}
                    className={[
                      'ctv-edge',
                      !visible          ? 'ctv-edge--hidden'    : '',
                      isSearch          ? 'ctv-edge--search'    : '',
                      isHighlight       ? 'ctv-edge--highlight' : '',
                    ].join(' ')}
                  />
                );
              })}

              {/* Nodes */}
              {TREE_NODES.map(n => {
                const state = nodeState(n.id);
                const cx = n.x * W;
                const cy = n.y * H;
                const R  = n.depth === 0 ? 18 : 15;
                const isHidden    = state === 'hidden';
                const isHighlight = state === 'highlight';
                const isSearch    = state === 'search';

                return (
                  <g
                    key={n.id}
                    className={[
                      'ctv-node-group',
                      isHidden    ? 'ctv-node-group--hidden'    : '',
                      isHighlight ? 'ctv-node-group--highlight' : '',
                      isSearch    ? 'ctv-node-group--search'    : '',
                    ].join(' ')}
                  >
                    {/* Glow ring */}
                    {(isHighlight || isSearch) && (
                      <circle
                        cx={cx} cy={cy} r={R + 8}
                        fill="none"
                        stroke={isSearch ? '#fde047' : '#a78bfa'}
                        strokeWidth="1.5"
                        opacity="0.4"
                        className="ctv-glow-ring"
                      />
                    )}

                    {/* Shadow disk (3D effect) */}
                    <ellipse
                      cx={cx} cy={cy + R + 4}
                      rx={R * 0.85} ry={R * 0.28}
                      fill="rgba(0,0,0,0.35)"
                      className="ctv-node-shadow"
                    />

                    {/* Main sphere */}
                    <circle
                      cx={cx} cy={cy} r={R}
                      fill={
                        isSearch    ? 'url(#ctv-node-grad-search)'    :
                        isHighlight ? 'url(#ctv-node-grad-highlight)' :
                                      'url(#ctv-node-grad-default)'
                      }
                      stroke={isSearch ? '#fde047' : isHighlight ? '#a78bfa' : '#4f4f80'}
                      strokeWidth={n.depth === 0 ? 2.5 : 2}
                      filter={isSearch ? 'url(#ctv-glow-yellow)' : isHighlight ? 'url(#ctv-glow-purple)' : 'url(#ctv-drop-shadow)'}
                      className="ctv-node-circle"
                    />

                    {/* Highlight specular */}
                    <circle
                      cx={cx - R * 0.28} cy={cy - R * 0.28}
                      r={R * 0.32}
                      fill="rgba(255,255,255,0.12)"
                      className="ctv-node-spec"
                    />

                    {/* Label */}
                    <text
                      x={cx} y={cy + 1}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className={[
                        'ctv-node-label',
                        isSearch    ? 'ctv-node-label--search' :
                        isHighlight ? 'ctv-node-label--highlight' : ''
                      ].join(' ')}
                      fontSize={n.depth === 0 ? 11 : 9.5}
                      fontWeight="800"
                    >
                      {n.val}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Legend */}
            <div className="ctv-viz-legend" aria-label="Visualization legend">
              <div className="ctv-legend-item">
                <span className="ctv-legend-dot ctv-legend-dot--default" />
                Node
              </div>
              <div className="ctv-legend-item">
                <span className="ctv-legend-dot ctv-legend-dot--highlight" />
                Traversal
              </div>
              <div className="ctv-legend-item">
                <span className="ctv-legend-dot ctv-legend-dot--search" />
                Search Path
              </div>
            </div>

            {/* Phase banner */}
            <div
              className={[
                'ctv-phase-banner',
                phase === 'inorder' ? 'ctv-phase-banner--inorder' :
                phase === 'search'  ? 'ctv-phase-banner--search'  :
                phase === 'done'    ? 'ctv-phase-banner--done'    : '',
              ].join(' ')}
            >
              {phase === 'build'   && '↓ Building BST…'}
              {phase === 'inorder' && '→ Inorder: 20 · 30 · 40 · 50 · 60 · 70 · 80'}
              {phase === 'search'  && '⚡ Searching for 60…'}
              {phase === 'done'    && '✓ Target Found: depth 2, O(log n)'}
            </div>
          </div>

          {/* Stats bar */}
          <div className="ctv-viz-stats">
            <div className="ctv-stat">
              <span className="ctv-stat-label">Nodes</span>
              <span className="ctv-stat-value ctv-stat-value--purple">
                {revealedNodes.size}
              </span>
            </div>
            <div className="ctv-stat-sep" />
            <div className="ctv-stat">
              <span className="ctv-stat-label">Height</span>
              <span className="ctv-stat-value">
                {revealedNodes.size === 0 ? '—' :
                 revealedNodes.size <= 1  ? '0' :
                 revealedNodes.size <= 3  ? '1' : '2'}
              </span>
            </div>
            <div className="ctv-stat-sep" />
            <div className="ctv-stat">
              <span className="ctv-stat-label">Traversal</span>
              <span className="ctv-stat-value ctv-stat-value--green">
                {phase === 'inorder' ? 'Inorder' :
                 phase === 'search'  ? 'Search'  :
                 phase === 'done'    ? 'Done'     : '—'}
              </span>
            </div>
            <div className="ctv-stat-sep" />
            <div className="ctv-stat">
              <span className="ctv-stat-label">Compile</span>
              <span className="ctv-stat-value ctv-stat-value--green">
                {revealedNodes.size > 0 ? '&lt;1ms' : '—'}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom CTA strip */}
      <div className="ctv-cta-strip">
        <span className="ctv-cta-strip-text">
          That's it. 19 lines of AQVL. Infinite possibilities.
        </span>
        <a href="#/playground" className="ctv-cta-btn" id="section2-cta-playground">
          Try it yourself
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        </a>
      </div>
    </section>
  );
}
