import React, { useEffect, useRef, useState } from 'react';

/* ══════════════════════════════════════════════════════════════
   DSA Visualization — Animated Binary Tree Traversal
   Pure Canvas/SVG — No Three.js needed for hero display
   Features: Node pulse, edge draw-on, traversal glow, floating,
   code snippet side-panel, depth-first traversal animation.
═══════════════════════════════════════════════════════════════ */

interface TreeNode {
  id: number;
  value: number;
  x: number;
  y: number;
  left?: number;
  right?: number;
}

// Binary tree layout
const TREE_NODES: TreeNode[] = [
  { id: 0, value: 42, x: 50,  y: 10  },                        // root
  { id: 1, value: 21, x: 28,  y: 32, left: 3, right: 4 },     // L
  { id: 2, value: 67, x: 72,  y: 32, left: 5, right: 6 },     // R
  { id: 3, value: 11, x: 16,  y: 58, left: 7 },                // LL
  { id: 4, value: 35, x: 40,  y: 58 },                         // LR
  { id: 5, value: 54, x: 60,  y: 58 },                         // RL
  { id: 6, value: 89, x: 84,  y: 58, right: 8 },               // RR
  { id: 7, value: 6,  x: 9,   y: 82 },                         // LLL
  { id: 8, value: 95, x: 90,  y: 82 },                         // RRR
];

// Root has left=1, right=2 (add it here)
TREE_NODES[0].left = 1;
TREE_NODES[0].right = 2;

// BFS traversal order
const TRAVERSAL_ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 8];

// Edges: [parentId, childId]
const EDGES: [number, number][] = [
  [0, 1], [0, 2],
  [1, 3], [1, 4],
  [2, 5], [2, 6],
  [3, 7],
  [6, 8],
];

// Code snippet lines that appear in the panel
const CODE_LINES = [
  { text: 'scene BinarySearch {', color: '#a78bfa', indent: 0 },
  { text: '  node root = 42', color: '#60a5fa', indent: 0 },
  { text: '  node left  = 21', color: '#60a5fa', indent: 0 },
  { text: '  node right = 67', color: '#60a5fa', indent: 0 },
  { text: '', color: 'transparent', indent: 0 },
  { text: '  connect root → left', color: '#34d399', indent: 0 },
  { text: '  connect root → right', color: '#34d399', indent: 0 },
  { text: '', color: 'transparent', indent: 0 },
  { text: '  traverse BFS(root)', color: '#fde047', indent: 0 },
  { text: '}', color: '#a78bfa', indent: 0 },
];

const ACCENT_COLORS = {
  nodeFill: '#1a1a2e',
  nodeStroke: '#e2e8f0',
  nodeActive: '#fde047',
  nodeVisited: '#34d399',
  edgeColor: '#334155',
  edgeActive: '#a78bfa',
  glow: '#fde047',
};

