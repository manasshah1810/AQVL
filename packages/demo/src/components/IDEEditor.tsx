import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
} from 'react';

// ─────────────────────────────────────────────────────────────────────────────
//  AQVL Keyword Definitions (synced with compiler/src/lexer/index.ts)
// ─────────────────────────────────────────────────────────────────────────────

const AQVL_KEYWORDS = new Set([
  'SCENE', 'DECLARE', 'ARRAY', 'SEQUENCE',
  'COMPARE', 'SWAP', 'HIGHLIGHT', 'WAIT', 'END',
  'LINKEDLIST', 'TYPE', 'SINGLY', 'DOUBLY', 'CIRCULAR',
  'NODE', 'EDGE', 'POINTER', 'STACK', 'QUEUE', 'HEAP', 'HASH_MAP',
  'GRAPH', 'VERTEX', 'GRAPH_EDGE', 'TREE', 'TREE_NODE', 'BINARY_TREE', 'BST',
  'LABEL', 'ANNOTATION', 'LINK', 'RELATION', 'DIRECTED', 'UNDIRECTED',
  'TO', 'FROM', 'PARENT', 'CHILD', 'LEFT_CHILD', 'RIGHT_CHILD', 'SIBLING',
  'INSERT', 'DELETE', 'INSERT_HEAD', 'INSERT_TAIL', 'DELETE_HEAD', 'DELETE_TAIL', 'FREE', 'NEW_NODE',
  'MOVE', 'CONNECT', 'DISCONNECT', 'PUSH', 'POP', 'PEEK',
  'ENQUEUE', 'DEQUEUE', 'FRONT', 'REAR', 'VISIT', 'MARK', 'TRAVERSE',
  'ROTATE', 'SEARCH', 'HEAPIFY', 'HEAP_INSERT', 'HEAP_EXTRACT', 'HEAP_DECREASE', 'BUILD_HEAP',
  'HASHMAP_INSERT', 'HASHMAP_LOOKUP', 'HASHMAP_DELETE',
  'TRIE_INSERT', 'TRIE_SEARCH', 'TRIE_DELETE', 'TRIE_AUTOCOMPLETE', 'TRIE_STARTSWITH', 'UPDATE',
  'SET', 'STATE', 'LOOP', 'LENGTH', 'NULL', 'TRIE', 'IF', 'HEAD', 'CLEAR', 'IS_EMPTY',
  'ROOT', 'REMOVE', 'COPY', 'FIND', 'SELECT',
  'PREORDER', 'INORDER', 'POSTORDER', 'LEVELORDER', 'REVERSELEVELORDER',
  'REVERSE', 'ZIGZAG', 'DFS', 'BFS',
  'HEIGHT', 'DEPTH', 'LEVEL', 'MAX_DEPTH', 'MIN_DEPTH', 'SIZE', 'LEAVES',
  'INTERNAL', 'DEGREE', 'STATS', 'PARENTOF', 'CHILDRENOF', 'ANCESTORS',
  'DESCENDANTS', 'SIBLINGS', 'PATH', 'INTO',
  'COUNT_NODES', 'COUNT_LEAVES', 'COUNT_INTERNAL', 'COUNT_LEFT_LEAVES',
  'COUNT_RIGHT_LEAVES', 'COUNT_FULL', 'COUNT_HALF',
  'IS_FULL', 'IS_COMPLETE', 'IS_PERFECT', 'IS_BALANCED', 'IS_DEGENERATE',
  'IS_LEFT_SKEWED', 'IS_RIGHT_SKEWED', 'IS_SYMMETRIC',
  'LCA', 'DISTANCE', 'GRANDPARENT', 'UNCLE', 'COUSINS',
  'ROOT_TO_NODE', 'ROOT_TO_LEAVES', 'LONGEST_PATH', 'SHORTEST_PATH',
  'MIRROR', 'INVERT', 'CLONE', 'REMOVE_LEAVES', 'PRUNE',
  'LEFT_VIEW', 'RIGHT_VIEW', 'TOP_VIEW', 'BOTTOM_VIEW', 'BOUNDARY',
  'VERTICAL_ORDER', 'DIAGONAL',
  'MAX_VALUE', 'MIN_VALUE', 'MIN', 'MAX', 'SUM', 'AVERAGE', 'MAX_LEVEL_SUM',
  'WHILE', 'ELSE', 'PRINT', 'AND', 'OR', 'FUNCTION', 'RETURN',
  'BUBBLE_SORT', 'SELECTION_SORT', 'INSERTION_SORT', 'MERGE_SORT', 'QUICK_SORT',
]);

