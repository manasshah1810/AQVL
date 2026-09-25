import React, { useState, useEffect, useRef, useCallback } from 'react';
import './docs.css';

// ─── Icons ───────────────────────────────────────────────
const SunIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const WarnIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const TipIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

// ─── Nav Icons ────────────────────────────────────────────
const IconDoc = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const IconArray = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="9" y1="3" x2="9" y2="21" />
  </svg>
);

const IconCode = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

const IconWarn = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IconLink = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
    <line x1="7" y1="12" x2="10" y2="12" />
    <line x1="14" y1="12" x2="17" y2="12" />
  </svg>
);

const IconTree = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <polyline points="17 11 21 7 17 3" />
    <line x1="21" y1="7" x2="9" y2="7" />
  </svg>
);

const IconGraph = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="4" height="4" rx="1" />
    <rect x="10" y="10" width="4" height="4" rx="1" />
    <rect x="18" y="17" width="4" height="4" rx="1" />
    <line x1="6" y1="5" x2="10" y2="12" />
    <line x1="14" y1="12" x2="18" y2="19" />
  </svg>
);

const IconStack = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="16" width="20" height="5" rx="1" />
    <rect x="2" y="9" width="20" height="5" rx="1" />
    <rect x="2" y="3" width="20" height="4" rx="1" />
  </svg>
);

const IconSort = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="13" y1="18" x2="21" y2="18" />
    <polyline points="3 12 6 9 3 6" />
  </svg>
);

const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const IconQueue = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="8" width="5" height="8" rx="1" />
    <rect x="9" y="8" width="5" height="8" rx="1" />
    <rect x="16" y="8" width="5" height="8" rx="1" />
    <line x1="2" y1="20" x2="21" y2="20" />
  </svg>
);

const IconHeap = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 3 21 19 3 19" />
    <line x1="12" y1="3" x2="12" y2="19" />
    <line x1="7" y1="12" x2="17" y2="12" />
  </svg>
);

const IconTrie = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="4" r="2" />
    <circle cx="5" cy="13" r="2" />
    <circle cx="19" cy="13" r="2" />
    <circle cx="12" cy="21" r="2" />
    <line x1="11" y1="6" x2="6" y2="11" />
    <line x1="13" y1="6" x2="18" y2="11" />
    <line x1="6" y1="15" x2="11" y2="19" />
  </svg>
);

const IconHashMap = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="9" x2="20" y2="9" />
    <line x1="4" y1="15" x2="20" y2="15" />
    <line x1="10" y1="3" x2="8" y2="21" />
    <line x1="16" y1="3" x2="14" y2="21" />
  </svg>
);

const IconFlow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 4 4 12 12 12" />
    <polyline points="9 9 12 12 9 15" />
    <circle cx="18" cy="12" r="3" />
  </svg>
);

const IconFunction = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 20c-2 0-3-1-3-3v-3c0-1.5-.8-2-2-2 1.2 0 2-.5 2-2V7c0-2 1-3 3-3" />
    <path d="M15 4c2 0 3 1 3 3v3c0 1.5.8 2 2 2-1.2 0-2 .5-2 2v3c0 2-1 3-3 3" />
  </svg>
);

const IconCamera = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8h3l2-2h8l2 2h3v11H3z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);

// ─── Robot Mascot ─────────────────────────────────────────
const RobotMascot = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
    {/* Body */}
    <rect x="8" y="18" width="28" height="22" rx="4" fill="#f472b6" stroke="#1a1916" strokeWidth="1.5"/>
    {/* Head */}
    <rect x="11" y="6" width="22" height="14" rx="3" fill="#f9a8d4" stroke="#1a1916" strokeWidth="1.5"/>
    {/* Antenna */}
    <line x1="22" y1="6" x2="22" y2="2" stroke="#1a1916" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="22" cy="1.5" r="1.5" fill="#f5c800"/>
    {/* Eyes */}
    <rect x="14" y="9" width="6" height="5" rx="1.5" fill="#1a1916"/>
    <rect x="24" y="9" width="6" height="5" rx="1.5" fill="#1a1916"/>
    <circle cx="17" cy="11.5" r="1.5" fill="#60a5fa"/>
    <circle cx="27" cy="11.5" r="1.5" fill="#60a5fa"/>
    {/* Mouth */}
    <path d="M16 18 Q22 21 28 18" stroke="#1a1916" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    {/* Legs */}
    <rect x="13" y="38" width="7" height="5" rx="2" fill="#ec4899" stroke="#1a1916" strokeWidth="1.5"/>
    <rect x="24" y="38" width="7" height="5" rx="2" fill="#ec4899" stroke="#1a1916" strokeWidth="1.5"/>
    {/* Arms */}
    <rect x="2" y="20" width="7" height="4" rx="2" fill="#f9a8d4" stroke="#1a1916" strokeWidth="1.5"/>
    <rect x="35" y="20" width="7" height="4" rx="2" fill="#f9a8d4" stroke="#1a1916" strokeWidth="1.5"/>
    {/* Chest panel */}
    <rect x="15" y="24" width="14" height="10" rx="2" fill="rgba(0,0,0,0.15)"/>
    <line x1="18" y1="27" x2="26" y2="27" stroke="#f5c800" strokeWidth="1" strokeLinecap="round"/>
    <line x1="18" y1="30" x2="24" y2="30" stroke="#f5c800" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

// ─── TOC Icons ────────────────────────────────────────────
const TocIconDoc = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const TocIconBracket = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

const TocIconTerm = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

const TocIconWarn = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const TocIconList = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

// ─── Syntax Highlighter ───────────────────────────────────
// Kept in sync with the compiler's KEYWORDS set —
// packages/compiler/src/lexer/index.ts. CIRCULAR is deliberately excluded
// here: it is styled separately via CIRCULAR_KEYWORD below.
const KEYWORDS = new Set([
  'SCENE', 'DECLARE', 'ARRAY', 'SEQUENCE',
  'COMPARE', 'SWAP', 'HIGHLIGHT', 'WAIT', 'END',
  'LINKEDLIST', 'TYPE', 'SINGLY', 'DOUBLY',
  'NODE', 'EDGE', 'POINTER', 'STACK', 'QUEUE', 'HEAP',
  'GRAPH', 'VERTEX', 'GRAPH_EDGE', 'TREE', 'TREE_NODE', 'BINARY_TREE', 'BST',
  'LABEL', 'ANNOTATION', 'LINK', 'RELATION', 'DIRECTED', 'UNDIRECTED',
  'TO', 'FROM', 'PARENT', 'CHILD', 'LEFT_CHILD', 'RIGHT_CHILD', 'SIBLING',
  'INSERT', 'DELETE', 'INSERT_HEAD', 'INSERT_TAIL', 'DELETE_HEAD', 'DELETE_TAIL',
  'MOVE', 'CONNECT', 'DISCONNECT', 'PUSH', 'POP', 'PEEK',
  'ENQUEUE', 'DEQUEUE', 'FRONT', 'REAR', 'VISIT', 'MARK', 'TRAVERSE', 'ROTATE', 'SEARCH', 'HEAPIFY', 'UPDATE',
  'HEAP_INSERT', 'HEAP_EXTRACT', 'HEAP_DECREASE', 'BUILD_HEAP',
  'HASH_MAP', 'HASHMAP_INSERT', 'HASHMAP_LOOKUP', 'HASHMAP_DELETE',
  'TRIE_INSERT', 'TRIE_SEARCH', 'TRIE_DELETE', 'TRIE_AUTOCOMPLETE', 'TRIE_STARTSWITH',
  'SET', 'STATE', 'LOOP', 'LENGTH', 'NULL', 'TRIE', 'IF', 'HEAD', 'CLEAR', 'IS_EMPTY',
  'ROOT', 'REMOVE', 'COPY', 'FIND', 'SELECT',
  'PREORDER', 'INORDER', 'POSTORDER', 'LEVELORDER', 'REVERSELEVELORDER', 'REVERSE', 'ZIGZAG',
  'DFS', 'BFS', 'DIJKSTRA', 'BELLMAN_FORD', 'ASTAR', 'PRIM', 'KRUSKAL', 'TOPO_SORT',
  'HEIGHT', 'DEPTH', 'LEVEL', 'MAX_DEPTH', 'MIN_DEPTH', 'SIZE', 'LEAVES', 'INTERNAL', 'DEGREE', 'STATS',
  'PARENTOF', 'CHILDRENOF', 'ANCESTORS', 'DESCENDANTS', 'SIBLINGS', 'PATH', 'INTO',
  'COUNT_NODES', 'COUNT_LEAVES', 'COUNT_INTERNAL', 'COUNT_LEFT_LEAVES', 'COUNT_RIGHT_LEAVES', 'COUNT_FULL', 'COUNT_HALF',
  'IS_FULL', 'IS_COMPLETE', 'IS_PERFECT', 'IS_BALANCED', 'IS_DEGENERATE', 'IS_LEFT_SKEWED', 'IS_RIGHT_SKEWED', 'IS_SYMMETRIC',
  'LCA', 'DISTANCE', 'GRANDPARENT', 'UNCLE', 'COUSINS',
  'ROOT_TO_NODE', 'ROOT_TO_LEAVES', 'LONGEST_PATH', 'SHORTEST_PATH',
  'MIRROR', 'INVERT', 'CLONE', 'REMOVE_LEAVES', 'PRUNE',
  'LEFT_VIEW', 'RIGHT_VIEW', 'TOP_VIEW', 'BOTTOM_VIEW', 'BOUNDARY', 'VERTICAL_ORDER', 'DIAGONAL',
  'MAX_VALUE', 'MIN_VALUE', 'MIN', 'MAX', 'SUM', 'AVERAGE', 'MAX_LEVEL_SUM',
  'BUBBLE_SORT', 'SELECTION_SORT', 'INSERTION_SORT', 'MERGE_SORT', 'QUICK_SORT',
  // User-defined functions (VM mode)
  'FUNCTION', 'RETURN', 'ELSE',
  // Spatial syntax (LAYOUT / CAMERA / POSITION)
  'LAYOUT', 'AS', 'LINE', 'HIERARCHY', 'FORCE_DIRECTED', 'GRID', 'CUSTOM',
  'CAMERA', 'FOCUS', 'AUTO_FIT', 'ORBIT', 'POSITION', 'AT',
]);

// CIRCULAR gets its own class to distinguish it visually as a structural modifier
const CIRCULAR_KEYWORD = 'CIRCULAR';