/* ── SVG Tree Visualization ──────────────────────────────────── */
export function DSAVisualization() {
  const [activeNode, setActiveNode] = useState<number | null>(null);
  const [visitedNodes, setVisitedNodes] = useState<Set<number>>(new Set());
  const [activeEdge, setActiveEdge] = useState<[number, number] | null>(null);
  const [visitedEdges, setVisitedEdges] = useState<Set<string>>(new Set());
  const [activeCodeLine, setActiveCodeLine] = useState<number>(0);
  const [phase, setPhase] = useState<'building' | 'traversing' | 'done'>('building');
  const [builtEdges, setBuiltEdges] = useState<Set<string>>(new Set());
  const [builtNodes, setBuiltNodes] = useState<Set<number>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const traversalRef = useRef<number>(0);

  // Phase 1: Build the tree (nodes appear one by one)
  useEffect(() => {
    const nodeOrder = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const edgeOrder: [number,number][] = [
      [0,1],[0,2],[1,3],[1,4],[2,5],[2,6],[3,7],[6,8]
    ];

    let step = 0;
    const totalSteps = nodeOrder.length + edgeOrder.length;

    const buildStep = () => {
      if (step < nodeOrder.length) {
        const nid = nodeOrder[step];
        setBuiltNodes(prev => new Set([...prev, nid]));
        const codeLine = Math.min(step, 3);
        setActiveCodeLine(codeLine);
      } else {
        const edgeIdx = step - nodeOrder.length;
        if (edgeIdx < edgeOrder.length) {
          const [p, c] = edgeOrder[edgeIdx];
          setBuiltEdges(prev => new Set([...prev, `${p}-${c}`]));
          setActiveCodeLine(5 + Math.min(edgeIdx, 1));
        }
      }

      step++;
      if (step < totalSteps) {
        timerRef.current = setTimeout(buildStep, 280);
      } else {
        timerRef.current = setTimeout(() => {
          setPhase('traversing');
          setActiveCodeLine(8);
        }, 600);
      }
    };

    timerRef.current = setTimeout(buildStep, 400);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // Phase 2: Traverse the tree
  useEffect(() => {
    if (phase !== 'traversing') return;

    traversalRef.current = 0;

    const doTraversal = () => {
      const idx = traversalRef.current;
      if (idx >= TRAVERSAL_ORDER.length) {
        timerRef.current = setTimeout(() => {
          setVisitedNodes(new Set());
          setVisitedEdges(new Set());
          setActiveNode(null);
          setActiveEdge(null);
          traversalRef.current = 0;
          timerRef.current = setTimeout(doTraversal, 600);
        }, 1200);
        return;
      }

      const nodeId = TRAVERSAL_ORDER[idx];
      setActiveNode(nodeId);

      // Find and highlight the edge leading to this node
      if (idx > 0) {
        const parentId = TRAVERSAL_ORDER.findIndex((_, i) => {
          const node = TREE_NODES[TRAVERSAL_ORDER[i]];
          return node.left === nodeId || node.right === nodeId;
        });
        if (parentId >= 0) {
          const pid = TRAVERSAL_ORDER[parentId];
          setActiveEdge([pid, nodeId]);
          setVisitedEdges(prev => new Set([...prev, `${pid}-${nodeId}`]));
        }
      }

      timerRef.current = setTimeout(() => {
        setVisitedNodes(prev => new Set([...prev, nodeId]));
        traversalRef.current++;
        timerRef.current = setTimeout(doTraversal, 200);
      }, 500);
    };

    timerRef.current = setTimeout(doTraversal, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase]);

  const getNodeColor = (id: number) => {
    if (id === activeNode) return ACCENT_COLORS.nodeActive;
    if (visitedNodes.has(id)) return ACCENT_COLORS.nodeVisited;
    return 'var(--card-bg, #1a1a24)';
  };

  const getNodeStroke = (id: number) => {
    if (id === activeNode) return ACCENT_COLORS.nodeActive;
    if (visitedNodes.has(id)) return ACCENT_COLORS.nodeVisited;
    return ACCENT_COLORS.nodeStroke;
  };

  const getEdgeColor = (p: number, c: number) => {
    const key = `${p}-${c}`;
    if (activeEdge && activeEdge[0] === p && activeEdge[1] === c) return ACCENT_COLORS.edgeActive;
    if (visitedEdges.has(key)) return ACCENT_COLORS.nodeVisited;
    return ACCENT_COLORS.edgeColor;
  };

  const getEdgeOpacity = (p: number, c: number) => {
    const key = `${p}-${c}`;
    const isBuilt = builtEdges.has(key);
    if (!isBuilt) return 0;
    if (activeEdge && activeEdge[0] === p && activeEdge[1] === c) return 1;
    if (visitedEdges.has(key)) return 0.9;
    return 0.4;
  };

  return (
    <div className="dsa-viz-root">
      {/* Floating particles */}
      <div className="dsa-particles" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className={`dsa-particle dsa-particle--${i % 4}`} style={{
            left: `${10 + (i * 7.5) % 80}%`,
            animationDelay: `${i * 0.4}s`,
            animationDuration: `${3 + (i % 3)}s`,
          }} />
        ))}
      </div>

      {/* Main card */}
      <div className="dsa-viz-card">

        {/* Header bar */}
        <div className="dsa-viz-header">
          <div className="dsa-viz-header-dots">
            <span className="dsa-dot dsa-dot--red" />
            <span className="dsa-dot dsa-dot--yellow" />
            <span className="dsa-dot dsa-dot--green" />
          </div>
          <span className="dsa-viz-header-title">Binary Tree · BFS Traversal</span>
          <span className={`dsa-status-badge ${phase === 'traversing' ? 'dsa-status-badge--running' : phase === 'building' ? 'dsa-status-badge--building' : 'dsa-status-badge--done'}`}>
            <span className="dsa-status-dot" />
            {phase === 'building' ? 'Building' : phase === 'traversing' ? 'Traversing' : 'Done'}
          </span>
        </div>

        {/* Content: Tree + Code */}
        <div className="dsa-viz-body">

          {/* SVG Tree */}
          <div className="dsa-tree-panel">
            <svg
              viewBox="0 10 100 80"
              className="dsa-tree-svg"
              aria-label="Binary search tree visualization"
            >
              <defs>
                <filter id="glow-filter" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="glow-strong" x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Edges */}
              {EDGES.map(([p, c]) => {
                const pNode = TREE_NODES[p];
                const cNode = TREE_NODES[c];
                const color = getEdgeColor(p, c);
                const opacity = getEdgeOpacity(p, c);
                const isActive = activeEdge && activeEdge[0] === p && activeEdge[1] === c;
                return (
                  <line
                    key={`edge-${p}-${c}`}
                    x1={pNode.x}
                    y1={pNode.y}
                    x2={cNode.x}
                    y2={cNode.y}
                    stroke={color}
                    strokeWidth={isActive ? 0.8 : 0.5}
                    opacity={opacity}
                    strokeLinecap="round"
                    filter={isActive ? 'url(#glow-filter)' : undefined}
                    style={{ transition: 'opacity 0.4s ease, stroke 0.3s ease, stroke-width 0.3s ease' }}
                  />
                );
              })}

              {/* Nodes */}
              {TREE_NODES.map(node => {
                const isActive = node.id === activeNode;
                const isVisited = visitedNodes.has(node.id);
                const isBuilt = builtNodes.has(node.id);
                const fillColor = getNodeColor(node.id);
                const strokeColor = getNodeStroke(node.id);

                return (
                  <g key={`node-${node.id}`} style={{
                    opacity: isBuilt ? 1 : 0,
                    transition: 'opacity 0.35s ease',
                  }}>
                    {/* Outer glow ring for active */}
                    {isActive && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={7}
                        fill="none"
                        stroke={ACCENT_COLORS.glow}
                        strokeWidth="0.8"
                        opacity="0.35"
                        filter="url(#glow-strong)"
                        className="dsa-glow-ring"
                      />
                    )}

                    {/* Node circle */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={5}
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth="0.7"
                      filter={isActive ? 'url(#glow-filter)' : undefined}
                      style={{
                        transition: 'fill 0.3s ease, stroke 0.3s ease',
                      }}
                    />

                    {/* Value text */}
                    <text
                      x={node.x}
                      y={node.y + 0.5}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="2.8"
                      fontFamily="'Space Grotesk', sans-serif"
                      fontWeight="700"
                      fill={isActive ? '#111' : isVisited ? '#111' : 'var(--text, #f1f5f9)'}
                      style={{ transition: 'fill 0.3s ease', userSelect: 'none' }}
                    >
                      {node.value}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Depth labels */}
            <div className="dsa-depth-labels" aria-hidden="true">
              <span className="dsa-depth-label">Depth 0</span>
              <span className="dsa-depth-label">Depth 1</span>
              <span className="dsa-depth-label">Depth 2</span>
              <span className="dsa-depth-label">Depth 3</span>
            </div>
          </div>

          {/* Code panel */}
          <div className="dsa-code-panel" aria-label="AQVL code snippet">
            <div className="dsa-code-label">AQVL Source</div>
            <div className="dsa-code-lines">
              {CODE_LINES.map((line, i) => (
                <div
                  key={i}
                  className={`dsa-code-line ${i === activeCodeLine ? 'dsa-code-line--active' : ''}`}
                >
                  <span className="dsa-code-ln">{String(i + 1).padStart(2, ' ')}</span>
                  <span
                    className="dsa-code-text"
                    style={{ color: i === activeCodeLine ? '#fde047' : line.color }}
                  >
                    {line.text || '\u00A0'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="dsa-viz-stats">
          <div className="dsa-stat">
            <span className="dsa-stat-label">Nodes</span>
            <span className="dsa-stat-value">{builtNodes.size} / {TREE_NODES.length}</span>
          </div>
          <div className="dsa-stat-sep" />
          <div className="dsa-stat">
            <span className="dsa-stat-label">Visited</span>
            <span className="dsa-stat-value dsa-stat-value--green">{visitedNodes.size}</span>
          </div>
          <div className="dsa-stat-sep" />
          <div className="dsa-stat">
            <span className="dsa-stat-label">Algorithm</span>
            <span className="dsa-stat-value dsa-stat-value--purple">BFS</span>
          </div>
          <div className="dsa-stat-sep" />
          <div className="dsa-stat">
            <span className="dsa-stat-label">Complexity</span>
            <span className="dsa-stat-value">O(n)</span>
          </div>
        </div>
      </div>

      {/* Floating badge */}
      <div className="dsa-floating-badge" aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        Live Execution
      </div>
    </div>
  );
}