const SORTED_KEYWORDS = Array.from(AQVL_KEYWORDS).sort();

// Special structural keywords with distinct color
const STRUCTURAL_KEYWORDS = new Set(['CIRCULAR', 'DIRECTED', 'UNDIRECTED', 'DOUBLY', 'SINGLY']);

// Auto-closing pairs
const CLOSE_MAP: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '"': '"',
  "'": "'",
};

// ─────────────────────────────────────────────────────────────────────────────
//  Token-based Syntax Highlighter
//  Processes raw text safely — never runs regex on HTML strings
// ─────────────────────────────────────────────────────────────────────────────

interface HighlightToken {
  text: string;
  type: 'keyword' | 'structural' | 'number' | 'string' | 'comment' | 'default';
}

function tokenizeLine(line: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let i = 0;
  const len = line.length;

  while (i < len) {
    // Comment
    if (line[i] === '/' && line[i + 1] === '/') {
      tokens.push({ text: line.slice(i), type: 'comment' });
      break;
    }

    // String literal (single or double quote)
    if (line[i] === '"' || line[i] === "'") {
      const quote = line[i];
      let j = i + 1;
      while (j < len && line[j] !== quote) j++;
      if (j < len) j++; // include closing quote
      tokens.push({ text: line.slice(i, j), type: 'string' });
      i = j;
      continue;
    }

    // Number
    if (line[i] >= '0' && line[i] <= '9') {
      let j = i;
      let hasDot = false;
      while (j < len && (
        (line[j] >= '0' && line[j] <= '9') ||
        (line[j] === '.' && !hasDot && (hasDot = true))
      )) j++;
      tokens.push({ text: line.slice(i, j), type: 'number' });
      i = j;
      continue;
    }

    // Identifier / keyword
    if (isIdentStart(line[i])) {
      let j = i;
      while (j < len && isIdentPart(line[j])) j++;
      const word = line.slice(i, j);
      const upper = word.toUpperCase();
      let type: HighlightToken['type'] = 'default';
      if (STRUCTURAL_KEYWORDS.has(upper)) {
        type = 'structural';
      } else if (AQVL_KEYWORDS.has(upper)) {
        type = 'keyword';
      }
      tokens.push({ text: word, type });
      i = j;
      continue;
    }

    // Default: single character
    tokens.push({ text: line[i], type: 'default' });
    i++;
  }

  return tokens;
}