function highlightAQVL(source: string): React.ReactNode[] {
  return source.split('\n').map((line, lineIdx) => {
    const isLast = lineIdx === source.split('\n').length - 1;

    // Comment line
    if (line.trimStart().startsWith('//')) {
      return (
        <span key={lineIdx}>
          <span className="tok-comment">{line}</span>
          {!isLast && '\n'}
        </span>
      );
    }

    // Tokenise. Multi-character operators come first in the alternation so
    // they win over their single-character prefixes, and quoted strings are
    // captured whole so their contents (e.g. "A->B") aren't re-tokenised.
    const parts = line.split(/(\s+|"[^"]*"|'[^']*'|<->|<-|->|<=|>=|==|!=|\[|\]|\{|\}|:|=|,|\(|\)|>|<|\+|-|\*|\/)/g);
    const nodes = parts.map((part, partIdx) => {
      if (part === CIRCULAR_KEYWORD) return <span key={partIdx} className="tok-circular">{part}</span>;
      if (KEYWORDS.has(part)) return <span key={partIdx} className="tok-keyword">{part}</span>;
      if (/^(["']).*\1$/.test(part)) return <span key={partIdx} className="tok-string">{part}</span>;
      if (/^\d+(\.\d+)?$/.test(part)) return <span key={partIdx} className="tok-number">{part}</span>;
      if (/^[a-z_][a-z0-9_]*$/i.test(part) && part.length > 0)
        return <span key={partIdx} className="tok-variable">{part}</span>;
      if (/^[=><!{}:,+\-*/[\]()]+$/.test(part) && part.trim())
        return <span key={partIdx} className="tok-operator">{part}</span>;
      return <span key={partIdx}>{part}</span>;
    });

    return (
      <span key={lineIdx}>
        {nodes}
        {!isLast && '\n'}
      </span>
    );
  });
}

// ─── CodeBlock ────────────────────────────────────────────
interface CodeBlockProps {
  code: string;
  label?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, label = 'aqvl' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="docs-codeblock">
      <div className="docs-codeblock-header">
        <div className="docs-codeblock-dots">
          <span /><span /><span />
        </div>
        <span className="docs-codeblock-lang">{label}</span>
        <button
          className={`docs-copy-btn${copied ? ' is-copied' : ''}`}
          onClick={handleCopy}
          aria-label="Copy code"
        >
          {copied ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
        </button>
      </div>
      <div className="docs-codeblock-body">
        <pre>{highlightAQVL(code)}</pre>
      </div>
    </div>
  );
};

// ─── Alert ────────────────────────────────────────────────
type AlertKind = 'note' | 'warn' | 'tip';
const Alert: React.FC<{ kind: AlertKind; title: string; children: React.ReactNode }> = ({ kind, title, children }) => {
  const icons: Record<AlertKind, React.ReactNode> = {
    note: <InfoIcon />,
    warn: <WarnIcon />,
    tip: <TipIcon />,
  };
  const cls: Record<AlertKind, string> = {
    note: 'docs-alert-note',
    warn: 'docs-alert-warn',
    tip: 'docs-alert-tip',
  };
  return (
    <div className={`docs-alert ${cls[kind]}`}>
      <span className="docs-alert-icon">{icons[kind]}</span>
      <div className="docs-alert-body">
        <p className="docs-alert-title">{title}</p>
        <p>{children}</p>
      </div>
    </div>
  );
};

// ─── Inline code helper ───────────────────────────────────
const C: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code className="docs-ic">{children}</code>
);

// ─── TOC definition ───────────────────────────────────────
const TOC_ITEMS_ARRAYS = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'declaration', label: 'Declaring an Array' },
  { id: 'commands', label: 'Commands Reference' },
  { id: 'examples', label: 'Examples' },
  { id: 'errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_LINKED_LISTS = [
  { id: 'll-introduction', label: 'Introduction' },
  { id: 'll-overview-singly', label: 'Singly Linked List' },
  { id: 'll-overview-doubly', label: 'Doubly Linked List' },
  { id: 'll-overview-circular', label: 'Circular Linked List' },
];

const TOC_ITEMS_SINGLY = [
  { id: 'sl-introduction', label: 'Introduction' },
  { id: 'sl-declaration', label: 'Declaring a Singly List' },
  { id: 'sl-commands', label: 'Commands Reference' },
  { id: 'sl-examples', label: 'Examples' },
  { id: 'sl-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_DOUBLY = [
  { id: 'dl-introduction', label: 'Introduction' },
  { id: 'dl-declaration', label: 'Declaring a Doubly List' },
  { id: 'dl-commands', label: 'Commands Reference' },
  { id: 'dl-examples', label: 'Examples' },
  { id: 'dl-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_CIRCULAR = [
  { id: 'cl-introduction', label: 'Introduction' },
  { id: 'cl-declaration', label: 'Declaring a Circular List' },
  { id: 'cl-commands', label: 'Commands Reference' },
  { id: 'cl-examples', label: 'Examples' },
  { id: 'cl-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_TREES = [
  { id: 'tr-introduction', label: 'Introduction' },
  { id: 'tr-overview-general', label: 'General Tree' },
  { id: 'tr-overview-binary', label: 'Binary Tree' },
  { id: 'tr-overview-bst', label: 'Binary Search Tree' },
];

const TOC_ITEMS_GENERAL_TREE = [
  { id: 'gt-introduction', label: 'Introduction' },
  { id: 'gt-declaration', label: 'Declaring a General Tree' },
  { id: 'gt-commands', label: 'Commands Reference' },
  { id: 'gt-examples', label: 'Examples' },
  { id: 'gt-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_BINARY_TREE = [
  { id: 'bt-introduction', label: 'Introduction' },
  { id: 'bt-declaration', label: 'Declaring a Binary Tree' },
  { id: 'bt-commands', label: 'Commands Reference' },
  { id: 'bt-examples', label: 'Examples' },
  { id: 'bt-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_BST = [
  { id: 'bst-introduction', label: 'Introduction' },
  { id: 'bst-declaration', label: 'Declaring a BST' },
  { id: 'bst-commands', label: 'Commands Reference' },
  { id: 'bst-examples', label: 'Examples' },
  { id: 'bst-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_STACKS = [
  { id: 'sk-introduction', label: 'Introduction' },
  { id: 'sk-declaration', label: 'Declaring a Stack' },
  { id: 'sk-commands', label: 'Commands Reference' },
  { id: 'sk-examples', label: 'Examples' },
  { id: 'sk-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_QUEUES = [
  { id: 'qu-introduction', label: 'Introduction' },
  { id: 'qu-declaration', label: 'Declaring a Queue' },
  { id: 'qu-commands', label: 'Commands Reference' },
  { id: 'qu-examples', label: 'Examples' },
  { id: 'qu-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_GRAPHS = [
  { id: 'gp-introduction', label: 'Introduction' },
  { id: 'gp-declaration', label: 'Declaring a Graph' },
  { id: 'gp-commands', label: 'Commands Reference' },
  { id: 'gp-examples', label: 'Examples' },
  { id: 'gp-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_HEAPS = [
  { id: 'hp-introduction', label: 'Introduction' },
  { id: 'hp-declaration', label: 'Declaring a Heap' },
  { id: 'hp-commands', label: 'Commands Reference' },
  { id: 'hp-examples', label: 'Examples' },
  { id: 'hp-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_TRIES = [
  { id: 'tri-introduction', label: 'Introduction' },
  { id: 'tri-declaration', label: 'Declaring a Trie' },
  { id: 'tri-commands', label: 'Commands Reference' },
  { id: 'tri-examples', label: 'Examples' },
  { id: 'tri-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_HASHMAPS = [
  { id: 'hm-introduction', label: 'Introduction' },
  { id: 'hm-declaration', label: 'Declaring a Hash Map' },
  { id: 'hm-commands', label: 'Commands Reference' },
  { id: 'hm-examples', label: 'Examples' },
  { id: 'hm-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_CONTROL_FLOW = [
  { id: 'cf-introduction', label: 'Introduction' },
  { id: 'cf-declaration', label: 'Variables & Literals' },
  { id: 'cf-commands', label: 'Statements & Operators' },
  { id: 'cf-examples', label: 'Examples' },
  { id: 'cf-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_FUNCTIONS = [
  { id: 'fn-introduction', label: 'Introduction' },
  { id: 'fn-declaration', label: 'Declaring a Function' },
  { id: 'fn-commands', label: 'Statements Reference' },
  { id: 'fn-examples', label: 'Examples' },
  { id: 'fn-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_SORTING = [
  { id: 'so-introduction', label: 'Introduction' },
  { id: 'so-declaration', label: 'Two Ways to Sort' },
  { id: 'so-commands', label: 'Commands Reference' },
  { id: 'so-examples', label: 'Examples' },
  { id: 'so-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_SEARCHING = [
  { id: 'se-introduction', label: 'Introduction' },
  { id: 'se-declaration', label: 'Marking a Match' },
  { id: 'se-commands', label: 'Commands Reference' },
  { id: 'se-examples', label: 'Examples' },
  { id: 'se-errors', label: 'Errors & Tips' },
];

const TOC_ITEMS_LAYOUT_CAMERA = [
  { id: 'lc-introduction', label: 'Introduction' },
  { id: 'lc-declaration', label: 'LAYOUT Strategies' },
  { id: 'lc-commands', label: 'Commands Reference' },
  { id: 'lc-examples', label: 'Examples' },
  { id: 'lc-errors', label: 'Errors & Tips' },
];

type PageId =
  | 'arrays' | 'linked-lists' | 'singly-linked-list' | 'doubly-linked-list' | 'circular-linked-list'
  | 'trees' | 'general-tree' | 'binary-tree' | 'bst'
  | 'stacks' | 'queues' | 'graphs' | 'heaps' | 'tries' | 'hashmaps'
  | 'control-flow' | 'functions' | 'sorting' | 'searching' | 'layout-camera';

const TOC_BY_PAGE: Record<PageId, { id: string; label: string }[]> = {
  'arrays': TOC_ITEMS_ARRAYS,
  'linked-lists': TOC_ITEMS_LINKED_LISTS,
  'singly-linked-list': TOC_ITEMS_SINGLY,
  'doubly-linked-list': TOC_ITEMS_DOUBLY,
  'circular-linked-list': TOC_ITEMS_CIRCULAR,
  'trees': TOC_ITEMS_TREES,
  'general-tree': TOC_ITEMS_GENERAL_TREE,
  'binary-tree': TOC_ITEMS_BINARY_TREE,
  'bst': TOC_ITEMS_BST,
  'stacks': TOC_ITEMS_STACKS,
  'queues': TOC_ITEMS_QUEUES,
  'graphs': TOC_ITEMS_GRAPHS,
  'heaps': TOC_ITEMS_HEAPS,
  'tries': TOC_ITEMS_TRIES,
  'hashmaps': TOC_ITEMS_HASHMAPS,
  'control-flow': TOC_ITEMS_CONTROL_FLOW,
  'functions': TOC_ITEMS_FUNCTIONS,
  'sorting': TOC_ITEMS_SORTING,
  'searching': TOC_ITEMS_SEARCHING,
  'layout-camera': TOC_ITEMS_LAYOUT_CAMERA,
};

// ─── Main Docs page ───────────────────────────────────────
export default function Docs() {
  const [activePage, setActivePage] = useState<PageId>('arrays');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [activeId, setActiveId] = useState('introduction');
  const [scrollPct, setScrollPct] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const TOC_ITEMS = TOC_BY_PAGE[activePage];

  /** Switches page and resets the active TOC anchor to that page's first section. */
  const goToPage = useCallback((page: PageId) => {
    setActivePage(page);
    setActiveId(TOC_BY_PAGE[page][0].id);
  }, []);

  // Restore theme
  useEffect(() => {
    const saved = (localStorage.getItem('aqvl-docs-theme') ?? 'dark') as 'light' | 'dark';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('aqvl-docs-theme', next);
  };

  // IntersectionObserver — root is the scrollable container
  useEffect(() => {
    const root = document.querySelector('.docs-main-wrap');
    const cb: IntersectionObserverCallback = (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActiveId(entry.target.id);
      }
    };
    observerRef.current = new IntersectionObserver(cb, {
      root,
      rootMargin: '-10% 0px -75% 0px',
      threshold: 0,
    });
    TOC_ITEMS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observerRef.current!.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, [activePage, TOC_ITEMS]);

  // Scroll progress bar — track .docs-main-wrap, not window
  useEffect(() => {
    const container = document.querySelector('.docs-main-wrap');
    if (!container) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const pct = scrollHeight - clientHeight > 0
        ? (scrollTop / (scrollHeight - clientHeight)) * 100
        : 0;
      setScrollPct(pct);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    const container = document.querySelector('.docs-main-wrap');
    if (el && container) {
      const elTop = el.getBoundingClientRect().top;
      const containerTop = container.getBoundingClientRect().top;
      container.scrollBy({ top: elTop - containerTop - 32, behavior: 'smooth' });
    }
  }, []);

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="docs-root">
      {/* Progress bar */}
      <div className="docs-progress-bar" style={{ width: `${scrollPct}%` }} />

      <div className="docs-layout">
        {/* ── Left Sidebar ─────────────────────────────── */}
        <aside className="docs-sidebar">
          <div className="docs-sidebar-topbar">
            <a href="#/" className="docs-brand">
              <div className="docs-brand-logo">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                </svg>
              </div>
              <span className="docs-brand-name">AQVL</span>
            </a>
            <button className="theme-btn" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>

          <nav className="docs-sidebar-nav" aria-label="Sidebar navigation">
            <div className="docs-nav-group">
              <div className="docs-nav-group-label">Getting Started</div>
              {TOC_ITEMS.map(({ id, label }) => {
                const navIcon = id.includes('introduction') || id.includes('ll-introduction') || id.includes('sl-introduction') || id.includes('dl-introduction') || id.includes('cl-introduction') || id.includes('tr-introduction') || id.includes('gt-introduction') || id.includes('bt-introduction')
                  ? <IconDoc />
                  : id.includes('declaration') || id.includes('commands')
                  ? <IconCode />
                  : id.includes('examples')
                  ? <IconArray />
                  : <IconWarn />;
                return (
                  <button
                    key={id}
                    className={`docs-nav-item${activeId === id ? ' is-active' : ''}`}
                    onClick={() => scrollTo(id)}
                  >
                    <span className="docs-nav-icon">{navIcon}</span>
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="docs-nav-group">
              <div className="docs-nav-group-label">Data Structures</div>
              <button
                className={`docs-nav-item ${activePage === 'arrays' ? 'is-active' : ''}`}
                onClick={() => goToPage('arrays')}
              >
                <span className="docs-nav-icon"><IconArray /></span>
                Arrays
              </button>

              {/* ── Linked Lists parent + nested children ─ */}
              <button
                className={`docs-nav-item ${activePage === 'linked-lists' ? 'is-active' : (activePage === 'singly-linked-list' || activePage === 'doubly-linked-list' || activePage === 'circular-linked-list') ? 'is-parent-active' : ''}`}
                onClick={() => goToPage('linked-lists')}
              >
                <span className="docs-nav-icon"><IconLink /></span>
                Linked Lists
              </button>

              {/* Children — shown whenever any linked-list page is active */}
              {(activePage === 'linked-lists' || activePage === 'singly-linked-list' || activePage === 'doubly-linked-list' || activePage === 'circular-linked-list') && (
                <div className="docs-nav-children">
                  <button
                    className={`docs-nav-item docs-nav-child ${activePage === 'singly-linked-list' ? 'is-active' : ''}`}
                    onClick={() => goToPage('singly-linked-list')}
                  >
                    Singly
                  </button>
                  <button
                    className={`docs-nav-item docs-nav-child ${activePage === 'doubly-linked-list' ? 'is-active' : ''}`}
                    onClick={() => goToPage('doubly-linked-list')}
                  >
                    Doubly
                  </button>
                  <button
                    className={`docs-nav-item docs-nav-child ${activePage === 'circular-linked-list' ? 'is-active' : ''}`}
                    onClick={() => goToPage('circular-linked-list')}
                  >
                    Circular
                  </button>
                </div>
              )}

              {/* ── Trees parent + nested children ─ */}
              <button
                className={`docs-nav-item ${activePage === 'trees' ? 'is-active' : (activePage === 'general-tree' || activePage === 'binary-tree' || activePage === 'bst') ? 'is-parent-active' : ''}`}
                onClick={() => goToPage('trees')}
              >
                <span className="docs-nav-icon"><IconTree /></span>
                Trees
              </button>

              {/* Children — shown whenever any tree page is active */}
              {(activePage === 'trees' || activePage === 'general-tree' || activePage === 'binary-tree' || activePage === 'bst') && (
                <div className="docs-nav-children">
                  <button
                    className={`docs-nav-item docs-nav-child ${activePage === 'general-tree' ? 'is-active' : ''}`}
                    onClick={() => goToPage('general-tree')}
                  >
                    General Tree
                  </button>
                  <button
                    className={`docs-nav-item docs-nav-child ${activePage === 'binary-tree' ? 'is-active' : ''}`}
                    onClick={() => goToPage('binary-tree')}
                  >
                    Binary Tree
                  </button>
                  <button
                    className={`docs-nav-item docs-nav-child ${activePage === 'bst' ? 'is-active' : ''}`}
                    onClick={() => goToPage('bst')}
                  >
                    BST
                  </button>
                </div>
              )}

              <button
                className={`docs-nav-item ${activePage === 'stacks' ? 'is-active' : ''}`}
                onClick={() => goToPage('stacks')}
              >
                <span className="docs-nav-icon"><IconStack /></span>
                Stacks
              </button>
              <button
                className={`docs-nav-item ${activePage === 'queues' ? 'is-active' : ''}`}
                onClick={() => goToPage('queues')}
              >
                <span className="docs-nav-icon"><IconQueue /></span>
                Queues
              </button>
              <button
                className={`docs-nav-item ${activePage === 'graphs' ? 'is-active' : ''}`}
                onClick={() => goToPage('graphs')}
              >
                <span className="docs-nav-icon"><IconGraph /></span>
                Graphs
              </button>
              <button
                className={`docs-nav-item ${activePage === 'heaps' ? 'is-active' : ''}`}
                onClick={() => goToPage('heaps')}
              >
                <span className="docs-nav-icon"><IconHeap /></span>
                Heaps
              </button>
              <button
                className={`docs-nav-item ${activePage === 'tries' ? 'is-active' : ''}`}
                onClick={() => goToPage('tries')}
              >
                <span className="docs-nav-icon"><IconTrie /></span>
                Tries
              </button>
              <button
                className={`docs-nav-item ${activePage === 'hashmaps' ? 'is-active' : ''}`}
                onClick={() => goToPage('hashmaps')}
              >
                <span className="docs-nav-icon"><IconHashMap /></span>
                Hash Maps
              </button>
            </div>

            <div className="docs-nav-group">
              <div className="docs-nav-group-label">Language</div>
              <button
                className={`docs-nav-item ${activePage === 'control-flow' ? 'is-active' : ''}`}
                onClick={() => goToPage('control-flow')}
              >
                <span className="docs-nav-icon"><IconFlow /></span>
                Control Flow
              </button>
              <button
                className={`docs-nav-item ${activePage === 'functions' ? 'is-active' : ''}`}
                onClick={() => goToPage('functions')}
              >
                <span className="docs-nav-icon"><IconFunction /></span>
                Functions
              </button>
            </div>

            <div className="docs-nav-group">
              <div className="docs-nav-group-label">Spatial Syntax</div>
              <button
                className={`docs-nav-item ${activePage === 'layout-camera' ? 'is-active' : ''}`}
                onClick={() => goToPage('layout-camera')}
              >
                <span className="docs-nav-icon"><IconCamera /></span>
                Layout &amp; Camera
              </button>
            </div>

            <div className="docs-nav-group">
              <div className="docs-nav-group-label">Algorithms</div>
              <button
                className={`docs-nav-item ${activePage === 'sorting' ? 'is-active' : ''}`}
                onClick={() => goToPage('sorting')}
              >
                <span className="docs-nav-icon"><IconSort /></span>
                Sorting
              </button>
              <button
                className={`docs-nav-item ${activePage === 'searching' ? 'is-active' : ''}`}
                onClick={() => goToPage('searching')}
              >
                <span className="docs-nav-icon"><IconSearch /></span>
                Searching
              </button>
            </div>
          </nav>

          {/* ── Robot Mascot ─────────────────────────────── */}
          <div className="docs-mascot">
            <div className="docs-mascot-body">
              <RobotMascot />
            </div>
            <div className="docs-mascot-bubble">
              Build.<br />Visualize.<br />Understand.
            </div>
          </div>
        </aside>

        {/* ── Top-right action buttons ─────────────────── */}
        <div className="docs-topbar-actions">
          <button className="docs-action-btn docs-action-btn-code" aria-label="View source">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
            </svg>
          </button>
          <button className="docs-action-btn docs-action-btn-fav" aria-label="Home" onClick={() => window.location.hash = '#/'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </button>
        </div>

        {/* ── Main content ─────────────────────────────── */}
        <div className="docs-main-wrap">
          <div className="docs-content">

            {activePage === 'arrays' && (
              <>
                {/* Page hero */}
                <header className="docs-page-hero">
                  <div className="docs-page-tag">Data Structures</div>
                  <div className="docs-page-title-row">
                    <div className="docs-page-title-icon">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <line x1="3" y1="9" x2="21" y2="9" />
                        <line x1="9" y1="3" x2="9" y2="21" />
                      </svg>
                    </div>
                    <h1 className="docs-page-title">Arrays</h1>
                    {/* Neobrutalism decorative sparkle */}
                    <svg style={{marginLeft:'auto',flexShrink:0,opacity:0.6}} width="32" height="32" viewBox="0 0 24 24" fill="#f472b6" stroke="#111" strokeWidth="1.5">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    <svg style={{flexShrink:0,opacity:0.5}} width="20" height="20" viewBox="0 0 24 24" fill="#fde047" stroke="#111" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                    </svg>
                  </div>
                  <p className="docs-page-lead">
                    Learn how to declare, manipulate, and animate arrays in AQVL — the language built for visualizing algorithms.
                  </p>
                </header>

                {/* ── § Introduction ─────────────────────── */}
                <section id="introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    In AQVL, an <C>ARRAY</C> is a fixed-width, contiguous sequence of integer elements. When you declare
                    one, the runtime immediately renders each element as a numbered box on screen — so you can see your
                    data right away, before a single instruction runs.
                  </p>
                  <p className="docs-p">
                    Arrays are the first data structure in AQVL and are paired with a set of high-level commands —
                    <C>HIGHLIGHT</C>, <C>COMPARE</C>, <C>SWAP</C>, <C>UPDATE</C>, <C>INSERT</C>, and <C>DELETE</C> — that
                    produce smooth, step-by-step animations. Combine them with <C>LOOP</C> and <C>IF</C> control flow to
                    express any sorting or searching algorithm in just a few readable lines.
                  </p>
                  <Alert kind="note" title="Note">
                    AQVL programs consist of three top-level blocks: <C>DECLARE</C> (define data), <C>SEQUENCE</C> (define
                    steps), and the wrapping <C>SCENE</C> / <C>END</C> pair. All three must be present for a valid program.
                  </Alert>
                </section>

                {/* ── § Declaration ──────────────────────── */}
                <section id="declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring an Array</h2>
                  <p className="docs-p">
                    Place your array declaration inside the <C>DECLARE</C> block. Provide a name and an initial list of
                    integer values enclosed in square brackets.
                  </p>

                  <CodeBlock
                    label="Syntax"
                    code={`ARRAY <name> = [<value>, <value>, ...]`}
                  />

                  <p className="docs-p">A full minimal program looks like this:</p>

                  <CodeBlock
                    code={`SCENE MyFirstArray\n\nDECLARE\n  ARRAY nums = [10, 20, 30, 40, 50]\n\nSEQUENCE\n  HIGHLIGHT nums[0]\nEND`}
                  />

                  <p className="docs-p">
                    When this program is loaded, the visualizer will instantly render five boxes labeled <em>10, 20, 30, 40, 50</em>.
                    Running the sequence will then animate the first element lighting up.
                  </p>

                  <Alert kind="warn" title="No empty arrays">
                    <C>ARRAY arr = []</C> is not valid. You must provide at least one initial value. Elements can be added
                    dynamically using <C>INSERT</C> after the scene starts.
                  </Alert>
                </section>

                {/* ── § Commands ─────────────────────────── */}
                <section id="commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>
                  <p className="docs-p">
                    All array commands live inside the <C>SEQUENCE</C> block. Each command maps 1-to-1 to an animation
                    step the runtime plays back.
                  </p>

                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr>
                          <th>Command</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">HIGHLIGHT</span><br/><span className="tok-param">name[i]</span></td>
                          <td>Pulses the element at index <C>i</C> with a bright accent color. Use it to mark the current element of interest — e.g., the minimum candidate in Selection Sort.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">COMPARE</span><br/><span className="tok-param">name[i]</span><br/><span className="tok-param">name[j]</span></td>
                          <td>Simultaneously highlights two elements to show they are being evaluated against each other. Neither is modified.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">SWAP</span> <span className="tok-param">name[i]</span><br/><span className="tok-param">name[j]</span></td>
                          <td>Animates an arc-swap of the values at indices <C>i</C> and <C>j</C>. Both the visual position and the internal value are exchanged.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">UPDATE</span> <span className="tok-param">name[i]</span><br/><span className="tok-param">value</span></td>
                          <td>Sets the element at index <C>i</C> to <C>value</C>, animating the number changing inside the box.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">INSERT</span> <span className="tok-param">name[i]</span><br/><span className="tok-param">value</span></td>
                          <td>Inserts a new box containing <C>value</C> at position <C>i</C>. All subsequent elements shift right with a slide animation. The array grows by one.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">DELETE</span> <span className="tok-param">name[i]</span></td>
                          <td>Removes the element at index <C>i</C>. All subsequent elements shift left to close the gap. The array shrinks by one.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h3 className="docs-h3">Control Flow</h3>
                  <p className="docs-p">
                    You can use <C>LOOP</C> and <C>IF</C> to build algorithm logic around the array commands above.
                  </p>

                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr>
                          <th>Construct</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">LOOP</span> <span className="tok-param">var</span><br/><span className="tok-keyword">FROM</span> <span className="tok-param">start</span> <span className="tok-keyword">TO</span> <span className="tok-param">end</span></td>
                          <td>Iterates <C>var</C> from <C>start</C> to <C>end</C> (inclusive). Close with <C>END</C>.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">IF</span> <span className="tok-param">expr</span></td>
                          <td>Conditionally executes its body if <C>expr</C> is truthy. Supports <C>&gt;</C>, <C>&lt;</C>, <C>=</C>. Close with <C>END</C>.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-builtin">LENGTH</span>(<span className="tok-param">name</span>)</td>
                          <td>Returns the current length of the named array. Useful as the upper bound of a loop.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* ── § Examples ─────────────────────────── */}
                <section id="examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — All Basic Operations</h3>
                  <p className="docs-p">
                    This program exercises every array command in sequence so you can see exactly what each one does in
                    the visualizer.
                  </p>
                  <CodeBlock
                    code={`SCENE ArrayOps\n\nDECLARE\n  ARRAY arr = [10, 20, 30, 40]\n\nSEQUENCE\n  // Draw attention to arr[0]\n  HIGHLIGHT arr[0]\n\n  // Show arr[0] vs arr[1]\n  COMPARE arr[0] arr[1]\n\n  // Exchange them\n  SWAP arr[0] arr[1]\n\n  // Overwrite arr[1] with 99\n  UPDATE arr[1] 99\n\n  // Insert 25 before arr[2]\n  INSERT arr[2] 25\n\n  // Remove the element now at arr[3]\n  DELETE arr[3]\nEND`}
                  />
                  <p className="docs-p">
                    <strong>Expected behavior:</strong> After SWAP, <C>arr</C> becomes <C>[20, 10, 30, 40]</C>.
                    After UPDATE it becomes <C>[20, 99, 30, 40]</C>. After INSERT, <C>[20, 99, 25, 30, 40]</C>.
                    After DELETE, <C>[20, 99, 25, 40]</C>.
                  </p>

                  <h3 className="docs-h3">Example 2 — Bubble Sort</h3>
                  <p className="docs-p">
                    Classic O(n²) comparison sort. The largest unsorted element "bubbles" to its correct position on each
                    outer pass.
                  </p>
                  <CodeBlock
                    code={`SCENE BubbleSort\n\nDECLARE\n  ARRAY arr = [64, 34, 25, 12, 22, 11, 90]\n\nSEQUENCE\n  LOOP i FROM 0 TO LENGTH(arr) - 2\n    LOOP j FROM 0 TO LENGTH(arr) - i - 2\n      COMPARE arr[j] arr[j+1]\n      IF arr[j] > arr[j+1]\n        SWAP arr[j] arr[j+1]\n      END\n    END\n    HIGHLIGHT arr[LENGTH(arr) - i - 1]\n  END\n  HIGHLIGHT arr[0]\nEND`}
                  />
                  <p className="docs-p">
                    <strong>Expected behavior:</strong> After every outer pass, the rightmost unsorted element snaps into
                    its final position (highlighted in green). The final <C>HIGHLIGHT arr[0]</C> marks the last remaining
                    element as sorted.
                  </p>

                  <h3 className="docs-h3">Example 3 — Selection Sort</h3>
                  <p className="docs-p">
                    On each pass, the current minimum in the unsorted portion is found and swapped into place.
                  </p>
                  <CodeBlock
                    code={`SCENE SelectionSort\n\nDECLARE\n  ARRAY arr = [64, 25, 12, 22, 11]\n\nSEQUENCE\n  LOOP i FROM 0 TO LENGTH(arr) - 2\n    HIGHLIGHT arr[i]\n    LOOP j FROM i + 1 TO LENGTH(arr) - 1\n      COMPARE arr[i] arr[j]\n      IF arr[i] > arr[j]\n        SWAP arr[i] arr[j]\n      END\n    END\n  END\nEND`}
                  />
                </section>

                {/* ── § Errors ───────────────────────────── */}
                <section id="errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>

                  <Alert kind="warn" title="Index out of bounds">
                    Accessing <C>arr[5]</C> on a 5-element array (indices 0–4) triggers a runtime error and halts
                    execution. Always use <C>LENGTH(arr) - 1</C> as your upper bound in loops.
                  </Alert>

                  <Alert kind="warn" title="Missing SCENE or END">
                    Every AQVL program must open with <C>SCENE &lt;name&gt;</C> and close with <C>END</C>. Forgetting
                    either is the most common source of parse errors.
                  </Alert>

                  <Alert kind="warn" title="Unclosed blocks">
                    Each <C>LOOP</C> and <C>IF</C> block must have its own <C>END</C> keyword. A missing <C>END</C>
                    causes the parser to fail with an "unexpected token" error.
                  </Alert>

                  <Alert kind="tip" title="Tip: use LENGTH() for dynamic arrays">
                    If your program uses <C>INSERT</C> or <C>DELETE</C>, the array length changes at runtime.
                    Always reference <C>LENGTH(arr)</C> instead of a hardcoded number in your loop bounds.
                  </Alert>

                  <Alert kind="note" title="Comments for clarity">
                    Single-line comments start with <C>//</C>. They have no effect on execution and are stripped by the
                    lexer — use them liberally to document the intent of each step.
                  </Alert>
                </section>
              </>
            )}

            {activePage === 'linked-lists' && (
              <>
                {/* Page hero */}
                <header className="docs-page-hero">
                  <div className="docs-page-tag">Data Structures</div>
                  <div className="docs-page-title-row">
                    <div className="docs-page-title-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
                        <line x1="7" y1="12" x2="10" y2="12" /><line x1="14" y1="12" x2="17" y2="12" />
                      </svg>
                    </div>
                    <h1 className="docs-page-title">Linked Lists</h1>
                  </div>
                  <p className="docs-page-lead">
                    AQVL supports three flavors of linked list: Singly, Doubly, and Circular. Each one is a separate page — select one in the sidebar to dive deep.
                  </p>
                </header>

                {/* ── § Introduction ─────────────────────── */}
                <section id="ll-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    In AQVL, a Linked List is a dynamic sequence of nodes. Unlike Arrays, Linked Lists are not contiguous in memory and rely on explicit relationships (edges) to connect nodes. AQVL renders each node as a sphere and each pointer as an animated edge.
                  </p>
                  <Alert kind="note" title="Dynamic Nature">
                    Linked List nodes are rendered as spheres and edges represent pointers. The visualizer automatically re-layouts the structure as you insert or delete nodes.
                  </Alert>
                </section>

                {/* ── § Overview: Singly ─────────────────── */}
                <section id="ll-overview-singly" className="docs-section">
                  <h2 className="docs-h2">Singly Linked List</h2>
                  <p className="docs-p">
                    The simplest form. Each node holds a value and a single <em>next</em> pointer. The chain terminates with a <C>NULL</C> sentinel.
                  </p>
                  <CodeBlock label="Syntax" code={`LINKEDLIST <name> = [<value>, <value>, ...]`} />
                  <button
                    className="docs-nav-item docs-overview-link"
                    onClick={() => { setActivePage('singly-linked-list'); setActiveId('sl-introduction'); }}
                  >
                    → Open full Singly Linked List documentation
                  </button>
                </section>

                {/* ── § Overview: Doubly ─────────────────── */}
                <section id="ll-overview-doubly" className="docs-section">
                  <h2 className="docs-h2">Doubly Linked List</h2>
                  <p className="docs-p">
                    Each node has both a <em>next</em> and a <em>prev</em> pointer, enabling bidirectional traversal. Declare one by prepending the <C>DOUBLY</C> keyword.
                  </p>
                  <CodeBlock label="Syntax" code={`DOUBLY LINKEDLIST <name> = [<value>, <value>, ...]`} />
                  <button
                    className="docs-nav-item docs-overview-link"
                    onClick={() => { setActivePage('doubly-linked-list'); setActiveId('dl-introduction'); }}
                  >
                    → Open full Doubly Linked List documentation
                  </button>
                </section>

                {/* ── § Overview: Circular ───────────────── */}
                <section id="ll-overview-circular" className="docs-section">
                  <h2 className="docs-h2">Circular Linked List</h2>
                  <p className="docs-p">
                    The last node's <em>next</em> wraps back to the first node, forming a loop. Declare one by prepending the <span className="tok-circular">CIRCULAR</span> keyword.
                  </p>
                  <CodeBlock label="Syntax" code={`CIRCULAR LINKEDLIST <name> = [<value>, <value>, ...]`} />
                  <button
                    className="docs-nav-item docs-overview-link"
                    onClick={() => { setActivePage('circular-linked-list'); setActiveId('cl-introduction'); }}
                  >
                    → Open full Circular Linked List documentation
                  </button>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                SINGLY LINKED LIST PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'singly-linked-list' && (
              <>
                <header className="docs-page-hero">
                  <div className="docs-page-tag">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
                      <line x1="7" y1="12" x2="10" y2="12" /><line x1="14" y1="12" x2="17" y2="12" />
                    </svg>
                    Linked Lists
                  </div>
                  <h1 className="docs-page-title">Singly Linked List</h1>
                  <p className="docs-page-lead">
                    A linear chain of nodes where each node points to the next. The simplest dynamic data structure — no backward traversal, terminated by <code>NULL</code>.
                  </p>
                </header>

                <section id="sl-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A Singly Linked List is a linear sequence of nodes. Each node stores a value and a single <em>next</em> pointer to the following node. The first node is the <C>HEAD</C> and the last node's <em>next</em> pointer is set to <C>NULL</C>, marking the end of the list.
                  </p>
                  <p className="docs-p">
                    AQVL handles all pointer manipulation behind the scenes. You never write raw pointer code — you just issue high-level commands like <C>INSERT_HEAD</C> or <C>DELETE_TAIL</C> and watch the animation unfold.
                  </p>
                  <Alert kind="note" title="Visualization">
                    Singly list nodes render as spheres. One directed edge per node shows the <em>next</em> pointer. The <C>NULL</C> terminal is shown as a special sentinel node.
                  </Alert>
                </section>

                <section id="sl-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a Singly Linked List</h2>
                  <p className="docs-p">
                    Place your declaration inside the <C>DECLARE</C> block. Provide a name and an initial list of integer values.
                  </p>
                  <CodeBlock label="Syntax" code={`LINKEDLIST <name> = [<value>, <value>, ...]`} />
                  <p className="docs-p">A complete minimal program:</p>
                  <CodeBlock code={`SCENE SinglyIntro\n\nDECLARE\n  LINKEDLIST list = [10, 20, 30]\n\nSEQUENCE\n  HIGHLIGHT list[0]\nEND`} />
                  <p className="docs-p">
                    The visualizer renders <C>HEAD → 10 → 20 → 30 → NULL</C> immediately on load.
                  </p>
                  <Alert kind="warn" title="No empty lists">
                    <C>LINKEDLIST list = []</C> is invalid. Provide at least one value; add more dynamically with <C>INSERT_HEAD</C> or <C>INSERT_TAIL</C>.
                  </Alert>
                </section>

                <section id="sl-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>
                  <p className="docs-p">
                    All linked-list commands go inside the <C>SEQUENCE</C> block.
                  </p>
                  <div className="docs-cmd-table-wrap">
                  <table className="docs-cmd-table">
                    <thead>
                      <tr><th>Command</th><th>Description</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><span className="tok-keyword">HIGHLIGHT</span> <span className="tok-param">name[i]</span></td>
                        <td>Pulses the node at logical index <C>i</C> with an accent color.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">INSERT_HEAD</span> <span className="tok-param">name value</span></td>
                        <td>Creates a new node and inserts it at the front of the list, re-routing <C>HEAD</C>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">INSERT_TAIL</span> <span className="tok-param">name value</span></td>
                        <td>Creates a new node and appends it to the end, pointing it to <C>NULL</C>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">DELETE_HEAD</span> <span className="tok-param">name</span></td>
                        <td>Removes the first node and advances the <C>HEAD</C> pointer to the next node.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">DELETE_TAIL</span> <span className="tok-param">name</span></td>
                        <td>Removes the last node and updates the previous node's pointer to <C>NULL</C>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">WAIT</span></td>
                        <td>Pauses the animation for one step. Useful to let the audience observe the current state.</td>
                      </tr>
                    </tbody>
                  </table>
                  </div>
                </section>

                <section id="sl-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Insertions & Deletions</h3>
                  <p className="docs-p">Exercises all four structural commands in sequence.</p>
                  <CodeBlock code={`SCENE SinglyOps\n\nDECLARE\n  LINKEDLIST list = [10, 20, 30]\n\nSEQUENCE\n  // Add to front and back\n  INSERT_HEAD list 5\n  INSERT_TAIL list 40\n\n  // Remove from front and back\n  DELETE_HEAD list\n  DELETE_TAIL list\nEND`} />
                  <p className="docs-p">
                    <strong>Expected:</strong> After both inserts, list is <C>5 → 10 → 20 → 30 → 40</C>. After both deletes, <C>10 → 20 → 30</C>.
                  </p>

                  <h3 className="docs-h3">Example 2 — Linear Traversal</h3>
                  <p className="docs-p">
                    Highlight every node in order to visualize a linear scan / search.
                  </p>
                  <CodeBlock code={`SCENE SinglyTraversal\n\nDECLARE\n  LINKEDLIST list = [10, 20, 30, 40]\n\nSEQUENCE\n  LOOP i FROM 0 TO 3\n    HIGHLIGHT list[i]\n    WAIT\n  END\nEND`} />
                </section>

                <section id="sl-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>
                  <Alert kind="warn" title="Index out of bounds">
                    <C>HIGHLIGHT list[5]</C> on a 3-node list is a runtime error. Keep indices within <C>0</C> to <C>LENGTH(list) - 1</C>.
                  </Alert>
                  <Alert kind="tip" title="HEAD is automatic">
                    <C>HEAD</C> is managed by the runtime. You cannot manually assign or read it — use commands instead.
                  </Alert>
                  <Alert kind="note" title="Traversal order">
                    Singly lists only support forward traversal. For backward traversal, use a Doubly Linked List.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                DOUBLY LINKED LIST PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'doubly-linked-list' && (
              <>
                <header className="docs-page-hero">
                  <div className="docs-page-tag">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
                      <line x1="7" y1="12" x2="10" y2="12" /><line x1="14" y1="12" x2="17" y2="12" />
                    </svg>
                    Linked Lists
                  </div>
                  <h1 className="docs-page-title">Doubly Linked List</h1>
                  <p className="docs-page-lead">
                    Each node carries both a <em>next</em> and a <em>prev</em> pointer, enabling rich bidirectional traversal and visually distinct two-headed edges.
                  </p>
                </header>

                <section id="dl-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A Doubly Linked List extends the singly variant by adding a backward (<em>prev</em>) pointer to every node. This allows traversal in both directions — forward from <C>HEAD</C> to <C>NULL</C>, and backward from any node to <C>HEAD</C>.
                  </p>
                  <p className="docs-p">
                    In the AQVL visualizer, doubly linked nodes render with two directed edges: a solid forward arrow and a dashed backward arrow, making the dual-pointer structure immediately clear.
                  </p>
                  <Alert kind="note" title="Visualization">
                    Each node displays two edges: a solid <em>next</em> arrow pointing right and a dashed <em>prev</em> arrow pointing left. Both animate smoothly on insert / delete.
                  </Alert>
                </section>

                <section id="dl-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a Doubly Linked List</h2>
                  <p className="docs-p">
                    Prepend the <C>DOUBLY</C> keyword before <C>LINKEDLIST</C>. Everything else is identical to the singly syntax.
                  </p>
                  <CodeBlock label="Syntax" code={`DOUBLY LINKEDLIST <name> = [<value>, <value>, ...]`} />
                  <p className="docs-p">A complete minimal program:</p>
                  <CodeBlock code={`SCENE DoublyIntro\n\nDECLARE\n  DOUBLY LINKEDLIST list = [10, 20, 30]\n\nSEQUENCE\n  HIGHLIGHT list[1]\nEND`} />
                  <p className="docs-p">
                    The runtime automatically wires every node with both forward and backward edges.
                  </p>
                </section>

                <section id="dl-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>
                  <p className="docs-p">
                    The same commands used for singly lists work on doubly lists. The runtime automatically manages both the <em>next</em> and <em>prev</em> pointers.
                  </p>
                  <div className="docs-cmd-table-wrap">
                  <table className="docs-cmd-table">
                    <thead>
                      <tr><th>Command</th><th>Description</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><span className="tok-keyword">HIGHLIGHT</span> <span className="tok-param">name[i]</span></td>
                        <td>Highlights the node at index <C>i</C>. Works the same as on a singly list.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">INSERT_HEAD</span> <span className="tok-param">name value</span></td>
                        <td>Inserts a new node at the front, updating both the <em>next</em> link from new node and the <em>prev</em> link of the old head.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">INSERT_TAIL</span> <span className="tok-param">name value</span></td>
                        <td>Inserts a new node at the end, creating a mutual link between it and the previous tail.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">DELETE_HEAD</span> <span className="tok-param">name</span></td>
                        <td>Removes the head node and clears the <em>prev</em> pointer on the new head.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">DELETE_TAIL</span> <span className="tok-param">name</span></td>
                        <td>Removes the tail node and clears the <em>next</em> pointer on the new tail.</td>
                      </tr>
                    </tbody>
                  </table>
                  </div>
                </section>

                <section id="dl-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Bidirectional Traversal</h3>
                  <p className="docs-p">
                    This example first traverses forward, then manually walks backward — possible only because of the <em>prev</em> pointers.
                  </p>
                  <CodeBlock code={`SCENE DoublyTraversal\n\nDECLARE\n  DOUBLY LINKEDLIST list = [10, 20, 30]\n\nSEQUENCE\n  // Forward pass\n  LOOP i FROM 0 TO 2\n    HIGHLIGHT list[i]\n    WAIT\n  END\n\n  // Backward pass\n  HIGHLIGHT list[2]\n  WAIT\n  HIGHLIGHT list[1]\n  WAIT\n  HIGHLIGHT list[0]\n  WAIT\nEND`} />
                  <p className="docs-p">
                    <strong>Expected:</strong> Nodes glow in order 10 → 20 → 30, then 30 → 20 → 10 — the backward arrows illuminate during the reverse pass.
                  </p>

                  <h3 className="docs-h3">Example 2 — Insert &amp; Delete</h3>
                  <CodeBlock code={`SCENE DoublyOps\n\nDECLARE\n  DOUBLY LINKEDLIST list = [10, 20, 30]\n\nSEQUENCE\n  INSERT_HEAD list 5\n  WAIT\n  INSERT_TAIL list 40\n  WAIT\n  DELETE_HEAD list\n  WAIT\n  DELETE_TAIL list\n  WAIT\nEND`} />
                </section>

                <section id="dl-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>
                  <Alert kind="warn" title="Index out of bounds">
                    Same rule as singly lists: indices must be within <C>0</C> to <C>LENGTH(list) - 1</C>.
                  </Alert>
                  <Alert kind="tip" title="Both pointers update automatically">
                    You never manually set <em>prev</em> — every insert/delete command fixes both ends of the edge automatically.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                CIRCULAR LINKED LIST PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'circular-linked-list' && (
              <>
                <header className="docs-page-hero">
                  <div className="docs-page-tag">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.5 12a9.5 9.5 0 1 1-9.5-9.5" />
                      <polyline points="21.5 3 21.5 7 17.5 7" />
                    </svg>
                    Linked Lists
                  </div>
                  <h1 className="docs-page-title">Circular Linked List</h1>
                  <p className="docs-page-lead">
                    The last node wraps back to the first, creating a continuous loop with no <code>NULL</code> terminator. Declared with the <span className="tok-circular">CIRCULAR</span> keyword.
                  </p>
                </header>

                <section id="cl-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A Circular Linked List is a singly linked list where the last node's <em>next</em> pointer does not point to <C>NULL</C> — it loops back to the <C>HEAD</C> node, forming a closed ring.
                  </p>
                  <p className="docs-p">
                    This structure is well-suited for round-robin scheduling, buffering, and any algorithm that needs to wrap around endlessly.
                  </p>
                  <Alert kind="note" title="Visualization">
                    The AQVL renderer draws the wrap-around edge as a curved arc that arcs back from the tail to the head, visually conveying the circular topology.
                  </Alert>
                </section>

                <section id="cl-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a Circular Linked List</h2>
                  <p className="docs-p">
                    Prepend the <span className="tok-circular">CIRCULAR</span> keyword before <C>LINKEDLIST</C>. The runtime automatically manages the tail-to-head back-edge.
                  </p>
                  <CodeBlock label="Syntax" code={`CIRCULAR LINKEDLIST <name> = [<value>, <value>, ...]`} />
                  <p className="docs-p">A complete minimal program:</p>
                  <CodeBlock code={`SCENE CircularIntro\n\nDECLARE\n  CIRCULAR LINKEDLIST clist = [1, 2, 3]\n\nSEQUENCE\n  // The circular back-edge is visible immediately\n  WAIT\nEND`} />
                  <p className="docs-p">
                    Even before any commands run, the visualizer shows the curved arc from node <em>3</em> back to node <em>1</em>.
                  </p>
                  <Alert kind="warn" title="No NULL node">
                    Unlike singly or doubly lists, a circular list has no <C>NULL</C> sentinel. The ring is truly endless — make sure your algorithm doesn't rely on finding a <C>NULL</C> terminator.
                  </Alert>
                </section>

                <section id="cl-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>
                  <p className="docs-p">
                    Circular lists support the same structural commands. After every insert or delete, the runtime automatically re-attaches the circular back-edge to the new extremity.
                  </p>
                  <div className="docs-cmd-table-wrap">
                  <table className="docs-cmd-table">
                    <thead>
                      <tr><th>Command</th><th>Description</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><span className="tok-keyword">HIGHLIGHT</span> <span className="tok-param">name[i]</span></td>
                        <td>Pulses the node at index <C>i</C>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">INSERT_HEAD</span> <span className="tok-param">name value</span></td>
                        <td>Inserts at the front. The tail's back-edge automatically re-points to the new head.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">INSERT_TAIL</span> <span className="tok-param">name value</span></td>
                        <td>Appends to the end. The new node's <em>next</em> wraps back to the head.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">DELETE_HEAD</span> <span className="tok-param">name</span></td>
                        <td>Removes the head and updates the tail's back-edge to point to the new head.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">DELETE_TAIL</span> <span className="tok-param">name</span></td>
                        <td>Removes the tail. The new tail's <em>next</em> is re-routed to the head.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">WAIT</span></td>
                        <td>Pauses the animation so the viewer can see the current circular state.</td>
                      </tr>
                    </tbody>
                  </table>
                  </div>
                </section>

                <section id="cl-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Circular Insertions</h3>
                  <p className="docs-p">
                    Observe how the back-edge dynamically re-attaches after each insertion.
                  </p>
                  <CodeBlock code={`SCENE CircularOps\n\nDECLARE\n  CIRCULAR LINKEDLIST clist = [1, 2, 3]\n\nSEQUENCE\n  // Observe the initial circular arc\n  WAIT\n\n  // Tail insert — new node becomes tail, arc moves\n  INSERT_TAIL clist 4\n  WAIT\n\n  // Head insert — new node becomes head, arc re-anchors\n  INSERT_HEAD clist 0\n  WAIT\nEND`} />
                  <p className="docs-p">
                    <strong>Expected:</strong> The curved back-edge visibly shifts to point from the new tail (4) back to the new head (0).
                  </p>

                  <h3 className="docs-h3">Example 2 — Circular Traversal</h3>
                  <p className="docs-p">
                    Because the list is circular, you can represent infinite round-robin traversal. This example shows two full cycles.
                  </p>
                  <CodeBlock code={`SCENE CircularTraversal\n\nDECLARE\n  CIRCULAR LINKEDLIST clist = [10, 20, 30]\n\nSEQUENCE\n  // First cycle\n  LOOP i FROM 0 TO 2\n    HIGHLIGHT clist[i]\n    WAIT\n  END\n\n  // Second cycle\n  LOOP i FROM 0 TO 2\n    HIGHLIGHT clist[i]\n    WAIT\n  END\nEND`} />
                </section>

                <section id="cl-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>
                  <Alert kind="warn" title="Infinite loop risk">
                    Because there is no <C>NULL</C> terminator, a naive traversal loop that keeps following <em>next</em> will loop forever. Always bound your <C>LOOP</C> with a known count.
                  </Alert>
                  <Alert kind="tip" title="Back-edge is automatic">
                    You never write code to maintain the circular back-edge. Every insert/delete command handles it for you.
                  </Alert>
                  <Alert kind="note" title="Works with DOUBLY too">
                    A future AQVL version will support <C>CIRCULAR DOUBLY LINKEDLIST</C> — a doubly linked ring. Watch the changelog!
                  </Alert>
                </section>
              </>
            )}
            {/* ══════════════════════════════════════════════
                TREES PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'trees' && (
              <>
                <header className="docs-page-hero">
                  <div className="docs-page-tag">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 2 22 22 22" />
                    </svg>
                    Data Structures
                  </div>
                  <h1 className="docs-page-title">Trees</h1>
                  <p className="docs-page-lead">
                    AQVL supports General Trees with intuitive hierarchical visualization and step-by-step traversal animations.
                  </p>
                </header>

                <section id="tr-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    In AQVL, a Tree is a hierarchical data structure composed of nodes. Trees visually arrange themselves from the root down, automatically maintaining a clean layout as nodes are added or removed.
                  </p>
                </section>

                <section id="tr-overview-general" className="docs-section">
                  <h2 className="docs-h2">General Tree</h2>
                  <p className="docs-p">
                    A general tree where each node can have an arbitrary number of children. It supports operations like assigning roots, adding children, and various traversal algorithms like BFS and DFS.
                  </p>
                  <CodeBlock label="Syntax" code={`TREE <name>`} />
                  <button
                    className="docs-nav-item docs-overview-link"
                    onClick={() => { setActivePage('general-tree'); setActiveId('gt-introduction'); }}
                  >
                    → Open full General Tree documentation
                  </button>
                </section>

                <section id="tr-overview-binary" className="docs-section">
                  <h2 className="docs-h2">Binary Tree</h2>
                  <p className="docs-p">
                    A hierarchical structure where each node has at most two children (left and right). Supports specific binary-tree traversals and navigation like sibling and ancestors.
                  </p>
                  <CodeBlock label="Syntax" code={`BINARY_TREE <name>`} />
                  <button
                    className="docs-nav-item docs-overview-link"
                    onClick={() => goToPage('binary-tree')}
                  >
                    → Open full Binary Tree documentation
                  </button>
                </section>

                <section id="tr-overview-bst" className="docs-section">
                  <h2 className="docs-h2">Binary Search Tree</h2>
                  <p className="docs-p">
                    A binary tree that maintains the search-order invariant — everything in a node's left subtree is
                    smaller, everything in its right subtree is larger. <C>INSERT</C>, <C>SEARCH</C>, and <C>DELETE</C>
                    animate the root-to-target descent one comparison at a time.
                  </p>
                  <CodeBlock label="Syntax" code={`BST <name>`} />
                  <button
                    className="docs-nav-item docs-overview-link"
                    onClick={() => goToPage('bst')}
                  >
                    → Open full Binary Search Tree documentation
                  </button>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                GENERAL TREE PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'general-tree' && (
              <>
                <header className="docs-page-hero">
                  <div className="docs-page-tag">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 2 22 22 22" />
                    </svg>
                    Trees
                  </div>
                  <h1 className="docs-page-title">General Tree</h1>
                  <p className="docs-page-lead">
                    A hierarchical structure where nodes can have multiple children. Build the tree, modify it, and visualize traversals and searches.
                  </p>
                </header>

                <section id="gt-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A General Tree implies a hierarchical structure. In AQVL, you can directly build and interact with trees in the <C>SEQUENCE</C> block by designating a <C>ROOT</C> and adding nodes as a <C>CHILD</C>.
                  </p>
                  <p className="docs-p">
                    AQVL handles the complex 3D layout of the tree automatically, ensuring that parent-child relationships are clearly visible as expanding branches.
                  </p>
                </section>

                <section id="gt-declaration" className="docs-section">
                  <h2 className="docs-h2">Building a General Tree</h2>
                  <p className="docs-p">
                    General tree operations can be invoked directly in the sequence. You start by setting a <C>ROOT</C> node and then defining relationships using <C>CHILD</C>.
                  </p>
                  <CodeBlock label="Syntax" code={`ROOT <value>\nCHILD <parentValue> <childValue>`} />
                  <p className="docs-p">A complete minimal program:</p>
                  <CodeBlock code={`SCENE MyTree\n\nSEQUENCE\n  ROOT A\n  CHILD A B\n  CHILD A C\nEND`} />
                </section>

                <section id="gt-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>
                  <p className="docs-p">
                    Tree commands inside the <C>SEQUENCE</C> block allow you to manipulate structure, traverse, and query relationships.
                  </p>
                  <div className="docs-cmd-table-wrap">
                  <table className="docs-cmd-table">
                    <thead>
                      <tr><th>Command</th><th>Description</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><span className="tok-keyword">ROOT</span> <span className="tok-param">value</span></td>
                        <td>Initializes the tree with a root node of <C>value</C>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">CHILD</span> <span className="tok-param">parentValue childValue</span></td>
                        <td>Adds a new node <C>childValue</C> under the existing <C>parentValue</C>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">INSERT</span> <span className="tok-param">childValue</span> <span className="tok-keyword">INTO</span> <span className="tok-param">parentValue</span></td>
                        <td>Dynamically inserts a new child node to an existing parent, adjusting the layout.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">DELETE</span> <span className="tok-param">value</span></td>
                        <td>Removes the node with the specified value and all its descendants.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">SEARCH</span> <span className="tok-param">targetValue</span></td>
                        <td>Searches the tree for the target, highlighting nodes as they are visited.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">PREORDER</span> / <span className="tok-keyword">LEVELORDER</span> / <span className="tok-keyword">DFS</span> / <span className="tok-keyword">BFS</span></td>
                        <td>Animates a specific tree traversal step-by-step.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">HEIGHT</span> / <span className="tok-keyword">SIZE</span> / <span className="tok-keyword">LEAVES</span></td>
                        <td>Tree queries that compute properties of the tree.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">ANCESTORS</span> <span className="tok-param">value</span> / <span className="tok-keyword">PATH</span> <span className="tok-param">val1 val2</span></td>
                        <td>Relationship queries that trace and highlight connections in the tree.</td>
                      </tr>
                    </tbody>
                  </table>
                  </div>
                </section>

                <section id="gt-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Comprehensive Tree Operations</h3>
                  <p className="docs-p">
                    Build a tree, traverse it, search for a node, perform queries, and modify it.
                  </p>
                  <CodeBlock code={`SCENE TreeOperations\n\nSEQUENCE\n    // 1. Create a tree and root node\n    ROOT A\n    \n    // 2. Add children\n    CHILD A B\n    CHILD A C\n    CHILD B D\n    CHILD B E\n    \n    // 3. Tree Traversals\n    PREORDER\n    LEVELORDER\n    DFS\n    BFS\n    \n    // 4. Searches\n    SEARCH E\n    \n    // 5. Tree Queries\n    HEIGHT\n    SIZE\n    LEAVES\n    \n    // 6. Modifications\n    INSERT F INTO B\n    DELETE D\n    \n    // 7. Relationships\n    ANCESTORS F\n    PATH A F\nEND`} />
                </section>

                <section id="gt-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>
                  <Alert kind="warn" title="Unique Values">
                    The value of each node is used to identify it. Adding a <C>CHILD</C> with a value that already exists will cause unexpected behavior or an error.
                  </Alert>
                  <Alert kind="tip" title="Use the Console">
                    Traversals and searches output a detailed log in the Playground Output Console, allowing you to follow the algorithm's decisions textually while watching the animation.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                BINARY TREE PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'binary-tree' && (
              <>
                <header className="docs-page-hero">
                  <div className="docs-page-tag">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 2 22 22 22" />
                    </svg>
                    Trees
                  </div>
                  <h1 className="docs-page-title">Binary Tree</h1>
                  <p className="docs-page-lead">
                    A hierarchical structure where nodes have at most two children. Build the tree using left and right child assignments and visualize traversals.
                  </p>
                </header>

                <section id="bt-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A Binary Tree is a tree data structure in which each node has at most two children, referred to as the left child and the right child. AQVL enables building binary trees directly in the <C>SEQUENCE</C> block by designating a <C>ROOT</C> and adding nodes with <C>LEFT_CHILD</C> and <C>RIGHT_CHILD</C>.
                  </p>
                  <p className="docs-p">
                    AQVL handles the complex 3D layout of the tree automatically, ensuring that parent-child relationships and Left/Right distinctions are clearly visible.
                  </p>
                </section>

                <section id="bt-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a Binary Tree</h2>
                  <p className="docs-p">
                    Place your binary tree declaration inside the <C>DECLARE</C> block. Once declared, you can build it up dynamically.
                  </p>
                  <CodeBlock label="Syntax" code={`BINARY_TREE <name>`} />
                  <p className="docs-p">A complete minimal program:</p>
                  <CodeBlock code={`SCENE MyBinaryTree\n\nDECLARE\n    BINARY_TREE myTree\n\nSEQUENCE\n    ROOT 10\n    LEFT_CHILD 10 5\n    RIGHT_CHILD 10 20\nEND`} />
                </section>

                <section id="bt-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>
                  <p className="docs-p">
                    Tree commands inside the <C>SEQUENCE</C> block allow you to manipulate structure, traverse, and query relationships.
                  </p>
                  <div className="docs-cmd-table-wrap">
                  <table className="docs-cmd-table">
                    <thead>
                      <tr><th>Command</th><th>Description</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><span className="tok-keyword">ROOT</span> <span className="tok-param">value</span></td>
                        <td>Initializes the tree with a root node of <C>value</C>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">LEFT_CHILD</span> <span className="tok-param">parentValue childValue</span></td>
                        <td>Adds <C>childValue</C> as the left child of <C>parentValue</C>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">RIGHT_CHILD</span> <span className="tok-param">parentValue childValue</span></td>
                        <td>Adds <C>childValue</C> as the right child of <C>parentValue</C>.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">DELETE</span> <span className="tok-param">value</span></td>
                        <td>Removes the node with the specified value and its edges.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">SEARCH</span> <span className="tok-param">targetValue</span></td>
                        <td>Searches the tree for the target, highlighting nodes.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">PREORDER</span> / <span className="tok-keyword">INORDER</span> / <span className="tok-keyword">POSTORDER</span> / <span className="tok-keyword">LEVELORDER</span> / <span className="tok-keyword">REVERSELEVELORDER</span> / <span className="tok-keyword">ZIGZAG</span> / <span className="tok-keyword">DFS</span> / <span className="tok-keyword">BFS</span></td>
                        <td>Animates a specific tree traversal step-by-step.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">HEIGHT</span> / <span className="tok-keyword">DEPTH</span> <span className="tok-param">value</span> / <span className="tok-keyword">LEVEL</span> <span className="tok-param">value</span> / <span className="tok-keyword">MAX_DEPTH</span> / <span className="tok-keyword">MIN_DEPTH</span></td>
                        <td>Performs structural depth and height measurements. Highlights paths to demonstrate values.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">COUNT_NODES</span> / <span className="tok-keyword">COUNT_LEAVES</span> / <span className="tok-keyword">COUNT_INTERNAL</span> / <span className="tok-keyword">COUNT_LEFT_LEAVES</span> / <span className="tok-keyword">COUNT_RIGHT_LEAVES</span> / <span className="tok-keyword">COUNT_FULL</span> / <span className="tok-keyword">COUNT_HALF</span></td>
                        <td>Counts specific topological structures in the tree and highlights the matching nodes.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">SIZE</span> / <span className="tok-keyword">LEAVES</span> / <span className="tok-keyword">INTERNAL</span> / <span className="tok-keyword">DEGREE</span> / <span className="tok-keyword">STATS</span></td>
                        <td>Retrieves overarching statistics about the tree.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">SIBLING</span> <span className="tok-param">value</span></td>
                        <td>Highlights the sibling of the specified node.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">ANCESTORS</span> <span className="tok-param">value</span> / <span className="tok-keyword">DESCENDANTS</span> <span className="tok-param">value</span></td>
                        <td>Traces and highlights ancestors up to the root, or all descendants down to leaves.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">IS_FULL</span> / <span className="tok-keyword">IS_COMPLETE</span> / <span className="tok-keyword">IS_PERFECT</span> / <span className="tok-keyword">IS_BALANCED</span> / <span className="tok-keyword">IS_SYMMETRIC</span> ...</td>
                        <td>Visually evaluates structural properties of the tree. Outputs pass/fail reasoning to the console.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">LCA</span> <span className="tok-param">v1 v2</span> / <span className="tok-keyword">DISTANCE</span> <span className="tok-param">v1 v2</span></td>
                        <td>Finds the Lowest Common Ancestor or calculates distance between two nodes.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">GRANDPARENT</span> / <span className="tok-keyword">UNCLE</span> / <span className="tok-keyword">COUSINS</span> <span className="tok-param">value</span></td>
                        <td>Resolves familial relationships by tracing lineage.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">ROOT_TO_NODE</span> <span className="tok-param">value</span> / <span className="tok-keyword">ROOT_TO_LEAVES</span> / <span className="tok-keyword">LONGEST_PATH</span> / <span className="tok-keyword">SHORTEST_PATH</span></td>
                        <td>Discovers and traces specific structural paths visually.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">MIRROR</span> / <span className="tok-keyword">INVERT</span></td>
                        <td>Inverts the binary tree, visually swapping left and right subtrees at each node.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">PRUNE</span> / <span className="tok-keyword">REMOVE_LEAVES</span></td>
                        <td>Identifies all leaf nodes and smoothly removes them from the tree.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">LEFT_VIEW</span> / <span className="tok-keyword">RIGHT_VIEW</span> / <span className="tok-keyword">TOP_VIEW</span> / <span className="tok-keyword">BOTTOM_VIEW</span></td>
                        <td>Calculates the respective 2D view of the tree and highlights the visible nodes.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">BOUNDARY</span> / <span className="tok-keyword">VERTICAL_ORDER</span> / <span className="tok-keyword">DIAGONAL</span></td>
                        <td>Performs advanced traversals and highlights the resulting nodes in order.</td>
                      </tr>
                      <tr>
                        <td><span className="tok-keyword">MAX_VALUE</span> / <span className="tok-keyword">MIN_VALUE</span> / <span className="tok-keyword">SUM</span> / <span className="tok-keyword">AVERAGE</span> / <span className="tok-keyword">MAX_LEVEL_SUM</span></td>
                        <td>Performs aggregate mathematical operations on the node values and logs the results.</td>
                      </tr>
                    </tbody>
                  </table>
                  </div>
                </section>

                <section id="bt-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Comprehensive Tree Operations</h3>
                  <p className="docs-p">
                    Build a tree, test navigations, update a node, and traverse the structure.
                  </p>
                  <CodeBlock code={`SCENE BinaryTreeTest\n\nDECLARE\n    BINARY_TREE myTree\n\nSEQUENCE\n    // 1. Build the Tree\n    ROOT 10\n    LEFT_CHILD 10 5\n    RIGHT_CHILD 10 20\n    LEFT_CHILD 5 2\n    RIGHT_CHILD 5 7\n    RIGHT_CHILD 20 35\n    WAIT\n    \n    // 2. Test Search & Update\n    SEARCH 7\n    WAIT\n    UPDATE 7 8\n    WAIT\n\n    // 3. Test Navigation Operations\n    SIBLING 5\n    WAIT\n    ANCESTORS 7\n    WAIT\n    DESCENDANTS 10\n    WAIT\n\n    // 4. Test Traversals\n    LEVELORDER\n    WAIT\n    \n    // 5. Test Clear\n    CLEAR\n    IS_EMPTY\nEND`} />

                  <h3 className="docs-h3">Example 2 — Traversals and Measurements</h3>
                  <p className="docs-p">
                    Build an array-based binary tree, traverse it using different patterns, and count its topological features.
                  </p>
                  <CodeBlock code={`SCENE BinaryTreeMetrics\n\nDECLARE\n    BINARY_TREE myTree = [10, 20, 30, 40, 50, 60, 70, 80, 90]\n\nSEQUENCE\n    // 1. Traversals\n    ZIGZAG\n    WAIT\n    REVERSELEVELORDER\n    WAIT\n    INORDER\n    WAIT\n\n    // 2. Structural Measurements\n    MAX_DEPTH\n    WAIT\n    LEVEL 40\n    WAIT\n\n    // 3. Counting Operations\n    COUNT_LEAVES\n    WAIT\n    COUNT_LEFT_LEAVES\n    WAIT\n    COUNT_FULL\nEND`} />

                  <h3 className="docs-h3">Example 3 — Properties, Paths &amp; Relationships</h3>
                  <p className="docs-p">
                    Test structural properties of a tree, find paths, and resolve node relationships.
                  </p>
                  <CodeBlock code={`SCENE BinaryTreeAnalysis\n\nDECLARE\n    BINARY_TREE myTree = [10, 20, 35, 40, 50, 60, 70]\n\nSEQUENCE\n    // 1. Structural Checks\n    IS_FULL\n    WAIT\n    IS_BALANCED\n    WAIT\n    IS_COMPLETE\n    WAIT\n\n    // 2. Finding Paths\n    ROOT_TO_NODE 50\n    WAIT\n    LONGEST_PATH\n    WAIT\n    \n    // 3. Finding Relatives\n    UNCLE 40\n    WAIT\n    COUSINS 40\n    WAIT\n    LCA 40 60\nEND`} />

                  <h3 className="docs-h3">Example 4 — Advanced Visualizations</h3>
                  <p className="docs-p">
                    Test the new advanced tree visualizations including tree inversion, aggregate calculations, and dynamic tree views.
                  </p>
                  <CodeBlock code={`SCENE AdvancedTree\n\nDECLARE\n    BINARY_TREE myTree = [10, 20, 30, 40, 50, 60, 70]\n\nSEQUENCE\n    // 1. Advanced Structural Modifiers\n    INVERT\n    WAIT\n    PRUNE\n    WAIT\n\n    // 2. Aggregate Algorithms\n    MAX_VALUE\n    WAIT\n    SUM\n    WAIT\n    MAX_LEVEL_SUM\n    WAIT\n\n    // 3. Tree Views\n    LEFT_VIEW\n    WAIT\n    VERTICAL_ORDER\n    WAIT\n    BOUNDARY\nEND`} />
                </section>

                <section id="bt-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>
                  <Alert kind="warn" title="Unique Values">
                    The value of each node is used to identify it. Adding a node with a value that already exists will cause unexpected behavior or an error.
                  </Alert>
                  <Alert kind="tip" title="Use the Console">
                    Traversals and searches output a detailed log in the Playground Output Console, allowing you to follow the algorithm's decisions textually while watching the animation.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                STACKS PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'stacks' && (
              <>
                <header className="docs-page-hero">
                  <div className="docs-page-tag">Data Structures</div>
                  <div className="docs-page-title-row">
                    <div className="docs-page-title-icon">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="16" width="20" height="5" rx="1" />
                        <rect x="2" y="9" width="20" height="5" rx="1" />
                        <rect x="2" y="3" width="20" height="4" rx="1" />
                      </svg>
                    </div>
                    <h1 className="docs-page-title">Stacks</h1>
                  </div>
                  <p className="docs-page-lead">
                    A last-in, first-out pile of values. AQVL renders a stack as a vertical column of boxes that grows
                    upward on <code>PUSH</code> and collapses on <code>POP</code>.
                  </p>
                </header>

                <section id="sk-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A <C>STACK</C> is a LIFO (last-in, first-out) collection: the only element you can read or remove is
                    the one most recently added — the <em>top</em>. Stacks are the backbone of recursion, undo history,
                    expression evaluation, and iterative depth-first search.
                  </p>
                  <p className="docs-p">
                    Unlike an <C>ARRAY</C>, a stack has no indexing commands in its everyday vocabulary. You interact
                    with it entirely through <C>PUSH</C>, <C>POP</C>, and <C>PEEK</C>, which is exactly what makes the
                    animation readable: every frame shows one element entering or leaving at a single point.
                  </p>
                  <Alert kind="note" title="Visualization">
                    Stack elements are laid out as a vertical column (bottom-up). A pushed element drops in from above
                    and the popped element lifts out of the top, so the LIFO order is visible rather than implied.
                  </Alert>
                </section>

                <section id="sk-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a Stack</h2>
                  <p className="docs-p">
                    Declare a stack inside the <C>DECLARE</C> block. The initializer is optional — a stack may start
                    empty and be filled entirely from the <C>SEQUENCE</C> block.
                  </p>
                  <CodeBlock label="Syntax" code={`STACK <name>
STACK <name> = [<value>, <value>, ...]`} />

                  <p className="docs-p">A full minimal program:</p>
                  <CodeBlock code={`SCENE StackIntro

DECLARE
  STACK s = [10, 20]

SEQUENCE
  PUSH s 30
  PEEK s
  POP s
END`} />
                  <p className="docs-p">
                    On load the visualizer shows a two-box column with <em>20</em> on top. The sequence then pushes
                    <em> 30</em>, flashes it as the current top, and removes it again.
                  </p>
                  <Alert kind="tip" title="Empty stacks are allowed">
                    Unlike <C>ARRAY</C>, which requires an initializer, <C>STACK s</C> on its own is valid. The listed
                    values are pushed bottom-to-top, so <C>STACK s = [10, 20]</C> leaves <C>20</C> on top.
                  </Alert>
                </section>

                <section id="sk-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>
                  <p className="docs-p">
                    Every stack command takes the stack's name as its first argument, so a scene can animate several
                    stacks side by side.
                  </p>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Command</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">PUSH</span> <span className="tok-param">name value</span></td>
                          <td>Creates a new element carrying <C>value</C> and drops it onto the top of the stack. The column grows by one.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">POP</span> <span className="tok-param">name</span></td>
                          <td>Removes the top element and animates it lifting away. Popping an empty stack is a runtime underflow error.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">PEEK</span> <span className="tok-param">name</span></td>
                          <td>Highlights the top element without removing it. The stack is left unchanged.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">SIZE</span> <span className="tok-param">name</span></td>
                          <td>Reports the current element count to the output console.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">IS_EMPTY</span> <span className="tok-param">name</span></td>
                          <td>Reports whether the stack currently holds zero elements.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">CLEAR</span> <span className="tok-param">name</span></td>
                          <td>Removes every element at once, returning the stack to its empty state.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">WAIT</span></td>
                          <td>Pauses one animation beat — useful between a <C>PEEK</C> and the <C>POP</C> that follows it.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section id="sk-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Every Stack Operation</h3>
                  <p className="docs-p">Each command in turn, so you can watch what every one of them looks like.</p>
                  <CodeBlock code={`SCENE StackOps

DECLARE
  STACK s

SEQUENCE
  PUSH s 10
  PUSH s 20
  PUSH s 30

  // Look at the top without removing it
  PEEK s
  WAIT

  // Remove the top element
  POP s
  SIZE s
  IS_EMPTY s

  CLEAR s
  IS_EMPTY s
END`} />
                  <p className="docs-p">
                    <strong>Expected behavior:</strong> the column builds up to <C>10, 20, 30</C> (30 on top),
                    <C>PEEK</C> flashes 30, <C>POP</C> removes it leaving size 2, and <C>CLEAR</C> empties the column so
                    the final <C>IS_EMPTY</C> reports true.
                  </p>

                  <h3 className="docs-h3">Example 2 — Reversing an Array With a Stack</h3>
                  <p className="docs-p">
                    The canonical use of LIFO order: push every element in order, then pop them back out to get the
                    reverse.
                  </p>
                  <CodeBlock code={`SCENE ReverseWithStack

DECLARE
  ARRAY arr = [1, 2, 3, 4]
  STACK s

SEQUENCE
  // Push left to right
  LOOP i FROM 0 TO LENGTH(arr) - 1
    HIGHLIGHT arr[i]
    PUSH s arr[i]
    WAIT
  END

  // Pop back out — the reverse order
  LOOP i FROM 0 TO LENGTH(arr) - 1
    POP s
    WAIT
  END
END`} />
                  <p className="docs-p">
                    <strong>Expected behavior:</strong> the column fills bottom-up with 1, 2, 3, 4 and then unwinds
                    4, 3, 2, 1 — the reversal is visible as the animation itself.
                  </p>

                  <h3 className="docs-h3">Example 3 — Two Stacks Side by Side</h3>
                  <p className="docs-p">
                    Moving every element from one stack to another reverses it, the trick behind the classic
                    two-stack queue.
                  </p>
                  <CodeBlock code={`SCENE TwoStacks

DECLARE
  STACK inbox = [1, 2, 3]
  STACK outbox

SEQUENCE
  PEEK inbox
  POP inbox
  PUSH outbox 3
  WAIT

  POP inbox
  PUSH outbox 2
  WAIT

  POP inbox
  PUSH outbox 1

  IS_EMPTY inbox
  SIZE outbox
END`} />
                </section>

                <section id="sk-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>

                  <Alert kind="warn" title="Stack underflow">
                    <C>POP</C> or <C>PEEK</C> on an empty stack raises a stack-underflow error and halts the sequence.
                    Guard long pop loops with <C>IS_EMPTY</C>, or bound the loop by the number of elements you pushed.
                  </Alert>

                  <Alert kind="warn" title="The stack name is required">
                    Write <C>PUSH s 10</C>, not <C>PUSH 10</C>. The first argument of every stack command names the
                    target stack; omitting it makes the value itself get read as the stack name.
                  </Alert>

                  <Alert kind="warn" title="Avoid reserved words as names">
                    Keyword matching is case-insensitive, so <C>STACK size</C> or <C>STACK head</C> fail to parse —
                    <C>SIZE</C> and <C>HEAD</C> are language keywords. Prefer names like <C>s</C>, <C>callStack</C>,
                    or <C>inbox</C>.
                  </Alert>

                  <Alert kind="tip" title="Stacks are not indexable by convention">
                    Reaching into the middle of a stack defeats the abstraction the visualization is teaching. Use
                    <C>PEEK</C> for the top, and reach for an <C>ARRAY</C> when you genuinely need random access.
                  </Alert>

                  <Alert kind="note" title="Changing the layout">
                    A stack defaults to a vertical column. <C>LAYOUT s AS LINE(axis=horizontal)</C> lays it out as a row
                    instead — see the Layout &amp; Camera page.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                QUEUES PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'queues' && (
              <>
                <header className="docs-page-hero">
                  <div className="docs-page-tag">Data Structures</div>
                  <div className="docs-page-title-row">
                    <div className="docs-page-title-icon">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="8" width="5" height="8" rx="1" />
                        <rect x="9" y="8" width="5" height="8" rx="1" />
                        <rect x="16" y="8" width="5" height="8" rx="1" />
                      </svg>
                    </div>
                    <h1 className="docs-page-title">Queues</h1>
                  </div>
                  <p className="docs-page-lead">
                    A first-in, first-out line of values. Elements join at the rear and leave from the front, rendered
                    as a horizontal row that advances as it drains.
                  </p>
                </header>

                <section id="qu-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A <C>QUEUE</C> is a FIFO (first-in, first-out) collection. New elements are added at the <em>rear</em>
                    with <C>ENQUEUE</C>; elements leave from the <em>front</em> with <C>DEQUEUE</C>. It is the structure
                    behind breadth-first search, level-order tree traversal, scheduling, and buffering.
                  </p>
                  <p className="docs-p">
                    Queues are the mirror image of stacks, and AQVL keeps that contrast visual: a stack is a vertical
                    column that grows and shrinks at one end, while a queue is a horizontal row with two distinct ends.
                  </p>
                  <Alert kind="note" title="Visualization">
                    Queue elements are laid out left to right, front-most first. <C>FRONT</C> and <C>REAR</C> highlight
                    the two ends without modifying the queue.
                  </Alert>
                </section>

                <section id="qu-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a Queue</h2>
                  <p className="docs-p">
                    As with stacks, the initializer is optional. Listed values are enqueued left to right, so the first
                    value is the front of the queue.
                  </p>
                  <CodeBlock label="Syntax" code={`QUEUE <name>
QUEUE <name> = [<value>, <value>, ...]`} />

                  <p className="docs-p">A full minimal program:</p>
                  <CodeBlock code={`SCENE QueueIntro

DECLARE
  QUEUE q = [1, 2, 3]

SEQUENCE
  ENQUEUE q 4
  FRONT q
  DEQUEUE q
END`} />
                  <p className="docs-p">
                    The row starts as <C>1, 2, 3</C>, gains a <C>4</C> at the rear, flashes <C>1</C> as the front, then
                    removes it — leaving <C>2, 3, 4</C>.
                  </p>
                </section>

                <section id="qu-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Command</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">ENQUEUE</span> <span className="tok-param">name value</span></td>
                          <td>Adds a new element carrying <C>value</C> at the rear of the queue.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">DEQUEUE</span> <span className="tok-param">name</span></td>
                          <td>Removes the front element; the remaining elements slide forward to close the gap.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">FRONT</span> <span className="tok-param">name</span></td>
                          <td>Highlights the front element (the next one to leave) without removing it.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">REAR</span> <span className="tok-param">name</span></td>
                          <td>Highlights the rear element (the most recently added) without removing it.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">SIZE</span> <span className="tok-param">name</span></td>
                          <td>Reports the current element count to the output console.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">IS_EMPTY</span> <span className="tok-param">name</span></td>
                          <td>Reports whether the queue currently holds zero elements.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">CLEAR</span> <span className="tok-param">name</span></td>
                          <td>Removes every element at once.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section id="qu-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Every Queue Operation</h3>
                  <CodeBlock code={`SCENE QueueOps

DECLARE
  QUEUE q

SEQUENCE
  ENQUEUE q 10
  ENQUEUE q 20
  ENQUEUE q 30

  // Inspect both ends
  FRONT q
  WAIT
  REAR q
  WAIT

  DEQUEUE q
  SIZE q
  IS_EMPTY q

  CLEAR q
  IS_EMPTY q
END`} />
                  <p className="docs-p">
                    <strong>Expected behavior:</strong> the row builds to <C>10, 20, 30</C>; <C>FRONT</C> flashes 10 and
                    <C>REAR</C> flashes 30; <C>DEQUEUE</C> removes 10 and the rest slide left.
                  </p>

                  <h3 className="docs-h3">Example 2 — Feeding a Queue From an Array</h3>
                  <p className="docs-p">
                    A loop that enqueues each array element, then drains the queue in the same order it was filled —
                    FIFO preserves order, unlike the stack version on the Stacks page.
                  </p>
                  <CodeBlock code={`SCENE QueueFromArray

DECLARE
  ARRAY arr = [5, 6, 7, 8]
  QUEUE q

SEQUENCE
  LOOP i FROM 0 TO LENGTH(arr) - 1
    HIGHLIGHT arr[i]
    ENQUEUE q arr[i]
    WAIT
  END

  LOOP i FROM 0 TO LENGTH(arr) - 1
    FRONT q
    DEQUEUE q
    WAIT
  END

  IS_EMPTY q
END`} />

                  <h3 className="docs-h3">Example 3 — A BFS Frontier</h3>
                  <p className="docs-p">
                    Breadth-first search is a queue with a graph attached. Here the queue is driven by hand alongside a
                    graph so the frontier and the traversal are visible at the same time.
                  </p>
                  <CodeBlock code={`SCENE BFSFrontier

DECLARE
  GRAPH g = ["A->B", "A->C", "B->D"]
  QUEUE frontier

SEQUENCE
  // Visit A, then queue its neighbours
  HIGHLIGHT g["A"]
  ENQUEUE frontier 1
  ENQUEUE frontier 2
  WAIT

  // Dequeue B, visit it, queue D
  DEQUEUE frontier
  HIGHLIGHT g["B"]
  ENQUEUE frontier 3
  WAIT

  // Dequeue C, then D
  DEQUEUE frontier
  HIGHLIGHT g["C"]
  WAIT
  DEQUEUE frontier
  HIGHLIGHT g["D"]

  IS_EMPTY frontier
END`} />
                </section>

                <section id="qu-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>

                  <Alert kind="warn" title="Dequeuing an empty queue">
                    <C>DEQUEUE</C>, <C>FRONT</C>, and <C>REAR</C> on an empty queue have nothing to act on and report an
                    error to the console. Check with <C>IS_EMPTY</C> first when the count is not obvious.
                  </Alert>

                  <Alert kind="warn" title="ENQUEUE takes a name and a value">
                    <C>ENQUEUE q 4</C> — the queue first, the value second. <C>ENQUEUE 4</C> is parsed as a queue named
                    <C>4</C> with no value.
                  </Alert>

                  <Alert kind="tip" title="FRONT before DEQUEUE reads better">
                    Highlighting the element you are about to remove, waiting a beat, then removing it makes the FIFO
                    rule obvious to a viewer in a way that a bare <C>DEQUEUE</C> does not.
                  </Alert>

                  <Alert kind="note" title="Queues vs. stacks">
                    Both hold a pending collection; only the exit rule differs. Swapping <C>PUSH</C>/<C>POP</C> for
                    <C>ENQUEUE</C>/<C>DEQUEUE</C> turns a depth-first algorithm into a breadth-first one.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                GRAPHS PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'graphs' && (
              <>
                <header className="docs-page-hero">
                  <div className="docs-page-tag">Data Structures</div>
                  <div className="docs-page-title-row">
                    <div className="docs-page-title-icon">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="4" height="4" rx="1" />
                        <rect x="10" y="10" width="4" height="4" rx="1" />
                        <rect x="18" y="17" width="4" height="4" rx="1" />
                        <line x1="6" y1="5" x2="10" y2="12" />
                        <line x1="14" y1="12" x2="18" y2="19" />
                      </svg>
                    </div>
                    <h1 className="docs-page-title">Graphs</h1>
                  </div>
                  <p className="docs-page-lead">
                    Vertices connected by edges, placed by a force-directed simulation — with traversals and
                    shortest-path algorithms available as single keywords.
                  </p>
                </header>

                <section id="gp-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A <C>GRAPH</C> is a set of vertices joined by edges. It is the most general of AQVL's structures —
                    arrays, lists, and trees are all special cases of it — and the one where layout matters most, so
                    graphs default to a force-directed layout that spreads vertices apart while keeping connected pairs
                    close.
                  </p>
                  <p className="docs-p">
                    Vertices are named by string keys rather than numeric indices. Once declared, an individual vertex is
                    addressed as <C>g["A"]</C>, and whole-graph algorithms like <C>DFS</C> or <C>DIJKSTRA</C> take the
                    graph name plus an optional start vertex.
                  </p>
                  <Alert kind="note" title="Visualization">
                    Each vertex renders as a labelled node and each edge as a line between two nodes. Traversal
                    algorithms colour vertices in visit order and trace the edges they cross.
                  </Alert>
                </section>

                <section id="gp-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a Graph</h2>
                  <p className="docs-p">
                    A graph is declared from a list of edge strings. Each string names two vertices and the arrow between
                    them; any vertex mentioned in an edge is created automatically, so there is no separate vertex list
                    to keep in sync.
                  </p>
                  <CodeBlock label="Syntax" code={`GRAPH <name>
GRAPH <name> = ["<from>-><to>", "<from>-><to>", ...]`} />

                  <p className="docs-p">A full minimal program:</p>
                  <CodeBlock code={`SCENE GraphIntro

DECLARE
  GRAPH g = ["A->B", "A->C", "B->D"]

SEQUENCE
  HIGHLIGHT g["A"]
  DFS g "A"
END`} />
                  <p className="docs-p">
                    Four vertices (A, B, C, D) and three directed edges appear immediately, arranged by the
                    force-directed layout. The sequence then highlights A and runs a depth-first traversal from it.
                  </p>
                  <Alert kind="tip" title="Edge strings are ordinary string literals">
                    Either quote style works — <C>"A-&gt;B"</C> and <C>'A-&gt;B'</C> are the same. The arrow lives
                    inside the string, so it is never confused with the <C>-&gt;</C> relationship operator.
                  </Alert>
                  <Alert kind="warn" title="Vertices cannot be added mid-sequence">
                    There is no <C>VERTEX</C> statement inside <C>SEQUENCE</C>. Declare every vertex up front through the
                    edge list, then use <C>CONNECT</C> and <C>DISCONNECT</C> to change which of them are joined.
                  </Alert>
                </section>

                <section id="gp-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>

                  <h3 className="docs-h3">Structure &amp; Access</h3>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Command</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">HIGHLIGHT</span> <span className="tok-param">name["key"]</span></td>
                          <td>Pulses a single vertex by its string key. The same access form works anywhere an expression is expected.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">CONNECT</span> <span className="tok-param">name "from" "to"</span></td>
                          <td>Draws a new edge between two existing vertices.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">DISCONNECT</span> <span className="tok-param">name "from" "to"</span></td>
                          <td>Removes the edge between two vertices, leaving both vertices in place.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">SIZE</span> <span className="tok-param">name</span></td>
                          <td>Reports the vertex count to the output console.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">CLEAR</span> <span className="tok-param">name</span></td>
                          <td>Removes every vertex and edge.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h3 className="docs-h3">Traversals &amp; Algorithms</h3>
                  <p className="docs-p">
                    Each of these runs a full algorithm as one statement, animating every step: the vertex under
                    consideration, the edges relaxed or rejected, and the final result set.
                  </p>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Command</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">DFS</span> <span className="tok-param">name "start"</span></td>
                          <td>Depth-first traversal — follows one branch as deep as it goes before backtracking.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">BFS</span> <span className="tok-param">name "start"</span></td>
                          <td>Breadth-first traversal — visits every vertex at the current distance before going deeper.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">DIJKSTRA</span> <span className="tok-param">name "start"</span></td>
                          <td>Single-source shortest paths over non-negative edge weights, relaxing one edge at a time.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">BELLMAN_FORD</span> <span className="tok-param">name "start"</span></td>
                          <td>Single-source shortest paths that also tolerates negative edge weights.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">ASTAR</span> <span className="tok-param">name "start"</span></td>
                          <td>Heuristic-guided shortest path — the informed counterpart to Dijkstra.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">PRIM</span> <span className="tok-param">name</span></td>
                          <td>Builds a minimum spanning tree by repeatedly adding the cheapest edge leaving the tree.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">KRUSKAL</span> <span className="tok-param">name</span></td>
                          <td>Builds a minimum spanning tree by adding globally cheapest edges that do not form a cycle.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">TOPO_SORT</span> <span className="tok-param">name</span></td>
                          <td>Orders the vertices of a directed acyclic graph so every edge points forward.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section id="gp-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Depth-First vs. Breadth-First</h3>
                  <p className="docs-p">
                    The same graph traversed both ways. Running them back to back on one scene makes the difference in
                    visit order unmistakable.
                  </p>
                  <CodeBlock code={`SCENE GraphTraversals

DECLARE
  GRAPH g = ["A->B", "A->C", "B->D", "B->E", "C->F"]

SEQUENCE
  DFS g "A"
  WAIT

  BFS g "A"
  WAIT
END`} />
                  <p className="docs-p">
                    <strong>Expected behavior:</strong> DFS dives A → B → D before coming back for E and C;
                    BFS sweeps A, then B and C, then D, E, and F.
                  </p>

                  <h3 className="docs-h3">Example 2 — Hand-Stepped BFS by Level</h3>
                  <p className="docs-p">
                    Stepping the traversal manually, one level per <C>WAIT</C>, when you want to narrate each level
                    rather than play the whole algorithm at once.
                  </p>
                  <CodeBlock code={`SCENE BFSByLevel

DECLARE
  GRAPH myGraph = [
    "A->B",
    "A->C",
    "B->D",
    "B->E",
    "C->F"
  ]

SEQUENCE
  // Level 0
  HIGHLIGHT myGraph["A"]
  WAIT

  // Level 1
  HIGHLIGHT myGraph["B"]
  HIGHLIGHT myGraph["C"]
  WAIT

  // Level 2
  HIGHLIGHT myGraph["D"]
  HIGHLIGHT myGraph["E"]
  HIGHLIGHT myGraph["F"]
  WAIT
END`} />

                  <h3 className="docs-h3">Example 3 — Rewiring a Graph</h3>
                  <p className="docs-p">
                    Edges can be added and removed mid-sequence; the layout re-settles around the change.
                  </p>
                  <CodeBlock code={`SCENE GraphRewire

DECLARE
  GRAPH g = ["A->B", "B->C"]

SEQUENCE
  // Close the loop
  CONNECT g "C" "A"
  WAIT

  // Break the original first edge
  DISCONNECT g "A" "B"
  WAIT

  SIZE g
END`} />

                  <h3 className="docs-h3">Example 4 — Shortest Paths and Spanning Trees</h3>
                  <p className="docs-p">
                    The one-shot algorithm keywords, each animating its full run against the same graph.
                  </p>
                  <CodeBlock code={`SCENE GraphAlgorithms

DECLARE
  GRAPH g = ["A->B", "A->C", "B->D", "C->D", "D->E"]

SEQUENCE
  DIJKSTRA g "A"
  WAIT

  TOPO_SORT g
  WAIT

  PRIM g
  WAIT

  KRUSKAL g
END`} />
                </section>

                <section id="gp-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>

                  <Alert kind="warn" title="Unknown vertex key">
                    <C>HIGHLIGHT g["Z"]</C> on a graph with no <C>Z</C> vertex finds nothing to animate. Vertex keys are
                    exactly the strings used in the edge list, including case.
                  </Alert>

                  <Alert kind="warn" title="Traversals need a non-empty graph">
                    <C>DFS</C> and friends report a warning and do nothing when the named graph has no vertices — the
                    usual cause is a <C>GRAPH g</C> declaration with no edge list and no <C>CONNECT</C> before the call.
                  </Alert>

                  <Alert kind="warn" title="TOPO_SORT requires a DAG">
                    A topological order only exists for a directed graph with no cycles. Run it on a graph containing a
                    cycle and the algorithm reports that no valid ordering exists.
                  </Alert>

                  <Alert kind="tip" title="Freeze a graph into a circle to show a cycle">
                    <C>LAYOUT g AS CIRCULAR(radius=3)</C> replaces the physics simulation with an even ring, which makes
                    a cycle far easier to point at than a force-directed blob.
                  </Alert>

                  <Alert kind="note" title="Start vertex is optional">
                    <C>DFS g</C> starts from the first declared vertex. Passing it explicitly — <C>DFS g "A"</C> — is
                    clearer and survives edits to the edge list.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                BINARY SEARCH TREE PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'bst' && (
              <>
                <header className="docs-page-hero">
                  <div className="docs-page-tag">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 2 22 22 22" />
                    </svg>
                    Trees
                  </div>
                  <h1 className="docs-page-title">Binary Search Tree</h1>
                  <p className="docs-page-lead">
                    A binary tree that keeps its values in order — smaller to the left, larger to the right — so every
                    insert, search, and delete is an animated walk down a single path.
                  </p>
                </header>

                <section id="bst-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A <C>BST</C> is a binary tree with an ordering invariant: every value in a node's left subtree is
                    smaller than the node, and every value in its right subtree is larger. That single rule is what turns
                    a search from a scan of the whole structure into one descent from the root.
                  </p>
                  <p className="docs-p">
                    Unlike <C>BINARY_TREE</C>, where you place each child yourself with <C>LEFT_CHILD</C> and
                    <C>RIGHT_CHILD</C>, a BST places nodes for you: <C>INSERT</C> compares against each node on the way
                    down and descends left or right until it finds the empty slot the value belongs in.
                  </p>
                  <Alert kind="note" title="Visualization">
                    Each comparison on the descent is highlighted in turn, so the path taken is visible rather than
                    inferred. The tree re-balances its layout — not its shape — after every structural change.
                  </Alert>
                </section>

                <section id="bst-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a BST</h2>
                  <p className="docs-p">
                    Declare an empty BST and build it with <C>INSERT</C>, or give an initial value list — those values
                    are inserted in order, exactly as if you had written one <C>INSERT</C> per value.
                  </p>
                  <CodeBlock label="Syntax" code={`BST <name>
BST <name> = [<value>, <value>, ...]`} />

                  <p className="docs-p">A full minimal program:</p>
                  <CodeBlock code={`SCENE BSTIntro

DECLARE
  BST myTree

SEQUENCE
  INSERT 50
  INSERT 30
  INSERT 70
  SEARCH 30
END`} />
                  <p className="docs-p">
                    50 becomes the root; 30 is smaller so it goes left; 70 is larger so it goes right. The final
                    <C>SEARCH</C> walks root → left and stops on the match.
                  </p>
                  <Alert kind="tip" title="BST commands take a value, not a name">
                    Tree actions operate on the active tree, so it is <C>INSERT 50</C>, not <C>INSERT myTree 50</C>.
                    Node values identify nodes throughout the tree vocabulary.
                  </Alert>
                  <Alert kind="warn" title="Do not name a structure after a keyword">
                    <C>BST tree</C> fails to parse: keyword matching is case-insensitive and <C>TREE</C> is a keyword.
                    Use <C>myTree</C>, <C>bst</C>, or any non-reserved name.
                  </Alert>
                </section>

                <section id="bst-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>

                  <h3 className="docs-h3">Structural Operations</h3>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Command</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">INSERT</span> <span className="tok-param">value</span></td>
                          <td>Descends from the root, comparing at each node, and attaches a new node at the empty slot where <C>value</C> belongs.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">DELETE</span> <span className="tok-param">value</span></td>
                          <td>Finds the node and removes it, handling all three cases: a leaf is detached, a one-child node is replaced by its child, and a two-child node is replaced by its in-order successor.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">SEARCH</span> <span className="tok-param">value</span></td>
                          <td>Animates the root-to-target descent, highlighting each comparison, and reports whether the value was found.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">CLEAR</span></td>
                          <td>Removes every node, leaving an empty tree.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h3 className="docs-h3">Traversals</h3>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Command</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">INORDER</span></td>
                          <td>Left, node, right — on a BST this visits the values in ascending sorted order, which is the invariant made visible.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">PREORDER</span></td>
                          <td>Node, left, right — the order in which the tree would be rebuilt by re-inserting.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">POSTORDER</span></td>
                          <td>Left, right, node — children always before their parent.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">LEVELORDER</span></td>
                          <td>Breadth-first, one depth level at a time.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h3 className="docs-h3">Queries</h3>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Command</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">MIN</span> / <span className="tok-keyword">MAX</span></td>
                          <td>Walks all the way left (or all the way right) and highlights the smallest (or largest) value.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">HEIGHT</span></td>
                          <td>Reports the number of levels — the worst-case cost of a search.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">SIZE</span></td>
                          <td>Reports the total node count.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">ROOT</span></td>
                          <td>Highlights the current root node.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">IS_EMPTY</span></td>
                          <td>Reports whether the tree currently has any nodes.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section id="bst-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Insert, Search, and All Three Delete Cases</h3>
                  <p className="docs-p">
                    Deletion is the only genuinely tricky BST operation, because the replacement rule depends on how many
                    children the target has. This program walks through all three cases in order.
                  </p>
                  <CodeBlock code={`SCENE BSTOperations

DECLARE
  BST myTree

SEQUENCE
  INSERT 50
  INSERT 30
  INSERT 70
  INSERT 20
  INSERT 40
  INSERT 60
  INSERT 80

  // Search for a value that exists
  SEARCH 60

  // Search for one that does not
  SEARCH 90

  // Case 1 — delete a leaf
  DELETE 20

  // Case 2 — delete a node with one child
  INSERT 85
  DELETE 80

  // Case 3 — delete a node with two children
  DELETE 50

  CLEAR
END`} />
                  <p className="docs-p">
                    <strong>Expected behavior:</strong> deleting the leaf 20 simply detaches it; deleting 80 (whose only
                    child is 85) lifts 85 into its place; deleting the root 50 replaces it with its in-order successor,
                    60, keeping the ordering invariant intact.
                  </p>

                  <h3 className="docs-h3">Example 2 — Traversals and Queries</h3>
                  <p className="docs-p">
                    <C>INORDER</C> on a BST is the sorted sequence — running it next to the other traversals is the
                    clearest demonstration of what the ordering rule buys you.
                  </p>
                  <CodeBlock code={`SCENE BSTTraversalsAndQueries

DECLARE
  BST myTree

SEQUENCE
  INSERT 50
  INSERT 30
  INSERT 70
  INSERT 20
  INSERT 40
  INSERT 60
  INSERT 80

  // Traversals
  INORDER
  PREORDER
  POSTORDER
  LEVELORDER

  // Queries
  MIN
  MAX
  HEIGHT
  SIZE
  ROOT
  IS_EMPTY

  CLEAR
  IS_EMPTY
END`} />

                  <h3 className="docs-h3">Example 3 — Why Insert Order Matters</h3>
                  <p className="docs-p">
                    Inserting already-sorted values degenerates a BST into a linked list — every node has one child and
                    the height equals the node count. The initializer list makes the contrast easy to build.
                  </p>
                  <CodeBlock code={`SCENE DegenerateBST

DECLARE
  BST sorted = [10, 20, 30, 40, 50]

SEQUENCE
  // Every node hangs off the right of the last
  HEIGHT
  SIZE
  WAIT

  // A search now costs a full walk of the tree
  SEARCH 50
END`} />
                  <p className="docs-p">
                    <strong>Expected behavior:</strong> the tree renders as a single right-leaning chain, and
                    <C>HEIGHT</C> reports the same number as <C>SIZE</C> — the worst case a BST can reach.
                  </p>
                </section>

                <section id="bst-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>

                  <Alert kind="warn" title="Duplicate values">
                    Node values identify nodes, so inserting a value that already exists has no well-defined home in the
                    tree. Keep the values in a BST distinct.
                  </Alert>

                  <Alert kind="warn" title="Deleting a value that is not there">
                    <C>DELETE 99</C> on a tree with no 99 animates the failed search and leaves the tree unchanged; it is
                    reported in the console rather than silently ignored.
                  </Alert>

                  <Alert kind="warn" title="Operations on an empty tree">
                    <C>MIN</C>, <C>MAX</C>, <C>ROOT</C>, and the traversals have nothing to show before the first
                    <C>INSERT</C>. Check with <C>IS_EMPTY</C> if the sequence may have cleared the tree earlier.
                  </Alert>

                  <Alert kind="tip" title="BST or BINARY_TREE?">
                    Use <C>BST</C> when the ordering rule is the point and you want the runtime to place nodes. Use
                    <C>BINARY_TREE</C> when you need to build an exact shape by hand with <C>LEFT_CHILD</C> and
                    <C>RIGHT_CHILD</C>.
                  </Alert>

                  <Alert kind="note" title="Tuning the tree layout">
                    <C>LAYOUT myTree AS HIERARCHY(levelGap=2, siblingGap=1)</C> tightens or spreads the tree when a deep
                    example runs out of room — see the Layout &amp; Camera page.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                HEAPS PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'heaps' && (
              <>
                <header className="docs-page-hero">
                  <div className="docs-page-tag">Data Structures</div>
                  <div className="docs-page-title-row">
                    <div className="docs-page-title-icon">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 3 21 19 3 19" />
                        <line x1="12" y1="3" x2="12" y2="19" />
                      </svg>
                    </div>
                    <h1 className="docs-page-title">Heaps</h1>
                  </div>
                  <p className="docs-page-lead">
                    A complete binary tree with a priority rule at every parent-child pair — shown as both a tree and its
                    backing array, so sift-up and sift-down become concrete.
                  </p>
                </header>

                <section id="hp-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A <C>HEAP</C> is a complete binary tree obeying the heap property: every parent compares favourably
                    against both of its children. That makes the extreme value always available at the root, which is why
                    heaps back priority queues, scheduling, and heapsort.
                  </p>
                  <p className="docs-p">
                    A heap is only partially ordered — siblings have no relationship to each other at all. Insertions
                    restore the property by <em>sifting up</em> from the new leaf, and extractions by <em>sifting down</em>
                    from the new root; both are animated swap by swap.
                  </p>
                  <Alert kind="note" title="Visualization">
                    Heaps render as a tree and as the array that stores it. Watching a swap happen in both views at once
                    is what makes the index arithmetic behind a heap click.
                  </Alert>
                </section>

                <section id="hp-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a Heap</h2>
                  <p className="docs-p">
                    Declare an empty heap and fill it with <C>HEAP_INSERT</C>, or supply an initial value list.
                  </p>
                  <CodeBlock label="Syntax" code={`HEAP <name>
HEAP <name> = [<value>, <value>, ...]`} />

                  <p className="docs-p">A full minimal program:</p>
                  <CodeBlock code={`SCENE HeapIntro

DECLARE
  HEAP h = [10, 20, 30]

SEQUENCE
  HEAP_INSERT h 5
  HEAP_EXTRACT h
END`} />
                  <p className="docs-p">
                    Inserting 5 places it at the next free leaf and then sifts it upward until the heap property holds
                    again. <C>HEAP_EXTRACT</C> then removes the root and sifts the replacement back down.
                  </p>
                </section>

                <section id="hp-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>
                  <p className="docs-p">
                    Every heap command names its heap first, the same convention stacks and queues use.
                  </p>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Command</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">HEAP_INSERT</span> <span className="tok-param">name value</span></td>
                          <td>Appends <C>value</C> at the next free position and sifts it up, swapping with its parent until the heap property is restored.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">HEAP_EXTRACT</span> <span className="tok-param">name</span></td>
                          <td>Removes the root, moves the last element into its place, and sifts it down. This is the priority-queue "take the next item" operation.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">HEAP_DECREASE</span> <span className="tok-param">name value newValue</span></td>
                          <td>Lowers an existing element's key and sifts it up to its new position — the operation Dijkstra's algorithm needs.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">BUILD_HEAP</span> <span className="tok-param">name</span></td>
                          <td>Turns an arbitrary set of values into a valid heap bottom-up, which is cheaper than inserting them one at a time.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">HEAPIFY</span> <span className="tok-param">name</span></td>
                          <td>Runs a single sift-down pass, restoring the heap property at one subtree.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section id="hp-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Building a Heap by Insertion</h3>
                  <p className="docs-p">
                    Each insert appends at the bottom and bubbles up; inserting a new extreme value makes it travel all
                    the way to the root.
                  </p>
                  <CodeBlock code={`SCENE HeapInserts

DECLARE
  HEAP h

SEQUENCE
  HEAP_INSERT h 50
  HEAP_INSERT h 30
  HEAP_INSERT h 70
  WAIT

  // This one has to climb the whole way
  HEAP_INSERT h 5
  WAIT
END`} />

                  <h3 className="docs-h3">Example 2 — Extracting in Priority Order</h3>
                  <p className="docs-p">
                    Repeated extraction empties a heap in sorted order — this is heapsort with the array step left out.
                  </p>
                  <CodeBlock code={`SCENE HeapDrain

DECLARE
  HEAP h = [15, 40, 25, 60, 35]

SEQUENCE
  BUILD_HEAP h
  WAIT

  HEAP_EXTRACT h
  WAIT
  HEAP_EXTRACT h
  WAIT
  HEAP_EXTRACT h
END`} />
                  <p className="docs-p">
                    <strong>Expected behavior:</strong> <C>BUILD_HEAP</C> reorders the values into a valid heap, then each
                    extraction takes the root and sifts the replacement down through its children.
                  </p>

                  <h3 className="docs-h3">Example 3 — Decreasing a Key</h3>
                  <p className="docs-p">
                    Lowering a key can only move an element upward, so the fix is a sift-up from wherever it sits.
                  </p>
                  <CodeBlock code={`SCENE HeapDecreaseKey

DECLARE
  HEAP h = [10, 20, 30, 40]

SEQUENCE
  BUILD_HEAP h
  WAIT

  // Give 40 a much better priority
  HEAP_DECREASE h 40 1
  WAIT

  HEAP_EXTRACT h
END`} />
                </section>

                <section id="hp-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>

                  <Alert kind="warn" title="Extracting from an empty heap">
                    <C>HEAP_EXTRACT</C> on an empty heap has no root to remove and reports an error rather than producing
                    a frame. Build the heap before draining it.
                  </Alert>

                  <Alert kind="warn" title="HEAP_DECREASE needs an existing value">
                    The second argument is the value already in the heap and the third is its replacement. Naming a value
                    that is not present leaves the heap untouched.
                  </Alert>

                  <Alert kind="warn" title="A heap is not fully sorted">
                    Only the parent-child relationship is guaranteed. Reading the backing array top to bottom does not
                    give you a sorted list — repeated <C>HEAP_EXTRACT</C> does.
                  </Alert>

                  <Alert kind="tip" title="BUILD_HEAP beats repeated inserts">
                    When you already have all the values, <C>BUILD_HEAP</C> shows the bottom-up construction in far fewer
                    steps than inserting them one by one, and it is the faster algorithm too.
                  </Alert>

                  <Alert kind="note" title="Heaps use the tree layout">
                    A heap is laid out with the same <C>HIERARCHY</C> strategy as trees, so <C>levelGap</C> and
                    <C>siblingGap</C> tune it identically.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                TRIES PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'tries' && (
              <>
                <header className="docs-page-hero">
                  <div className="docs-page-tag">Data Structures</div>
                  <div className="docs-page-title-row">
                    <div className="docs-page-title-icon">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="4" r="2" />
                        <circle cx="5" cy="13" r="2" />
                        <circle cx="19" cy="13" r="2" />
                        <line x1="11" y1="6" x2="6" y2="11" />
                        <line x1="13" y1="6" x2="18" y2="11" />
                      </svg>
                    </div>
                    <h1 className="docs-page-title">Tries</h1>
                  </div>
                  <p className="docs-page-lead">
                    A prefix tree over strings, where every path from the root spells a prefix and shared prefixes share
                    a branch.
                  </p>
                </header>

                <section id="tri-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A <C>TRIE</C> stores strings by their characters rather than as whole values. Each edge carries one
                    character, so the path from the root to a node spells a prefix, and words sharing a prefix share the
                    branch that spells it — which is exactly why autocomplete is cheap on a trie.
                  </p>
                  <p className="docs-p">
                    Tries are AQVL's one string-keyed tree structure: every trie command takes the trie name and a string
                    literal rather than a number.
                  </p>
                  <Alert kind="note" title="Visualization">
                    Inserting a word walks the existing branch as far as it matches and then grows new nodes for the
                    remaining characters, so the shared-prefix saving is visible on screen.
                  </Alert>
                </section>

                <section id="tri-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a Trie</h2>
                  <p className="docs-p">
                    A trie is declared with a list of string literals. The initializer is required — use a single-word
                    list if you plan to build the rest from the sequence.
                  </p>
                  <CodeBlock label="Syntax" code={`TRIE <name> = ["<word>", "<word>", ...]`} />

                  <p className="docs-p">A full minimal program:</p>
                  <CodeBlock code={`SCENE TrieIntro

DECLARE
  TRIE t = ["cat", "car"]

SEQUENCE
  TRIE_INSERT t "card"
  TRIE_SEARCH t "cat"
END`} />
                  <p className="docs-p">
                    <C>cat</C> and <C>car</C> already share the <C>ca</C> branch. Inserting <C>card</C> reuses
                    <C>car</C> entirely and adds one node for the final <C>d</C>.
                  </p>
                  <Alert kind="warn" title="Trie values are strings">
                    <C>TRIE t = [1, 2]</C> is invalid — a trie is initialised from quoted strings, not numbers.
                  </Alert>
                </section>

                <section id="tri-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Command</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">TRIE_INSERT</span> <span className="tok-param">name "word"</span></td>
                          <td>Walks the existing prefix path as far as it matches, then creates a node per remaining character and marks the last as a word end.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">TRIE_SEARCH</span> <span className="tok-param">name "word"</span></td>
                          <td>Traces the word's path and reports a hit only if the path exists <em>and</em> its final node is marked as a complete word.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">TRIE_STARTSWITH</span> <span className="tok-param">name "prefix"</span></td>
                          <td>Reports whether any stored word begins with the prefix — the path alone is enough, no word-end mark required.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">TRIE_AUTOCOMPLETE</span> <span className="tok-param">name "prefix"</span></td>
                          <td>Descends to the prefix node and then highlights every complete word in the subtree beneath it.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">TRIE_DELETE</span> <span className="tok-param">name "word"</span></td>
                          <td>Unmarks the word and removes the nodes that no other word needs, pruning back up the branch.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section id="tri-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Search vs. Prefix Match</h3>
                  <p className="docs-p">
                    The distinction that trips people up: a prefix path can exist without the prefix itself being a
                    stored word.
                  </p>
                  <CodeBlock code={`SCENE TrieSearchVsPrefix

DECLARE
  TRIE t = ["cat", "car", "card"]

SEQUENCE
  // A stored word — found
  TRIE_SEARCH t "cat"
  WAIT

  // A path that exists, but is not a stored word
  TRIE_SEARCH t "ca"
  WAIT

  // The same path, asked the right question
  TRIE_STARTSWITH t "ca"
END`} />
                  <p className="docs-p">
                    <strong>Expected behavior:</strong> <C>cat</C> is found, <C>ca</C> is not found as a word, but
                    <C>TRIE_STARTSWITH</C> on <C>ca</C> reports a match.
                  </p>

                  <h3 className="docs-h3">Example 2 — Autocomplete</h3>
                  <CodeBlock code={`SCENE TrieAutocomplete

DECLARE
  TRIE t = ["car", "card", "care", "dog"]

SEQUENCE
  // Everything under the "car" branch
  TRIE_AUTOCOMPLETE t "car"
  WAIT

  // A branch with a single word under it
  TRIE_AUTOCOMPLETE t "do"
END`} />

                  <h3 className="docs-h3">Example 3 — Insert and Delete</h3>
                  <p className="docs-p">
                    Deleting only prunes nodes no other word depends on, which is why removing <C>card</C> leaves
                    <C>car</C> completely intact.
                  </p>
                  <CodeBlock code={`SCENE TrieEdits

DECLARE
  TRIE t = ["car"]

SEQUENCE
  TRIE_INSERT t "card"
  TRIE_INSERT t "dog"
  WAIT

  // Only the final "d" node goes away
  TRIE_DELETE t "card"
  WAIT

  TRIE_SEARCH t "car"
END`} />
                </section>

                <section id="tri-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>

                  <Alert kind="warn" title="Quotes are required">
                    <C>TRIE_INSERT t cat</C> reads <C>cat</C> as an identifier, not a word. Every trie argument must be a
                    quoted string.
                  </Alert>

                  <Alert kind="warn" title="Deleting a word that is not stored">
                    <C>TRIE_DELETE</C> on an absent word traces the path and reports the miss; it never prunes nodes that
                    belong to other words.
                  </Alert>

                  <Alert kind="tip" title="Choose overlapping words for demos">
                    A trie built from unrelated words is just a bush of separate chains. Words like <C>car</C>,
                    <C>card</C>, and <C>care</C> show the structure's whole point in one picture.
                  </Alert>

                  <Alert kind="note" title="Case matters">
                    <C>"Cat"</C> and <C>"cat"</C> are different words and produce different branches from the root.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                HASH MAPS PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'hashmaps' && (
              <>
                <header className="docs-page-hero">
                  <div className="docs-page-tag">Data Structures</div>
                  <div className="docs-page-title-row">
                    <div className="docs-page-title-icon">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="4" y1="9" x2="20" y2="9" />
                        <line x1="4" y1="15" x2="20" y2="15" />
                        <line x1="10" y1="3" x2="8" y2="21" />
                        <line x1="16" y1="3" x2="14" y2="21" />
                      </svg>
                    </div>
                    <h1 className="docs-page-title">Hash Maps</h1>
                  </div>
                  <p className="docs-page-lead">
                    Key-value storage with buckets and collision chains made visible — you can watch a key hash to its
                    bucket and land in the chain.
                  </p>
                </header>

                <section id="hm-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A <C>HASH_MAP</C> stores key-value pairs and finds them in roughly constant time by hashing the key
                    to a bucket index. AQVL renders the bucket array explicitly, with each entry hanging in a chain below
                    the bucket it hashed to — so collisions are something you can see rather than something you're told
                    about.
                  </p>
                  <p className="docs-p">
                    Keys may be strings or numbers. In a declaration a bareword key is treated as a string, so
                    <C>apple: 5</C> and <C>"apple": 5</C> mean the same thing.
                  </p>
                  <Alert kind="note" title="Visualization">
                    Buckets are laid out in a row; entries stack vertically beneath their bucket. A lookup highlights the
                    bucket first, then walks the chain one entry at a time.
                  </Alert>
                </section>

                <section id="hm-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a Hash Map</h2>
                  <p className="docs-p">
                    Hash maps use brace-delimited literal syntax — the one place in AQVL's declaration grammar where
                    braces appear outside a function body.
                  </p>
                  <CodeBlock label="Syntax" code={`HASH_MAP <name>
HASH_MAP <name> = { <key>: <value>, <key>: <value>, ... }`} />

                  <p className="docs-p">A full minimal program:</p>
                  <CodeBlock code={`SCENE HashMapIntro

DECLARE
  HASH_MAP m = { apple: 5, banana: 3 }

SEQUENCE
  HASHMAP_INSERT m "cherry" 9
  HASHMAP_LOOKUP m "apple"
END`} />
                  <p className="docs-p">
                    Both initial entries are hashed into buckets on load. The sequence then inserts a third key and
                    animates a lookup of the first.
                  </p>
                  <Alert kind="tip" title="Three key spellings, one meaning">
                    <C>apple: 5</C>, <C>"apple": 5</C>, and <C>7: 1</C> are all valid entries — barewords and quoted
                    strings both become string keys, and numeric keys stay numbers.
                  </Alert>
                </section>

                <section id="hm-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Command</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">HASHMAP_INSERT</span> <span className="tok-param">name "key" value</span></td>
                          <td>Hashes the key to a bucket and appends a new entry to that bucket's chain, or updates the entry if the key is already present.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">HASHMAP_LOOKUP</span> <span className="tok-param">name "key"</span></td>
                          <td>Highlights the bucket the key hashes to, then walks its chain comparing keys until it finds a match or runs out.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">HASHMAP_DELETE</span> <span className="tok-param">name "key"</span></td>
                          <td>Finds the entry the same way a lookup does and removes it, closing up the chain behind it.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section id="hm-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Insert, Look Up, Delete</h3>
                  <CodeBlock code={`SCENE HashMapOps

DECLARE
  HASH_MAP m = { apple: 5, banana: 3 }

SEQUENCE
  HASHMAP_INSERT m "cherry" 9
  WAIT

  // A key that is present
  HASHMAP_LOOKUP m "banana"
  WAIT

  // A key that is not
  HASHMAP_LOOKUP m "durian"
  WAIT

  HASHMAP_DELETE m "apple"
END`} />
                  <p className="docs-p">
                    <strong>Expected behavior:</strong> the successful lookup highlights a bucket and stops on the
                    matching entry; the failed one highlights the bucket, walks the chain, and reports a miss.
                  </p>

                  <h3 className="docs-h3">Example 2 — Watching a Collision</h3>
                  <p className="docs-p">
                    Inserting several keys grows the chains beneath individual buckets — the moment two keys land in the
                    same bucket is the moment the chain becomes the point of the structure.
                  </p>
                  <CodeBlock code={`SCENE HashMapCollisions

DECLARE
  HASH_MAP m

SEQUENCE
  HASHMAP_INSERT m "ab" 1
  HASHMAP_INSERT m "ba" 2
  HASHMAP_INSERT m "cd" 3
  HASHMAP_INSERT m "dc" 4
  WAIT

  // Lookups walk the chain, not just the bucket
  HASHMAP_LOOKUP m "dc"
END`} />

                  <h3 className="docs-h3">Example 3 — Counting With a Map</h3>
                  <p className="docs-p">
                    Re-inserting an existing key updates its value, which is what makes a hash map the natural home for
                    a frequency count.
                  </p>
                  <CodeBlock code={`SCENE HashMapCounter

DECLARE
  HASH_MAP counts = { a: 1 }

SEQUENCE
  // Same key again — the entry updates in place
  HASHMAP_INSERT counts "a" 2
  WAIT

  HASHMAP_INSERT counts "b" 1
  HASHMAP_LOOKUP counts "a"
END`} />
                </section>

                <section id="hm-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>

                  <Alert kind="warn" title="Braces, not brackets">
                    A hash map literal uses <C>&#123; &#125;</C> with <C>key: value</C> pairs. Square brackets are for the
                    list-initialised structures (arrays, stacks, heaps, tries).
                  </Alert>

                  <Alert kind="warn" title="Looking up a missing key">
                    <C>HASHMAP_LOOKUP</C> on an absent key is not an error — it animates the full unsuccessful chain walk
                    and reports the miss, which is worth showing deliberately.
                  </Alert>

                  <Alert kind="warn" title="Quote keys in the sequence">
                    Declaration literals accept barewords, but sequence commands take expressions, so
                    <C>HASHMAP_LOOKUP m "apple"</C> needs the quotes — without them <C>apple</C> is an undeclared
                    identifier.
                  </Alert>

                  <Alert kind="tip" title="Insert on an existing key is an update">
                    There is no separate update command. <C>HASHMAP_INSERT</C> with a key already in the map replaces its
                    value in place rather than adding a second entry.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                CONTROL FLOW & EXPRESSIONS PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'control-flow' && (
              <>
                <header className="docs-page-hero">
                  <div className="docs-page-tag">Language</div>
                  <div className="docs-page-title-row">
                    <div className="docs-page-title-icon">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="4 4 4 12 12 12" />
                        <polyline points="9 9 12 12 9 15" />
                        <circle cx="18" cy="12" r="3" />
                      </svg>
                    </div>
                    <h1 className="docs-page-title">Control Flow &amp; Expressions</h1>
                  </div>
                  <p className="docs-page-lead">
                    Loops, conditionals, variables, and operators — the general-purpose half of AQVL that turns a list of
                    animation commands into an algorithm.
                  </p>
                </header>

                <section id="cf-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    Every AQVL program is a <C>SCENE</C> containing a <C>DECLARE</C> block (what exists) and a
                    <C>SEQUENCE</C> block (what happens), closed by <C>END</C>. Inside the sequence, <C>LOOP</C> and
                    <C>IF</C> let one written statement produce many animation steps.
                  </p>
                  <p className="docs-p">
                    Sequence-mode control flow is <strong>block-delimited by <C>END</C></strong>, not by braces, and
                    <C>IF</C> has no <C>ELSE</C> here. Braces and <C>ELSE</C> belong to function bodies — see the
                    Functions page — which is a deliberate split: the sequence block reads as a storyboard, function
                    bodies read as code.
                  </p>
                  <Alert kind="note" title="The three blocks">
                    <C>SCENE &lt;name&gt;</C> opens the program, <C>DECLARE</C> introduces structures, <C>SEQUENCE</C>
                    lists the steps, and a final <C>END</C> closes the scene.
                  </Alert>
                </section>

                <section id="cf-declaration" className="docs-section">
                  <h2 className="docs-h2">Variables &amp; Literals</h2>
                  <p className="docs-p">
                    Scalar variables are never declared. Assigning to a name creates it on the spot, in the current
                    scope, with the value of the right-hand expression.
                  </p>
                  <CodeBlock label="Syntax" code={`<name> = <expression>`} />

                  <CodeBlock code={`SCENE ScalarVariables

DECLARE
  ARRAY arr = [5, 2, 9]

SEQUENCE
  // No declaration needed — assignment creates it
  total = 0
  target = 9

  LOOP i FROM 0 TO LENGTH(arr) - 1
    total = total + arr[i]
  END
END`} />
                  <p className="docs-p">
                    A <C>LOOP</C> iterator is scoped to its loop and also needs no declaration. Both kinds of implicit
                    variable hold numbers.
                  </p>
                  <p className="docs-p">
                    Literals come in three shapes: numbers (<C>42</C>, <C>3.14</C>, <C>-5</C>), quoted strings
                    (<C>"A-&gt;B"</C>, <C>'SUCCESS'</C> — both quote styles are equivalent), and the <C>NULL</C> sentinel
                    used to terminate linked structures. Comments run from <C>//</C> to end of line.
                  </p>
                  <Alert kind="warn" title="Negation only applies to literals">
                    <C>-5</C> is a negative number literal, but there is no unary minus on expressions. Write
                    <C>0 - x</C> rather than <C>-x</C>.
                  </Alert>
                </section>

                <section id="cf-commands" className="docs-section">
                  <h2 className="docs-h2">Statements &amp; Operators</h2>

                  <h3 className="docs-h3">Control Flow</h3>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Construct</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">LOOP</span> <span className="tok-param">var</span> <span className="tok-keyword">FROM</span> <span className="tok-param">a</span> <span className="tok-keyword">TO</span> <span className="tok-param">b</span> … <span className="tok-keyword">END</span></td>
                          <td>Runs the body once per value of <C>var</C> from <C>a</C> to <C>b</C> inclusive. Both bounds are expressions, so <C>LENGTH(arr) - 1</C> is a valid upper bound. Loops nest freely.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">IF</span> <span className="tok-param">expr</span> … <span className="tok-keyword">END</span></td>
                          <td>Runs the body when <C>expr</C> is true. In <C>SEQUENCE</C> there is no <C>ELSE</C> branch — write a second <C>IF</C> with the opposite condition.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">WAIT</span></td>
                          <td>Pauses one beat so the current state can be read before the next step.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h3 className="docs-h3">Operators</h3>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Operator</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-operator">+ - * /</span></td>
                          <td>Arithmetic on numeric expressions, evaluated left to right.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-operator">&gt; &lt; &gt;= &lt;=</span></td>
                          <td>Ordering comparisons, used in <C>IF</C> conditions.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-operator">== !=</span></td>
                          <td>Equality and inequality.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-operator">=</span></td>
                          <td>Assignment. It binds looser than every other operator and associates rightward, so <C>total = total + i</C> means <C>total = (total + i)</C>.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-builtin">LENGTH</span>(<span className="tok-param">name</span>)</td>
                          <td>The current element count of a named structure — the usual upper bound of a loop over an array.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-param">name</span>[<span className="tok-param">expr</span>]</td>
                          <td>Element access. The index may be any expression (<C>arr[j+1]</C>) and, on a graph, a string key (<C>g["A"]</C>).</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h3 className="docs-h3">Universal Actions</h3>
                  <p className="docs-p">
                    These work across structures rather than belonging to one of them.
                  </p>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Command</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">HIGHLIGHT</span> <span className="tok-param">target [color]</span></td>
                          <td>Pulses an element. An optional colour literal such as <C>'SUCCESS'</C> marks the meaning of the highlight rather than just drawing attention.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">COMPARE</span> <span className="tok-param">a b</span></td>
                          <td>Highlights two elements as being evaluated against each other. Neither is modified.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">SWAP</span> <span className="tok-param">a b</span></td>
                          <td>Exchanges two elements, animating them along an arc.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">SET</span> <span className="tok-param">target</span> <span className="tok-keyword">STATE</span> <span className="tok-param">name</span></td>
                          <td>Applies a named visual state (e.g. <C>active</C>, <C>visited</C>) that persists until changed, unlike a one-shot highlight.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-param">a</span> <span className="tok-operator">-&gt;</span> <span className="tok-param">b</span></td>
                          <td>Creates a directed relationship from <C>a</C> to <C>b</C>.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-param">a</span> <span className="tok-operator">&lt;-</span> <span className="tok-param">b</span></td>
                          <td>The same edge written the other way round — directed from <C>b</C> to <C>a</C>.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-param">a</span> <span className="tok-operator">&lt;-&gt;</span> <span className="tok-param">b</span></td>
                          <td>Creates an undirected relationship between the two.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">LINK</span> <span className="tok-param">a</span> <span className="tok-keyword">TO</span> <span className="tok-param">b</span></td>
                          <td>The keyword spelling of a directed link, for when the arrow form reads poorly.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section id="cf-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Loop, Accumulate, Branch</h3>
                  <p className="docs-p">
                    A single pass that sums an array and marks the elements above a threshold.
                  </p>
                  <CodeBlock code={`SCENE SumAndMark

DECLARE
  ARRAY arr = [5, 12, 3, 19, 7]

SEQUENCE
  total = 0

  LOOP i FROM 0 TO LENGTH(arr) - 1
    total = total + arr[i]

    IF arr[i] > 10
      HIGHLIGHT arr[i] 'SUCCESS'
    END

    WAIT
  END
END`} />
                  <p className="docs-p">
                    <strong>Expected behavior:</strong> each element is visited in turn and only 12 and 19 light up.
                  </p>

                  <h3 className="docs-h3">Example 2 — Nested Loops</h3>
                  <p className="docs-p">
                    The inner loop runs to completion for every step of the outer one — the shape every quadratic
                    algorithm is built on.
                  </p>
                  <CodeBlock code={`SCENE NestedLoops

DECLARE
  ARRAY arr = [1, 2, 3]

SEQUENCE
  LOOP i FROM 0 TO 2
    LOOP j FROM 0 TO 2
      COMPARE arr[i] arr[j]
    END
    WAIT
  END
END`} />

                  <h3 className="docs-h3">Example 3 — Two Conditions Instead of ELSE</h3>
                  <p className="docs-p">
                    Sequence-mode <C>IF</C> has no else branch, so an either/or becomes two guarded blocks with opposite
                    conditions.
                  </p>
                  <CodeBlock code={`SCENE NoElseBranch

DECLARE
  ARRAY arr = [8, 3, 8, 1]

SEQUENCE
  LOOP i FROM 0 TO LENGTH(arr) - 2
    COMPARE arr[i] arr[i+1]

    IF arr[i] > arr[i+1]
      SWAP arr[i] arr[i+1]
    END

    IF arr[i] == arr[i+1]
      SET arr[i] STATE active
    END
  END
END`} />

                  <h3 className="docs-h3">Example 4 — Relationships Between Nodes</h3>
                  <p className="docs-p">
                    The arrow operators work on declared objects, drawing edges directly rather than through a structure's
                    own commands.
                  </p>
                  <CodeBlock code={`SCENE Relationships

DECLARE
  NODE a = [1]
  NODE b = [2]
  NODE c = [3]

SEQUENCE
  a -> b
  WAIT

  b <-> c
  WAIT

  LINK c TO a
END`} />
                </section>

                <section id="cf-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>

                  <Alert kind="warn" title="Every block needs its own END">
                    <C>LOOP</C> and <C>IF</C> each close with <C>END</C>, and the scene closes with one more. A missing
                    <C>END</C> surfaces as an unexpected-token error, usually pointing at the line <em>after</em> the
                    problem.
                  </Alert>

                  <Alert kind="warn" title="No ELSE in SEQUENCE">
                    <C>ELSE</C> is only valid inside a brace-delimited function body. Inside the sequence block it is a
                    parse error — use a second <C>IF</C>.
                  </Alert>

                  <Alert kind="warn" title="Keywords are reserved case-insensitively">
                    Variable and structure names are matched against the keyword list after upper-casing, so
                    <C>size</C>, <C>root</C>, <C>min</C>, <C>max</C>, <C>head</C>, <C>path</C>, and <C>level</C> cannot be
                    used as names. Pick <C>mySize</C>, <C>myRoot</C>, and so on.
                  </Alert>

                  <Alert kind="warn" title="Loop bounds are inclusive">
                    <C>LOOP i FROM 0 TO LENGTH(arr)</C> runs one iteration too many and indexes past the end. The correct
                    upper bound is <C>LENGTH(arr) - 1</C>.
                  </Alert>

                  <Alert kind="tip" title="WAIT is how you pace an explanation">
                    Commands play back-to-back by default. A <C>WAIT</C> at the end of each loop iteration gives a viewer
                    time to read the state before it changes again.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                FUNCTIONS PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'functions' && (
              <>
                <header className="docs-page-hero">
                  <div className="docs-page-tag">Language</div>
                  <div className="docs-page-title-row">
                    <div className="docs-page-title-icon">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 20c-2 0-3-1-3-3v-3c0-1.5-.8-2-2-2 1.2 0 2-.5 2-2V7c0-2 1-3 3-3" />
                        <path d="M15 4c2 0 3 1 3 3v3c0 1.5.8 2 2 2-1.2 0-2 .5-2 2v3c0 2-1 3-3 3" />
                      </svg>
                    </div>
                    <h1 className="docs-page-title">Functions</h1>
                  </div>
                  <p className="docs-page-lead">
                    Named, reusable computation with parameters, <code>RETURN</code> values, and full <code>IF</code> /
                    <code>ELSE</code> branching inside braces.
                  </p>
                </header>

                <section id="fn-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    A <C>FUNCTION</C> is named computation you can call from anywhere in the sequence. Functions are
                    where AQVL stops being a storyboard and becomes a small programming language: they take parameters,
                    return values, and branch with a real <C>ELSE</C>.
                  </p>
                  <p className="docs-p">
                    The syntax differs from the sequence block on purpose. A function body is delimited by braces
                    (<C>&#123;</C> … <C>&#125;</C>) rather than <C>END</C>, and its statements are expressions and control
                    flow rather than animation commands.
                  </p>
                  <Alert kind="note" title="Where functions live">
                    Functions are declared in the <C>DECLARE</C> block, alongside the structures — they are part of what
                    the scene <em>has</em>, not part of what it <em>does</em>.
                  </Alert>
                </section>

                <section id="fn-declaration" className="docs-section">
                  <h2 className="docs-h2">Declaring a Function</h2>
                  <CodeBlock label="Syntax" code={`FUNCTION <name>(<param>, <param>, ...) {
  <statements>
  RETURN <expression>
}`} />

                  <p className="docs-p">A full minimal program:</p>
                  <CodeBlock code={`SCENE FunctionIntro

DECLARE
  ARRAY arr = [3, 7, 2]

  FUNCTION double(n) {
    RETURN n * 2
  }

SEQUENCE
  v = double(arr[0])
  UPDATE arr[0] v
END`} />
                  <p className="docs-p">
                    The call <C>double(arr[0])</C> is an ordinary expression, so its result can be assigned, passed to
                    another call, or used directly as a command argument.
                  </p>
                  <Alert kind="tip" title="A bare RETURN is allowed">
                    <C>RETURN</C> with no expression exits the function early without producing a value — useful as a
                    guard clause at the top of a body.
                  </Alert>
                </section>

                <section id="fn-commands" className="docs-section">
                  <h2 className="docs-h2">Statements Reference</h2>
                  <p className="docs-p">
                    Inside braces the statement grammar is different from the sequence block. This table covers it in
                    full.
                  </p>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Construct</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">FUNCTION</span> <span className="tok-param">name(params)</span> <span className="tok-operator">&#123; … &#125;</span></td>
                          <td>Declares a function. Parameters are comma-separated names; an empty parameter list is written <C>()</C>.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">RETURN</span> <span className="tok-param">[expr]</span></td>
                          <td>Exits the function, optionally with a value. Without one, the function returns nothing.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">IF</span> <span className="tok-param">cond</span> <span className="tok-operator">&#123; … &#125;</span></td>
                          <td>Brace-delimited conditional. Note the contrast with sequence-mode <C>IF</C>, which closes with <C>END</C> instead.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">ELSE</span> <span className="tok-operator">&#123; … &#125;</span></td>
                          <td>The alternative branch, valid only in a function body.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">ELSE</span> <span className="tok-keyword">IF</span> <span className="tok-param">cond</span> <span className="tok-operator">&#123; … &#125;</span></td>
                          <td>Chains another condition, and may be followed by further <C>ELSE IF</C> / <C>ELSE</C> branches.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-param">name</span> <span className="tok-operator">=</span> <span className="tok-param">expr</span></td>
                          <td>Assignment. Creates the variable on first use, as in the sequence block.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-param">name(args)</span></td>
                          <td>A call. Valid as a statement on its own or as part of a larger expression — including a call to another function.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section id="fn-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — IF / ELSE and a Return Value</h3>
                  <CodeBlock code={`SCENE MaxOfTwo

DECLARE
  ARRAY arr = [14, 9]

  FUNCTION maxOf(a, b) {
    IF a > b {
      RETURN a
    } ELSE {
      RETURN b
    }
  }

SEQUENCE
  COMPARE arr[0] arr[1]
  best = maxOf(arr[0], arr[1])
  HIGHLIGHT arr[0] 'SUCCESS'
END`} />
                  <p className="docs-p">
                    <strong>Expected behavior:</strong> the comparison animates, <C>maxOf</C> returns 14, and the winning
                    element is marked.
                  </p>

                  <h3 className="docs-h3">Example 2 — ELSE IF Chains</h3>
                  <p className="docs-p">
                    Several mutually exclusive cases, handled the way a general-purpose language would handle them.
                  </p>
                  <CodeBlock code={`SCENE ClassifySign

DECLARE
  ARRAY arr = [-4, 0, 9]

  FUNCTION classify(n) {
    IF n < 0 {
      RETURN 0
    } ELSE IF n == 0 {
      RETURN 1
    } ELSE {
      RETURN 2
    }
  }

SEQUENCE
  LOOP i FROM 0 TO LENGTH(arr) - 1
    kind = classify(arr[i])
    HIGHLIGHT arr[i]
    WAIT
  END
END`} />

                  <h3 className="docs-h3">Example 3 — Functions Calling Functions</h3>
                  <p className="docs-p">
                    A call is an expression, so one function's result feeds straight into another's argument list.
                  </p>
                  <CodeBlock code={`SCENE ComposedCalls

DECLARE
  ARRAY arr = [2, 5, 3]

  FUNCTION square(n) {
    RETURN n * n
  }

  FUNCTION sumOfSquares(a, b) {
    RETURN square(a) + square(b)
  }

SEQUENCE
  result = sumOfSquares(arr[0], arr[1])
  UPDATE arr[2] result
END`} />
                  <p className="docs-p">
                    <strong>Expected behavior:</strong> <C>sumOfSquares(2, 5)</C> evaluates to 29 and the third array
                    element animates to that value.
                  </p>

                  <h3 className="docs-h3">Example 4 — A Guard Clause</h3>
                  <p className="docs-p">
                    An early bare <C>RETURN</C> keeps the rest of the body from running.
                  </p>
                  <CodeBlock code={`SCENE GuardClause

DECLARE
  ARRAY arr = [6, 0, 4]

  FUNCTION safeDivide(a, b) {
    IF b == 0 {
      RETURN 0
    }
    RETURN a / b
  }

SEQUENCE
  ok = safeDivide(arr[0], arr[2])
  guarded = safeDivide(arr[0], arr[1])
  HIGHLIGHT arr[0]
END`} />
                </section>

                <section id="fn-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>

                  <Alert kind="warn" title="Braces in functions, END in sequences">
                    Writing <C>IF … END</C> inside a function body, or <C>IF … &#123; &#125;</C> inside <C>SEQUENCE</C>,
                    is a parse error in both directions. The two grammars are deliberately distinct.
                  </Alert>

                  <Alert kind="warn" title="Functions belong in DECLARE">
                    A <C>FUNCTION</C> declaration inside the <C>SEQUENCE</C> block is not valid. Declare it above,
                    then call it below.
                  </Alert>

                  <Alert kind="warn" title="Every branch should return">
                    A function whose <C>IF</C> returns but whose <C>ELSE</C> falls off the end returns nothing on that
                    path. Either give every branch a <C>RETURN</C> or add a final one after the conditional.
                  </Alert>

                  <Alert kind="tip" title="Functions compute, commands animate">
                    Keep animation commands in the sequence and arithmetic in functions. A function that returns the
                    index to highlight keeps both halves readable.
                  </Alert>

                  <Alert kind="note" title="Parameters are local">
                    Parameter names shadow anything of the same name outside the function, and assignments inside a body
                    do not leak back out to the sequence.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                SORTING PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'sorting' && (
              <>
                <header className="docs-page-hero">
                  <div className="docs-page-tag">Algorithms</div>
                  <div className="docs-page-title-row">
                    <div className="docs-page-title-icon">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="8" y1="12" x2="21" y2="12" />
                        <line x1="13" y1="18" x2="21" y2="18" />
                      </svg>
                    </div>
                    <h1 className="docs-page-title">Sorting Algorithms</h1>
                  </div>
                  <p className="docs-page-lead">
                    Run a sort as a single built-in keyword, or write the comparisons and swaps yourself — AQVL supports
                    both, and they teach different things.
                  </p>
                </header>

                <section id="so-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    Sorting is what AQVL was built to show. A sort is a long sequence of comparisons and swaps, and
                    watching which pairs an algorithm chooses to compare is the difference between memorising a sort and
                    understanding it.
                  </p>
                  <p className="docs-p">
                    Every sorting example on this page operates on an <C>ARRAY</C>, using <C>COMPARE</C> to show the pair
                    under consideration and <C>SWAP</C> to exchange them.
                  </p>
                </section>

                <section id="so-declaration" className="docs-section">
                  <h2 className="docs-h2">Two Ways to Sort</h2>
                  <p className="docs-p">
                    <strong>Built-in.</strong> One keyword runs a complete, correct sort and animates every step it takes.
                    Use it when the array is the subject and the sort is just the thing happening to it.
                  </p>
                  <CodeBlock label="Syntax" code={`BUBBLE_SORT <name>`} />
                  <CodeBlock code={`SCENE OneShotSort

DECLARE
  ARRAY arr = [64, 34, 25, 12, 22, 11, 90]

SEQUENCE
  BUBBLE_SORT arr
END`} />

                  <p className="docs-p">
                    <strong>By hand.</strong> Writing the loops yourself puts you in control of exactly what is compared
                    and when, and lets you add <C>HIGHLIGHT</C> and <C>WAIT</C> to narrate the algorithm's reasoning.
                  </p>
                  <CodeBlock code={`SCENE ManualSort

DECLARE
  ARRAY arr = [64, 34, 25, 12]

SEQUENCE
  LOOP i FROM 0 TO LENGTH(arr) - 2
    LOOP j FROM 0 TO LENGTH(arr) - i - 2
      COMPARE arr[j] arr[j+1]
      IF arr[j] > arr[j+1]
        SWAP arr[j] arr[j+1]
      END
    END
  END
END`} />
                  <Alert kind="tip" title="Start built-in, then rebuild it">
                    Playing <C>BUBBLE_SORT arr</C> first and then walking through the hand-written version is an
                    effective way to teach: the goal is established before the mechanics.
                  </Alert>
                </section>

                <section id="so-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>

                  <h3 className="docs-h3">Built-in Sorts</h3>
                  <p className="docs-p">Each takes the name of an array and animates a full run.</p>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Command</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">BUBBLE_SORT</span> <span className="tok-param">name</span></td>
                          <td>Repeatedly compares adjacent pairs, letting the largest remaining value rise to the end of each pass. O(n²).</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">SELECTION_SORT</span> <span className="tok-param">name</span></td>
                          <td>Finds the smallest value in the unsorted region and moves it into place. O(n²), with the fewest swaps.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">INSERTION_SORT</span> <span className="tok-param">name</span></td>
                          <td>Grows a sorted prefix by inserting each next element into its correct spot. O(n²), near-linear on nearly-sorted input.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">MERGE_SORT</span> <span className="tok-param">name</span></td>
                          <td>Splits, sorts each half, and merges them back. O(n log n) and stable.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">QUICK_SORT</span> <span className="tok-param">name</span></td>
                          <td>Partitions around a pivot and recurses into each side. O(n log n) on average.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h3 className="docs-h3">Building Blocks</h3>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Command</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">COMPARE</span> <span className="tok-param">arr[i] arr[j]</span></td>
                          <td>Shows the pair being evaluated. Purely visual — it does not branch on its own.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">SWAP</span> <span className="tok-param">arr[i] arr[j]</span></td>
                          <td>Exchanges two elements along an animated arc.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">IF</span> <span className="tok-param">arr[i] &gt; arr[j]</span></td>
                          <td>The decision that follows a comparison. Closed with <C>END</C>.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">HIGHLIGHT</span> <span className="tok-param">arr[i] ['SUCCESS']</span></td>
                          <td>Marks an element as settled into its final position.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section id="so-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Bubble Sort</h3>
                  <p className="docs-p">
                    Each outer pass drives one more element to its final position at the right-hand end, which the closing
                    <C>HIGHLIGHT</C> marks.
                  </p>
                  <CodeBlock code={`SCENE BubbleSort

DECLARE
  ARRAY arr = [64, 34, 25, 12, 22, 11, 90]

SEQUENCE
  LOOP i FROM 0 TO LENGTH(arr) - 2
    LOOP j FROM 0 TO LENGTH(arr) - i - 2
      COMPARE arr[j] arr[j+1]
      IF arr[j] > arr[j+1]
        SWAP arr[j] arr[j+1]
      END
    END
    HIGHLIGHT arr[LENGTH(arr) - i - 1]
  END
  HIGHLIGHT arr[0]
END`} />

                  <h3 className="docs-h3">Example 2 — Selection Sort</h3>
                  <p className="docs-p">
                    The outer <C>HIGHLIGHT</C> marks the slot being filled; the inner loop scans the rest of the array
                    for something smaller.
                  </p>
                  <CodeBlock code={`SCENE SelectionSort

DECLARE
  ARRAY arr = [64, 25, 12, 22, 11]

SEQUENCE
  LOOP i FROM 0 TO LENGTH(arr) - 2
    HIGHLIGHT arr[i]
    LOOP j FROM i + 1 TO LENGTH(arr) - 1
      COMPARE arr[i] arr[j]
      IF arr[i] > arr[j]
        SWAP arr[i] arr[j]
      END
    END
  END
END`} />

                  <h3 className="docs-h3">Example 3 — Insertion Sort</h3>
                  <p className="docs-p">
                    The sorted prefix starts as the single first element and grows leftward-shifting each new value into
                    position.
                  </p>
                  <CodeBlock code={`SCENE InsertionSort

DECLARE
  ARRAY arr = [4, 3, 2, 10, 12, 1, 5, 6]

SEQUENCE
  HIGHLIGHT arr[0]
  LOOP i FROM 1 TO LENGTH(arr) - 1
    LOOP j FROM i TO 1
      COMPARE arr[j] arr[j-1]
      IF arr[j] < arr[j-1]
        SWAP arr[j] arr[j-1]
      END
    END
  END
END`} />

                  <h3 className="docs-h3">Example 4 — Quick Sort, Partition by Partition</h3>
                  <p className="docs-p">
                    Quicksort's recursion has no direct sequence-block equivalent, so a hand-written version narrates one
                    partition pass explicitly — each comparison against the pivot, and each swap it triggers.
                  </p>
                  <CodeBlock code={`SCENE QuickSortPartition

DECLARE
  ARRAY arr = [10, 80, 30, 90, 40, 50, 70]

SEQUENCE
  // 1. The pivot is the last element
  HIGHLIGHT arr[6]

  // 2. Walk the array comparing against it
  COMPARE arr[0] arr[6]
  COMPARE arr[1] arr[6]
  HIGHLIGHT arr[1]

  COMPARE arr[2] arr[6]
  SWAP arr[1] arr[2]

  COMPARE arr[3] arr[6]
  HIGHLIGHT arr[3]

  COMPARE arr[4] arr[6]
  SWAP arr[3] arr[4]
END`} />

                  <h3 className="docs-h3">Example 5 — Every Built-in Back to Back</h3>
                  <p className="docs-p">
                    Running the same array through several built-ins in one scene is the fastest way to compare how much
                    work each algorithm does.
                  </p>
                  <CodeBlock code={`SCENE SortShowcase

DECLARE
  ARRAY arr = [5, 2, 9, 1, 7]

SEQUENCE
  BUBBLE_SORT arr
  WAIT

  SELECTION_SORT arr
  WAIT

  INSERTION_SORT arr
  WAIT

  MERGE_SORT arr
  WAIT

  QUICK_SORT arr
END`} />
                </section>

                <section id="so-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>

                  <Alert kind="warn" title="Off-by-one in the bounds">
                    An outer bubble-sort loop ends at <C>LENGTH(arr) - 2</C> and the inner one at
                    <C>LENGTH(arr) - i - 2</C>, because the inner body reads <C>arr[j+1]</C>. Bounds that ignore the
                    <C>+1</C> index past the end of the array.
                  </Alert>

                  <Alert kind="warn" title="COMPARE does not branch">
                    <C>COMPARE</C> only draws the comparison. The decision has to be written as an <C>IF</C>; a
                    <C>COMPARE</C> with no following <C>IF</C> animates a comparison that never acts on its result.
                  </Alert>

                  <Alert kind="warn" title="Built-ins take an array name">
                    <C>BUBBLE_SORT arr</C>, not <C>BUBBLE_SORT arr[0]</C>. The built-in sorts operate on a whole
                    structure.
                  </Alert>

                  <Alert kind="tip" title="Use small, shuffled arrays">
                    Five to eight elements is enough to show an algorithm's behaviour and short enough that a viewer can
                    follow every swap. Sorting twenty elements produces a blur.
                  </Alert>

                  <Alert kind="note" title="Marking sorted regions">
                    A <C>HIGHLIGHT</C> at the end of each outer pass, on the element that just reached its final place,
                    turns an undifferentiated flurry of swaps into visible progress.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                SEARCHING PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'searching' && (
              <>
                <header className="docs-page-hero">
                  <div className="docs-page-tag">Algorithms</div>
                  <div className="docs-page-title-row">
                    <div className="docs-page-title-icon">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                    </div>
                    <h1 className="docs-page-title">Searching Algorithms</h1>
                  </div>
                  <p className="docs-page-lead">
                    Linear and binary search over arrays, plus the built-in <code>SEARCH</code> that animates a descent
                    through a tree or BST.
                  </p>
                </header>

                <section id="se-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    Searching is about the elements an algorithm <em>doesn't</em> look at. A linear search inspects every
                    element; a binary search discards half the remaining candidates at each step; a BST search follows a
                    single root-to-leaf path. Animating them side by side makes that difference obvious.
                  </p>
                  <p className="docs-p">
                    On arrays, a search is built from <C>COMPARE</C> and <C>HIGHLIGHT</C>. On trees, graphs, and tries
                    the search is a built-in command that animates itself.
                  </p>
                </section>

                <section id="se-declaration" className="docs-section">
                  <h2 className="docs-h2">Marking a Match</h2>
                  <p className="docs-p">
                    <C>HIGHLIGHT</C> takes an optional colour literal. Using <C>'SUCCESS'</C> for the found element
                    distinguishes the answer from the ordinary highlights used while scanning.
                  </p>
                  <CodeBlock label="Syntax" code={`HIGHLIGHT <target>
HIGHLIGHT <target> '<color>'`} />

                  <CodeBlock code={`SCENE MarkAMatch

DECLARE
  ARRAY arr = [12, 34, 25, 64]

SEQUENCE
  // Scanning
  HIGHLIGHT arr[0]
  HIGHLIGHT arr[1]

  // Found it
  HIGHLIGHT arr[2] 'SUCCESS'
END`} />
                </section>

                <section id="se-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Command</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">COMPARE</span> <span className="tok-param">arr[i] arr[j]</span></td>
                          <td>Shows the candidate being checked against the target. The building block of an array search.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">HIGHLIGHT</span> <span className="tok-param">target ['SUCCESS']</span></td>
                          <td>Marks the element under inspection, or the match once found.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">SEARCH</span> <span className="tok-param">value</span></td>
                          <td>On a <C>TREE</C>, <C>BINARY_TREE</C>, or <C>BST</C>: animates the descent from the root, highlighting each node it compares, and reports whether the value was found.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">DFS</span> / <span className="tok-keyword">BFS</span> <span className="tok-param">name "start"</span></td>
                          <td>On a <C>GRAPH</C>: exhaustive search of the reachable vertices, depth-first or breadth-first.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">TRIE_SEARCH</span> <span className="tok-param">name "word"</span></td>
                          <td>On a <C>TRIE</C>: traces the word's character path and reports whether it is a stored word.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">HASHMAP_LOOKUP</span> <span className="tok-param">name "key"</span></td>
                          <td>On a <C>HASH_MAP</C>: hashes to the bucket and walks its collision chain.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section id="se-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Linear Search</h3>
                  <p className="docs-p">
                    Compare each element against the target in turn and mark the first match. Every element before the
                    match had to be examined — which is the whole cost argument for the algorithm.
                  </p>
                  <CodeBlock code={`SCENE LinearSearch

DECLARE
  ARRAY arr = [12, 34, 25, 64, 22, 11, 90]

SEQUENCE
  // Searching for 22, which sits at index 4

  COMPARE arr[0] arr[4]
  COMPARE arr[1] arr[4]
  COMPARE arr[2] arr[4]
  COMPARE arr[3] arr[4]

  // Found it
  COMPARE arr[4] arr[4]
  HIGHLIGHT arr[4] 'SUCCESS'
END`} />

                  <h3 className="docs-h3">Example 2 — Linear Search in a Loop</h3>
                  <p className="docs-p">
                    The same algorithm written as a loop, so the array's length rather than the program's length decides
                    how many comparisons happen.
                  </p>
                  <CodeBlock code={`SCENE LinearSearchLoop

DECLARE
  ARRAY arr = [12, 34, 25, 64, 22]

SEQUENCE
  LOOP i FROM 0 TO LENGTH(arr) - 1
    HIGHLIGHT arr[i]
    COMPARE arr[i] arr[4]

    IF arr[i] == arr[4]
      HIGHLIGHT arr[i] 'SUCCESS'
    END

    WAIT
  END
END`} />

                  <h3 className="docs-h3">Example 3 — Binary Search</h3>
                  <p className="docs-p">
                    Binary search requires a sorted array. Each step inspects the midpoint and throws away half of what
                    remains — three probes are enough for seven elements.
                  </p>
                  <CodeBlock code={`SCENE BinarySearch

DECLARE
  ARRAY arr = [11, 12, 22, 25, 34, 64, 90]

SEQUENCE
  // Searching for 64 (index 5)
  // low = 0, high = 6, mid = 3

  HIGHLIGHT arr[3]
  COMPARE arr[3] arr[5]

  // 25 < 64 — discard the left half, low = 4
  // low = 4, high = 6, mid = 5
  HIGHLIGHT arr[5]
  COMPARE arr[5] arr[5]

  // Found it
  HIGHLIGHT arr[5] 'SUCCESS'
END`} />
                  <p className="docs-p">
                    <strong>Expected behavior:</strong> only two elements are ever highlighted, against the five a linear
                    search would have needed to reach index 5.
                  </p>

                  <h3 className="docs-h3">Example 4 — Searching a BST</h3>
                  <p className="docs-p">
                    On a search tree the descent <em>is</em> the algorithm — <C>SEARCH</C> animates each comparison and
                    the branch it chose.
                  </p>
                  <CodeBlock code={`SCENE BSTSearch

DECLARE
  BST myTree = [50, 30, 70, 20, 40, 60, 80]

SEQUENCE
  // Present — three comparisons
  SEARCH 60
  WAIT

  // Absent — the descent runs out of tree
  SEARCH 90
END`} />

                  <h3 className="docs-h3">Example 5 — Searching a Graph</h3>
                  <p className="docs-p">
                    With no ordering to exploit, a graph search must explore. Depth-first and breadth-first differ only
                    in the order they take.
                  </p>
                  <CodeBlock code={`SCENE GraphSearch

DECLARE
  GRAPH g = ["A->B", "A->C", "B->D", "C->E"]

SEQUENCE
  DFS g "A"
  WAIT

  BFS g "A"
END`} />
                </section>

                <section id="se-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>

                  <Alert kind="warn" title="Binary search needs sorted input">
                    Run it on an unsorted array and it will confidently discard the half containing the target. Sort
                    first — or show the failure on purpose, which makes the precondition memorable.
                  </Alert>

                  <Alert kind="warn" title="Index bounds while narrowing">
                    A hand-written binary search that recomputes <C>mid</C> must keep it inside
                    <C>0</C>…<C>LENGTH(arr) - 1</C>. Out-of-range access halts the sequence.
                  </Alert>

                  <Alert kind="warn" title="SEARCH is for trees, not arrays">
                    <C>SEARCH</C> operates on the active tree structure. To search an array, write the comparisons with
                    <C>COMPARE</C> and <C>IF</C>.
                  </Alert>

                  <Alert kind="tip" title="Show the failed search too">
                    Searching for a value that isn't there is where the algorithm's termination rule lives. A pair of
                    calls — one hit, one miss — teaches more than either alone.
                  </Alert>

                  <Alert kind="note" title="Colour carries meaning">
                    Reserve <C>'SUCCESS'</C> for the found element and leave plain <C>HIGHLIGHT</C> for candidates being
                    examined, so the final answer is unambiguous.
                  </Alert>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════
                LAYOUT & CAMERA PAGE
            ══════════════════════════════════════════════ */}
            {activePage === 'layout-camera' && (
              <>
                <header className="docs-page-hero">
                  <div className="docs-page-tag">Spatial Syntax</div>
                  <div className="docs-page-title-row">
                    <div className="docs-page-title-icon">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 8h3l2-2h8l2 2h3v11H3z" />
                        <circle cx="12" cy="13" r="3.5" />
                      </svg>
                    </div>
                    <h1 className="docs-page-title">Layout &amp; Camera</h1>
                  </div>
                  <p className="docs-page-lead">
                    Take control of where things sit and where the camera looks — arrangement strategies, camera modes,
                    and per-element position pins.
                  </p>
                </header>

                <section id="lc-introduction" className="docs-section">
                  <h2 className="docs-h2">Introduction</h2>
                  <p className="docs-p">
                    Every structure already gets a sensible arrangement and the camera already follows the action, so a
                    program that never mentions layout still looks right. <C>LAYOUT</C>, <C>CAMERA</C>, and
                    <C>POSITION</C> are overrides for when the default is not what a particular explanation needs.
                  </p>
                  <p className="docs-p">
                    All three are ordinary <C>SEQUENCE</C> statements. They can be issued once up front, or mid-animation
                    to re-arrange a structure or move the camera at a specific beat — a graph can be force-simulated
                    while it's built and then frozen into a clean ring for the explanation.
                  </p>
                  <Alert kind="note" title="Additive by design">
                    Omitting these statements reproduces the default behaviour exactly. Nothing about an existing program
                    changes because the feature exists.
                  </Alert>
                </section>

                <section id="lc-declaration" className="docs-section">
                  <h2 className="docs-h2">LAYOUT Strategies</h2>
                  <p className="docs-p">
                    <C>LAYOUT</C> sets the arrangement strategy for one named structure. Arguments are named and all
                    optional — anything you leave out keeps the strategy's default.
                  </p>
                  <CodeBlock label="Syntax" code={`LAYOUT <target> AS <STRATEGY>(<name>=<value>, ...)`} />

                  <h3 className="docs-h3">LINE — evenly spaced row or column</h3>
                  <p className="docs-p">
                    The default for arrays, linked lists, stacks, and queues. Parameters: <C>spacing</C>,
                    <C>axis</C> (<C>horizontal</C> or <C>vertical</C>), and <C>origin</C>.
                  </p>
                  <CodeBlock code={`LAYOUT arr AS LINE(spacing=1.5, axis=horizontal)`} />

                  <h3 className="docs-h3">HIERARCHY — depth-leveled tree</h3>
                  <p className="docs-p">
                    The default for trees, BSTs, heaps, and tries. Parameters: <C>levelGap</C> (vertical distance between
                    depths, default 2.0), <C>siblingGap</C> (minimum horizontal distance between sibling subtrees,
                    default 1.5), and <C>origin</C>.
                  </p>
                  <CodeBlock code={`LAYOUT myTree AS HIERARCHY(levelGap=2, siblingGap=1)`} />

                  <h3 className="docs-h3">CIRCULAR — evenly spaced ring</h3>
                  <p className="docs-p">
                    Opt-in; nothing defaults to it. Parameters: <C>radius</C> (default 2.0), <C>startAngle</C> in degrees,
                    and <C>origin</C>. Ideal for ring buffers and for making a graph cycle obvious.
                  </p>
                  <CodeBlock code={`LAYOUT ring AS CIRCULAR(radius=4, startAngle=0)`} />

                  <h3 className="docs-h3">FORCE_DIRECTED — physics simulation</h3>
                  <p className="docs-p">
                    The default for graphs. Parameters: <C>repulsion</C> (default 5.0), <C>springLength</C> (2.0),
                    <C>springTension</C> (0.1), <C>gravity</C> (0.05), and <C>iterations</C> (100).
                  </p>
                  <CodeBlock code={`LAYOUT g AS FORCE_DIRECTED(repulsion=50, iterations=100)`} />

                  <h3 className="docs-h3">GRID — row and column matrix</h3>
                  <p className="docs-p">
                    Parameters: <C>columns</C>, <C>spacingX</C> (1.5), <C>spacingY</C> (1.5), and <C>origin</C>. Turns a
                    flat array into a matrix view.
                  </p>
                  <CodeBlock code={`LAYOUT matrix AS GRID(columns=3, spacingX=1.5, spacingY=1.5)`} />

                  <h3 className="docs-h3">CUSTOM — manual placement only</h3>
                  <p className="docs-p">
                    Takes no parameters and disables automatic placement entirely. Every element must then get its own
                    <C>POSITION</C> statement.
                  </p>
                  <CodeBlock code={`LAYOUT pts AS CUSTOM()`} />
                </section>

                <section id="lc-commands" className="docs-section">
                  <h2 className="docs-h2">Commands Reference</h2>

                  <h3 className="docs-h3">CAMERA</h3>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Command</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">CAMERA</span> <span className="tok-keyword">FOCUS</span>(<span className="tok-param">target</span>)</td>
                          <td>Soft-follows one structure or one element (<C>arr[2]</C> works) instead of the whole scene. The way to direct attention when several structures share a scene.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">CAMERA</span> <span className="tok-keyword">AUTO_FIT</span></td>
                          <td>The default: reactive follow that keeps the whole scene framed. Write it explicitly to return to it after a focus or a fixed position.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">CAMERA</span> <span className="tok-keyword">ORBIT</span>(<span className="tok-param">speed</span>)</td>
                          <td>Rotates continuously around the current target at <C>speed</C> degrees per second. Reactive follow is suspended while orbiting.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">CAMERA</span> <span className="tok-keyword">POSITION</span>(<span className="tok-param">x, y, z</span>)</td>
                          <td>Pins the camera at an absolute world position and disables all automation until a later camera statement re-enables it.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h3 className="docs-h3">POSITION</h3>
                  <div className="docs-cmd-table-wrap">
                    <table className="docs-cmd-table">
                      <thead>
                        <tr><th>Command</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="tok-keyword">POSITION</span> <span className="tok-param">target</span> <span className="tok-keyword">AT</span> (<span className="tok-param">x=, y=, z=</span>)</td>
                          <td>Pins one element to explicit coordinates, overriding its layout strategy. Each axis is optional — omitted axes stay where the strategy puts them.</td>
                        </tr>
                        <tr>
                          <td><span className="tok-keyword">POSITION</span> <span className="tok-param">target</span> <span className="tok-keyword">AT</span> ()</td>
                          <td>Releases a previous pin, returning the element to strategy-computed placement.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <Alert kind="note" title="Pins are sticky">
                    A pinned element is excluded from later layout recomputation until it is released, removed, or given
                    new coordinates.
                  </Alert>
                </section>

                <section id="lc-examples" className="docs-section">
                  <h2 className="docs-h2">Examples</h2>

                  <h3 className="docs-h3">Example 1 — Tightening an Array's Spacing</h3>
                  <CodeBlock code={`SCENE ArrayLayoutDemo

DECLARE
  ARRAY arr = [5, 3, 8, 1, 9]

SEQUENCE
  LAYOUT arr AS LINE(spacing=1.5, axis=horizontal)
  HIGHLIGHT arr[2]
  WAIT
END`} />

                  <h3 className="docs-h3">Example 2 — A Horizontal Stack</h3>
                  <p className="docs-p">
                    Stacks default to a vertical column. Switching the axis lays one out as a row instead — useful when a
                    tall structure is already using the vertical space.
                  </p>
                  <CodeBlock code={`SCENE HorizontalStackDemo

DECLARE
  STACK s

SEQUENCE
  LAYOUT s AS LINE(spacing=1.2, axis=horizontal, origin=(0, 1, 0))
  PUSH s 10
  PUSH s 20
  PUSH s 30
  WAIT
END`} />

                  <h3 className="docs-h3">Example 3 — Re-laying Out a Graph Mid-Sequence</h3>
                  <p className="docs-p">
                    Build the graph under physics, then freeze the cycle into a ring for the explanation beat. Existing
                    vertices animate to their new positions.
                  </p>
                  <CodeBlock code={`SCENE RelayoutDemo

DECLARE
  GRAPH g = ["A->B", "B->C", "C->A"]

SEQUENCE
  LAYOUT g AS FORCE_DIRECTED(iterations=60)
  WAIT

  // Freeze the now-visible cycle into a clean ring
  LAYOUT g AS CIRCULAR(radius=3)
  WAIT
END`} />

                  <h3 className="docs-h3">Example 4 — Focusing the Camera on One Structure</h3>
                  <p className="docs-p">
                    With two structures on screen, an explicit focus tells the viewer which one the current step is about.
                  </p>
                  <CodeBlock code={`SCENE MultiStructureDemo

DECLARE
  ARRAY nums = [4, 2, 7]
  BST myTree

SEQUENCE
  CAMERA FOCUS(myTree)
  INSERT 40
  INSERT 20
  INSERT 60
  WAIT

  CAMERA FOCUS(nums)
  COMPARE nums[0] nums[1]
  WAIT

  // Back to framing the whole scene
  CAMERA AUTO_FIT
END`} />

                  <h3 className="docs-h3">Example 5 — Pinning and Releasing an Element</h3>
                  <p className="docs-p">
                    Lifting one element out of the row singles it out without any colour change at all.
                  </p>
                  <CodeBlock code={`SCENE PinnedElementDemo

DECLARE
  ARRAY arr = [5, 3, 8, 1, 9]

SEQUENCE
  CAMERA POSITION(0, 6, 14)
  LAYOUT arr AS LINE(spacing=1.5, axis=horizontal)

  // Lift the third element out of the row
  POSITION arr[2] AT (x=5, y=2, z=0)
  HIGHLIGHT arr[2]
  WAIT

  // Drop it back into place
  POSITION arr[2] AT ()
  WAIT
END`} />

                  <h3 className="docs-h3">Example 6 — Fully Manual Placement</h3>
                  <CodeBlock code={`SCENE CustomLayoutDemo

DECLARE
  ARRAY pts = [1, 2, 3]

SEQUENCE
  LAYOUT pts AS CUSTOM()
  POSITION pts[0] AT (x=-3, y=0, z=0)
  POSITION pts[1] AT (x=0, y=2, z=0)
  POSITION pts[2] AT (x=3, y=0, z=0)
  WAIT
END`} />

                  <h3 className="docs-h3">Example 7 — A Slow Orbit for a Presentation</h3>
                  <CodeBlock code={`SCENE OrbitPresentationDemo

DECLARE
  BST myTree = [50, 30, 70]

SEQUENCE
  CAMERA ORBIT(15)
  INSERT 20
  WAIT
  INSERT 60
  WAIT

  CAMERA AUTO_FIT
END`} />
                </section>

                <section id="lc-errors" className="docs-section">
                  <h2 className="docs-h2">Errors &amp; Tips</h2>

                  <Alert kind="warn" title="The target must be declared">
                    <C>LAYOUT</C> names a structure from the <C>DECLARE</C> block. A typo is reported as an undeclared
                    structure, usually with a suggestion for the name you meant.
                  </Alert>

                  <Alert kind="warn" title="Only six strategies exist">
                    <C>LINE</C>, <C>HIERARCHY</C>, <C>CIRCULAR</C>, <C>FORCE_DIRECTED</C>, <C>GRID</C>, and
                    <C>CUSTOM</C>. Anything else after <C>AS</C> is rejected at compile time.
                  </Alert>

                  <Alert kind="warn" title="Named arguments, not positional">
                    Strategy arguments are written <C>spacing=1.5</C>, never bare values. <C>LINE(1.5)</C> is a parse
                    error.
                  </Alert>

                  <Alert kind="warn" title="CUSTOM needs a POSITION for every element">
                    Under <C>CUSTOM</C> an element that never receives a <C>POSITION</C> falls back to the origin, which
                    stacks elements on top of each other.
                  </Alert>

                  <Alert kind="tip" title="Use origin to separate structures">
                    Structures are already separated in depth, but an explicit <C>origin=(x, y, z)</C> is the direct way
                    to place two structures exactly where a side-by-side comparison needs them.
                  </Alert>

                  <Alert kind="note" title="Manual dragging wins">
                    Dragging in the viewport cancels automatic camera follow, exactly as it does without any
                    <C>CAMERA</C> statement. A later <C>CAMERA AUTO_FIT</C> hands control back to the automation.
                  </Alert>
                </section>
              </>
            )}

          </div>
        </div>

        {/* ── Right TOC ──────────────────────────────── */}
        <aside className="docs-toc-panel" aria-label="On this page">
          <div className="docs-toc-inner">
            <div className="docs-toc-label">ON THIS PAGE</div>
            <ul className="docs-toc-list" role="list">
              {TOC_ITEMS.map(({ id, label }) => {
                const tocIcon = id.includes('introduction') || id.includes('ll-introduction') || id.includes('sl-introduction') || id.includes('dl-introduction') || id.includes('cl-introduction') || id.includes('tr-introduction') || id.includes('gt-introduction') || id.includes('bt-introduction')
                  ? <TocIconDoc />
                  : id.includes('declaration')
                  ? <TocIconBracket />
                  : id.includes('commands')
                  ? <TocIconTerm />
                  : id.includes('examples')
                  ? <TocIconList />
                  : <TocIconWarn />;
                return (
                  <li key={id} className="docs-toc-item">
                    <button
                      className={`docs-toc-btn${activeId === id ? ' is-active' : ''}`}
                      onClick={() => scrollTo(id)}
                    >
                      <span className="docs-toc-icon">{tocIcon}</span>
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