function isIdentStart(c: string) {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
}
function isIdentPart(c: string) {
  return isIdentStart(c) || (c >= '0' && c <= '9');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function highlightCode(code: string): string {
  const lines = code.split('\n');
  const htmlLines = lines.map((line) => {
    if (line === '') return '';
    const toks = tokenizeLine(line);
    const spans = toks.map((tok) => {
      const escaped = escapeHtml(tok.text);
      if (tok.type === 'default') return escaped;
      return `<span class="hl-${tok.type}">${escaped}</span>`;
    });
    return spans.join('');
  });
  // Trailing newline guard: ensure overlay is always at least as tall
  return htmlLines.join('\n') + '\n';
}

// ─────────────────────────────────────────────────────────────────────────────
//  Undo / Redo History
// ─────────────────────────────────────────────────────────────────────────────

interface HistoryEntry {
  value: string;
  selStart: number;
  selEnd: number;
}

const MAX_HISTORY = 500;

// ─────────────────────────────────────────────────────────────────────────────
//  Autocomplete
// ─────────────────────────────────────────────────────────────────────────────

function getWordBefore(text: string, cursor: number): string {
  let i = cursor - 1;
  while (i >= 0 && isIdentPart(text[i])) i--;
  return text.slice(i + 1, cursor);
}

function getSuggestions(prefix: string): string[] {
  if (!prefix || prefix.length < 1) return [];
  const upper = prefix.toUpperCase();
  return SORTED_KEYWORDS.filter((kw) => kw.startsWith(upper) && kw !== upper);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────────────────────────────────────

export interface EditorErrorMarker {
  /** 1-indexed source line the diagnostic points at. */
  line: number;
  /** 1-indexed source column (start of the offending token), if known. */
  column?: number;
  /** Number of characters to underline, starting at `column`. Defaults to the identifier at that position. */
  length?: number;
  message: string;
}

interface IDEEditorProps {
  initialValue: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  errorMarkers?: EditorErrorMarker[];
}

const INDENT = '  '; // 2 spaces

// Fallback metrics, used only until the real values are measured from the
// live DOM (see `measureEditorMetrics` below). Host pages can override the
// editor's CSS (padding/line-height get reset, fonts can load late), so
// hardcoding these would silently drift out of sync with what's on screen —
// which is exactly what caused inline diagnostic markers to render at the
// wrong pixel offset on the Playground page (padding there is zeroed by a
// `.playground-root *` reset that loads after this component's own CSS).
const FALLBACK_LINE_HEIGHT = 22;
const FALLBACK_CHAR_WIDTH  = 7.8;
const FALLBACK_PAD_TOP     = 10;
const FALLBACK_PAD_LEFT    = 14;

interface EditorMetrics {
  lineHeight: number;
  charWidth: number;
  padTop: number;
  padLeft: number;
}

const FALLBACK_METRICS: EditorMetrics = {
  lineHeight: FALLBACK_LINE_HEIGHT,
  charWidth: FALLBACK_CHAR_WIDTH,
  padTop: FALLBACK_PAD_TOP,
  padLeft: FALLBACK_PAD_LEFT,
};

/**
 * Reads the editor's *actual* rendered metrics off the live textarea/overlay
 * instead of assuming fixed CSS values, so caret/marker math stays correct
 * even if a host page's stylesheet overrides padding or the monospace
 * webfont hasn't finished loading yet.
 */
function measureEditorMetrics(textarea: HTMLTextAreaElement, measureEl: HTMLSpanElement): EditorMetrics {
  const cs = getComputedStyle(textarea);
  const parsedPadTop  = parseFloat(cs.paddingTop);
  const parsedPadLeft = parseFloat(cs.paddingLeft);
  // NB: `parsed || FALLBACK` would be wrong here — a legitimately-zero
  // padding (e.g. a host stylesheet resetting it) is falsy and would get
  // clobbered back to the fallback. Only NaN (property unreadable) should fall back.
  const padTop  = Number.isFinite(parsedPadTop) ? parsedPadTop : FALLBACK_PAD_TOP;
  const padLeft = Number.isFinite(parsedPadLeft) ? parsedPadLeft : FALLBACK_PAD_LEFT;
  let lineHeight = parseFloat(cs.lineHeight);
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) lineHeight = FALLBACK_LINE_HEIGHT;

  // measureEl is a hidden <span> living inside the overlay (so it inherits
  // the exact same font-family/size/letter-spacing) holding N repeated
  // monospace characters — width / N gives the real per-character advance.
  const sample = measureEl.textContent || '';
  const width = measureEl.getBoundingClientRect().width;
  const charWidth = sample.length > 0 && width > 0 ? width / sample.length : FALLBACK_CHAR_WIDTH;

  return { lineHeight, charWidth, padTop, padLeft };
}

export function IDEEditor({ initialValue, onChange, readOnly = false, errorMarkers = [] }: IDEEditorProps) {
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const overlayRef     = useRef<HTMLDivElement>(null);
  const errorOverlayRef = useRef<HTMLDivElement>(null);     // squiggly-underline layer (scroll-synced)
  const gutterRef      = useRef<HTMLDivElement>(null);      // outer gutter (clipping)
  const gutterBodyRef  = useRef<HTMLDivElement>(null);      // inner gutter (translated)
  const containerRef   = useRef<HTMLDivElement>(null);
  const measureRef     = useRef<HTMLSpanElement>(null);      // hidden sample text for char-width measurement

  // Reads real layout metrics straight off the live DOM on every call — no
  // caching, so there's no risk of a stale value from a render that raced a
  // stylesheet or webfont still loading (see measureEditorMetrics's doc comment).
  const getMetrics = useCallback((): EditorMetrics => {
    const ta = textareaRef.current;
    const probe = measureRef.current;
    if (!ta || !probe) return FALLBACK_METRICS;
    return measureEditorMetrics(ta, probe);
  }, []);

  // Local value — uncontrolled to preserve cursor. Event handlers read the
  // latest text from valueRef; rendering reads `text`, the snapshot that
  // rerender() copies from it.
  const valueRef = useRef<string>(initialValue);
  const [text, setText] = useState(initialValue);
  const rerender = useCallback(() => setText(valueRef.current), []);

  // Track previous initialValue to detect *external* changes (example switch)
  const prevInitialRef = useRef<string>(initialValue);

  // Undo/redo
  const historyRef = useRef<HistoryEntry[]>([{ value: initialValue, selStart: 0, selEnd: 0 }]);
  const historyIndexRef = useRef<number>(0);
  const skipHistoryRef  = useRef<boolean>(false); // suppresses push during undo/redo

  // Autocomplete
  const [acSuggestions, setAcSuggestions] = useState<string[]>([]);
  const [acIndex, setAcIndex]             = useState<number>(0);
  const [acVisible, setAcVisible]         = useState<boolean>(false);
  const [acPos, setAcPos]                 = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const acPrefixRef = useRef<string>('');

  // Highlighted HTML (memoized)
  const highlightedHtml = useMemo(() => highlightCode(text), [text]);

  // ── Sync external initialValue changes (example switches) ──────────────────
  useEffect(() => {
    if (initialValue !== prevInitialRef.current) {
      prevInitialRef.current = initialValue;
      // Only reset if the new value is actually different from our current local state.
      // This prevents cursor jumps when the parent echoes our onChange back as initialValue.
      if (initialValue !== valueRef.current) {
        valueRef.current = initialValue;
        historyRef.current = [{ value: initialValue, selStart: 0, selEnd: 0 }];
        historyIndexRef.current = 0;
        if (textareaRef.current) {
          textareaRef.current.value = initialValue;
          textareaRef.current.setSelectionRange(0, 0);
        }
        rerender();
      }
    }
  }, [initialValue, rerender]);

  // ── Scroll sync (textarea → overlay + gutter) ─────────────────────────────
  // Uses direct scrollTop/scrollLeft copy to overlay (overflow:auto, hidden scrollbar).
  // Uses CSS translateY on an inner gutter div (avoids overflow:hidden scrollTop bug).
  const syncScroll = useCallback(() => {
    const ta = textareaRef.current;
    const ov = overlayRef.current;
    const eov = errorOverlayRef.current;
    const gb = gutterBodyRef.current;
    if (!ta) return;
    if (ov) {
      ov.scrollTop  = ta.scrollTop;
      ov.scrollLeft = ta.scrollLeft;
    }
    if (eov) {
      eov.scrollTop  = ta.scrollTop;
      eov.scrollLeft = ta.scrollLeft;
    }
    if (gb) {
      gb.style.transform = `translateY(-${ta.scrollTop}px)`;
    }
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.addEventListener('scroll', syncScroll, { passive: true });
    return () => ta.removeEventListener('scroll', syncScroll);
  }, [syncScroll]);


  // ── Push to undo history ──────────────────────────────────────────────────
  const pushHistory = useCallback((value: string, selStart: number, selEnd: number) => {
    if (skipHistoryRef.current) return;
    const history  = historyRef.current;
    const idx      = historyIndexRef.current;
    const last     = history[idx];
    if (last && last.value === value) return; // no change

    const newEntry: HistoryEntry = { value, selStart, selEnd };
    const truncated = history.slice(0, idx + 1);
    truncated.push(newEntry);
    if (truncated.length > MAX_HISTORY) truncated.shift();
    historyRef.current      = truncated;
    historyIndexRef.current = truncated.length - 1;
  }, []);

  // ── Apply a value + selection to the textarea ─────────────────────────────
  const applyValue = useCallback((value: string, selStart: number, selEnd: number) => {
    valueRef.current = value;
    const ta = textareaRef.current;
    if (ta) {
      ta.value = value;
      ta.setSelectionRange(selStart, selEnd);
    }
    onChange(value);
    rerender();
  }, [onChange, rerender]);

  // ── Undo ──────────────────────────────────────────────────────────────────
  const undo = useCallback(() => {
    const idx = historyIndexRef.current;
    if (idx <= 0) return;
    historyIndexRef.current = idx - 1;
    const entry = historyRef.current[idx - 1];
    skipHistoryRef.current = true;
    applyValue(entry.value, entry.selStart, entry.selEnd);
    skipHistoryRef.current = false;
  }, [applyValue]);

  // ── Redo ──────────────────────────────────────────────────────────────────
  const redo = useCallback(() => {
    const idx     = historyIndexRef.current;
    const history = historyRef.current;
    if (idx >= history.length - 1) return;
    historyIndexRef.current = idx + 1;
    const entry = history[idx + 1];
    skipHistoryRef.current = true;
    applyValue(entry.value, entry.selStart, entry.selEnd);
    skipHistoryRef.current = false;
  }, [applyValue]);

  // ── Autocomplete helpers ──────────────────────────────────────────────────
  const updateAutocomplete = useCallback((value: string, cursor: number) => {
    const prefix = getWordBefore(value, cursor);
    acPrefixRef.current = prefix;
    if (prefix.length === 0) {
      setAcVisible(false);
      return;
    }
    const suggs = getSuggestions(prefix);
    if (suggs.length === 0) {
      setAcVisible(false);
      return;
    }

    // Compute caret position relative to container
    const ta = textareaRef.current;
    if (ta) {
      // Measure caret position using a mirror div technique
      const linesBefore = value.slice(0, cursor).split('\n');
      const lineIndex   = linesBefore.length - 1;
      const colIndex    = linesBefore[linesBefore.length - 1].length;
      const m = getMetrics();
      const lineHeight  = m.lineHeight;
      const charWidth   = m.charWidth;
      const paddingTop  = m.padTop;
      const paddingLeft = m.padLeft;

      // The dropdown is positioned inside .aqvl-editor-content (already to
      // the right of the gutter), so no gutter offset is added here.
      const top  = paddingTop + (lineIndex + 1) * lineHeight - ta.scrollTop;
      const left = paddingLeft + (colIndex - prefix.length) * charWidth - ta.scrollLeft;

      setAcPos({ top, left });
    }

    setAcSuggestions(suggs);
    setAcIndex(0);
    setAcVisible(true);
  }, [getMetrics]);

  const acceptSuggestion = useCallback((suggestion: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart;
    const value  = valueRef.current;
    const prefix = acPrefixRef.current;
    const start  = cursor - prefix.length;
    const newValue = value.slice(0, start) + suggestion + value.slice(cursor);
    const newCursor = start + suggestion.length;
    pushHistory(newValue, newCursor, newCursor);
    applyValue(newValue, newCursor, newCursor);
    setAcVisible(false);
  }, [applyValue, pushHistory]);

  // ── Key handler ───────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = textareaRef.current;
    if (!ta) return;

    // ── Autocomplete navigation ───────────────────────────────────────────
    if (acVisible) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAcIndex((i) => Math.min(i + 1, acSuggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAcIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        acceptSuggestion(acSuggestions[acIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setAcVisible(false);
        return;
      }
    }

    const value    = valueRef.current;
    const selStart = ta.selectionStart;
    const selEnd   = ta.selectionEnd;
    const hasSelection = selStart !== selEnd;

    // ── Undo / Redo ───────────────────────────────────────────────────────
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
      e.preventDefault();
      undo();
      return;
    }
    if (
      (e.ctrlKey || e.metaKey) && e.key === 'y' ||
      (e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z'
    ) {
      e.preventDefault();
      redo();
      return;
    }

    // ── Tab (indent) ──────────────────────────────────────────────────────
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Tab: dedent selected lines
        const lineStart = value.lastIndexOf('\n', selStart - 1) + 1;
        // If selection ends at the very start of a line (after \n), don't include that empty line
        const adjustedSelEnd = (selEnd > selStart && value[selEnd - 1] === '\n') ? selEnd - 1 : selEnd;
        const lineEnd   = adjustedSelEnd;
        const selected  = value.slice(lineStart, lineEnd);
        const dedented  = selected.replace(/^ {2}/gm, '');
        if (dedented !== selected) {
          const removed = selected.length - dedented.length;
          const newValue = value.slice(0, lineStart) + dedented + value.slice(lineEnd);
          const newSelStart = Math.max(lineStart, selStart - Math.min(2, selStart - lineStart));
          const newSelEnd   = selEnd - removed;
          pushHistory(newValue, newSelStart, newSelEnd);
          applyValue(newValue, newSelStart, newSelEnd);
        }
      } else if (hasSelection) {
        // Tab with selection: indent all selected lines
        const lineStart = value.lastIndexOf('\n', selStart - 1) + 1;
        const adjustedSelEnd = (selEnd > selStart && value[selEnd - 1] === '\n') ? selEnd - 1 : selEnd;
        const lineEnd   = adjustedSelEnd;
        const selected  = value.slice(lineStart, lineEnd);
        const indented  = selected.replace(/^/gm, INDENT);
        const newValue  = value.slice(0, lineStart) + indented + value.slice(lineEnd);
        const newSelEnd = selEnd + (indented.length - selected.length);
        pushHistory(newValue, selStart + INDENT.length, newSelEnd);
        applyValue(newValue, selStart + INDENT.length, newSelEnd);
      } else {
        // Simple tab: insert 2 spaces
        const newValue  = value.slice(0, selStart) + INDENT + value.slice(selEnd);
        const newCursor = selStart + INDENT.length;
        pushHistory(newValue, newCursor, newCursor);
        applyValue(newValue, newCursor, newCursor);
      }
      return;
    }

    // ── Enter (smart indent) ──────────────────────────────────────────────
    if (e.key === 'Enter') {
      e.preventDefault();
      // Get the current line's leading whitespace
      const lineStart = value.lastIndexOf('\n', selStart - 1) + 1;
      const currentLine = value.slice(lineStart, selStart);
      const indentMatch = currentLine.match(/^(\s*)/);
      const baseIndent  = indentMatch ? indentMatch[1] : '';

      const before = value.slice(0, selStart);
      const after  = value.slice(selEnd);
      const newValue  = before + '\n' + baseIndent + after;
      const newCursor = selStart + 1 + baseIndent.length;
      pushHistory(newValue, newCursor, newCursor);
      applyValue(newValue, newCursor, newCursor);
      setAcVisible(false);
      return;
    }

    // ── Backspace (smart dedent) ───────────────────────────────────────────
    if (e.key === 'Backspace' && !hasSelection) {
      const lineStart   = value.lastIndexOf('\n', selStart - 1) + 1;
      const colOffset   = selStart - lineStart;
      const charsBefore = value.slice(lineStart, selStart);

      // If we're at the start of an indent chunk, remove whole indent
      if (colOffset > 0 && charsBefore.trimEnd() === '' && colOffset % INDENT.length === 0) {
        e.preventDefault();
        const newValue  = value.slice(0, selStart - INDENT.length) + value.slice(selStart);
        const newCursor = selStart - INDENT.length;
        pushHistory(newValue, newCursor, newCursor);
        applyValue(newValue, newCursor, newCursor);
        return;
      }

      // Auto-close pair removal: if cursor is between matching pair, delete both
      const charBefore = value[selStart - 1];
      const charAfter  = value[selStart];
      if (charBefore && charAfter && CLOSE_MAP[charBefore] === charAfter) {
        e.preventDefault();
        const newValue  = value.slice(0, selStart - 1) + value.slice(selStart + 1);
        const newCursor = selStart - 1;
        pushHistory(newValue, newCursor, newCursor);
        applyValue(newValue, newCursor, newCursor);
        return;
      }
    }

    // ── Auto-close brackets / quotes ─────────────────────────────────────
    if (CLOSE_MAP[e.key] && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // For quotes, only auto-close if no word char immediately before
      if (e.key === '"' || e.key === "'") {
        const charBefore = value[selStart - 1];
        if (charBefore && isIdentPart(charBefore)) {
          // Don't auto-close inside words
          return;
        }
        // If next char is the same quote (already closed), just skip over it
        if (value[selStart] === e.key) {
          e.preventDefault();
          const newCursor = selStart + 1;
          ta.setSelectionRange(newCursor, newCursor);
          return;
        }
      }

      // If there's a selection, wrap it
      if (hasSelection) {
        e.preventDefault();
        const selected = value.slice(selStart, selEnd);
        const newValue = value.slice(0, selStart) + e.key + selected + CLOSE_MAP[e.key] + value.slice(selEnd);
        pushHistory(newValue, selStart + 1, selEnd + 1);
        applyValue(newValue, selStart + 1, selEnd + 1);
        return;
      }

      e.preventDefault();
      const newValue  = value.slice(0, selStart) + e.key + CLOSE_MAP[e.key] + value.slice(selEnd);
      const newCursor = selStart + 1;
      pushHistory(newValue, newCursor, newCursor);
      applyValue(newValue, newCursor, newCursor);
      return;
    }

    // ── Skip-over closing char ────────────────────────────────────────────
    const closers = new Set(Object.values(CLOSE_MAP));
    if (!hasSelection && closers.has(e.key) && value[selStart] === e.key) {
      // But only skip over if it was auto-inserted (i.e. matching open is right before)
      const openChar = Object.keys(CLOSE_MAP).find((k) => CLOSE_MAP[k] === e.key);
      if (openChar && value[selStart - 1] === openChar) {
        e.preventDefault();
        ta.setSelectionRange(selStart + 1, selStart + 1);
        return;
      }
    }
  }, [acVisible, acSuggestions, acIndex, acceptSuggestion, undo, redo, applyValue, pushHistory]);

  // ── onChange from textarea (actual text input) ────────────────────────────
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursor   = e.target.selectionStart;
    valueRef.current = newValue;
    pushHistory(newValue, cursor, cursor);
    onChange(newValue);
    updateAutocomplete(newValue, cursor);
    rerender(); // triggers highlighted HTML recalc
  }, [onChange, pushHistory, updateAutocomplete, rerender]);

  // ── Click / cursor movement ───────────────────────────────────────────────
  const handleClick = useCallback(() => {
    setAcVisible(false);
  }, []);

  const handleKeyUp = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = textareaRef.current;
    if (!ta) return;
    // Update autocomplete on cursor movement keys
    const navKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);
    if (navKeys.has(e.key)) {
      updateAutocomplete(valueRef.current, ta.selectionStart);
    }
  }, [updateAutocomplete]);

  // ── Line count for gutter ────────────────────────────────────────────────
  const lineCount = useMemo(() => text.split('\n').length, [text]);

  // ── Error markers (inline diagnostics from the compiler) ───────────────────
  // Map line -> messages, for gutter dots (a line can carry more than one diagnostic).
  const errorsByLine = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const m of errorMarkers) {
      if (!Number.isFinite(m.line) || m.line < 1) continue;
      const list = map.get(m.line) ?? [];
      list.push(m.message);
      map.set(m.line, list);
    }
    return map;
  }, [errorMarkers]);

  // Squiggle geometry: one absolutely-positioned span per marker, sized to the
  // offending token (or a single-char fallback when no column is known).
  // Kept in character units (line / column / length); the layout effect below
  // measures the editor and turns them into pixels through CSS variables, so
  // rendering never reads the DOM.
  const errorSquiggles = useMemo(() => {
    if (errorMarkers.length === 0) return [];
    const lines = text.split('\n');
    return errorMarkers
      .filter((e) => Number.isFinite(e.line) && e.line >= 1 && e.line <= lines.length)
      .map((e, idx) => {
        const lineText = lines[e.line - 1] ?? '';
        const startCol = Math.max(0, (e.column ?? 1) - 1);
        let length = e.length;
        if (!length) {
          let j = startCol;
          while (j < lineText.length && isIdentPart(lineText[j])) j++;
          length = Math.max(1, j - startCol);
        }
        return {
          key: `${e.line}:${e.column ?? 0}:${idx}`,
          lineIndex: e.line - 1,
          startCol,
          length,
          message: e.message,
        };
      });
  }, [errorMarkers, text]);

  // Pixel metrics for the squiggles, measured off the live DOM after each layout.
  useLayoutEffect(() => {
    const layer = errorOverlayRef.current;
    if (!layer) return;
    const m = getMetrics();
    layer.style.setProperty('--sq-line-height', `${m.lineHeight}px`);
    layer.style.setProperty('--sq-char-width', `${m.charWidth}px`);
    layer.style.setProperty('--sq-pad-top', `${m.padTop}px`);
    layer.style.setProperty('--sq-pad-left', `${m.padLeft}px`);
  }, [errorSquiggles, getMetrics]);

  const [currentLine, setCurrentLine] = useState(1);

  const updateCurrentLine = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const linesAbove = ta.value.slice(0, ta.selectionStart).split('\n').length;
    setCurrentLine(linesAbove);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="aqvl-editor-root" ref={containerRef}>
      {/* Gutter — line numbers. Outer div clips; inner div is translateY'd on scroll. */}
      <div className="aqvl-editor-gutter" ref={gutterRef} aria-hidden="true">
        <div className="aqvl-gutter-body" ref={gutterBodyRef}>
          {Array.from({ length: lineCount }, (_, i) => {
            const lineErrors = errorsByLine.get(i + 1);
            return (
              <div
                key={i + 1}
                className={`aqvl-gutter-line${i + 1 === currentLine ? ' current' : ''}${lineErrors ? ' has-error' : ''}`}
                title={lineErrors ? lineErrors.join('\n') : undefined}
              >
                {lineErrors && <span className="aqvl-gutter-error-dot" />}
                {i + 1}
              </div>
            );
          })}
        </div>
      </div>

      {/* Editor content area */}
      <div className="aqvl-editor-content">
        {/* Highlighted overlay — rendered below, pointer-events: none */}
        <div
          ref={overlayRef}
          className="aqvl-editor-overlay"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />

        {/* Hidden sample text used only to measure the real per-character
            width (shares .aqvl-editor-overlay's font rules; dangerouslySetInnerHTML
            above rules out nesting it inside that div). */}
        <span ref={measureRef} className="aqvl-editor-overlay aqvl-metrics-probe" aria-hidden="true">
          MMMMMMMMMM
        </span>

        {/* Diagnostic squiggles — scroll-synced layer above syntax, below caret */}
        {errorSquiggles.length > 0 && (
          <div ref={errorOverlayRef} className="aqvl-error-overlay" aria-hidden="true">
            {errorSquiggles.map((sq) => (
              <span
                key={sq.key}
                className="aqvl-error-squiggle"
                style={{
                  top: `calc(var(--sq-pad-top) + ${sq.lineIndex} * var(--sq-line-height))`,
                  left: `calc(var(--sq-pad-left) + ${sq.startCol} * var(--sq-char-width))`,
                  width: `calc(${sq.length} * var(--sq-char-width))`,
                }}
                title={sq.message}
              />
            ))}
          </div>
        )}

        {/* Actual textarea — transparent text, sits on top of overlay */}
        <textarea
          ref={textareaRef}
          className="aqvl-editor-textarea"
          defaultValue={initialValue}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          data-gramm="false"
          data-gramm_editor="false"
          data-enable-grammarly="false"
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onClick={handleClick}
          onSelect={updateCurrentLine}
          onKeyDownCapture={updateCurrentLine}
          aria-label="AQVL source code editor"
        />

        {/* Autocomplete dropdown */}
        {acVisible && acSuggestions.length > 0 && (
          <div
            className="aqvl-autocomplete"
            style={{ top: acPos.top, left: acPos.left }}
            onMouseDown={(e) => e.preventDefault()} // prevent textarea blur
          >
            {acSuggestions.slice(0, 10).map((sug, idx) => (
              <div
                key={sug}
                className={`aqvl-autocomplete-item${idx === acIndex ? ' selected' : ''}`}
                onMouseEnter={() => setAcIndex(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  acceptSuggestion(sug);
                }}
              >
                <span className="aqvl-autocomplete-kw">{sug}</span>
                <span className="aqvl-autocomplete-hint">keyword</span>
              </div>
            ))}
            <div className="aqvl-autocomplete-footer">
              ↑↓ navigate · Tab/Enter accept · Esc dismiss
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
