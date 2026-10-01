import React from 'react';

/**
 * Read-only AQVL highlighter for code shown on the site (docs, landing,
 * examples). Mirrors the compiler's keyword table
 * (packages/compiler/src/lexer/index.ts); the live editor has its own
 * tokenizer in IDEEditor.tsx.
 */
export const AQVL_KEYWORDS = new Set([
  'SCENE', 'DECLARE', 'ARRAY', 'SEQUENCE',
  'COMPARE', 'SWAP', 'HIGHLIGHT', 'WAIT', 'END',
  'LINKEDLIST', 'TYPE', 'NODE', 'EDGE', 'POINTER', 'STACK', 'QUEUE', 'HEAP',
  'GRAPH', 'VERTEX', 'GRAPH_EDGE', 'TREE', 'TREE_NODE', 'BINARY_TREE', 'BST',
  'LABEL', 'ANNOTATION', 'LINK', 'RELATION',
  'TO', 'FROM', 'PARENT', 'CHILD', 'LEFT_CHILD', 'RIGHT_CHILD', 'SIBLING',
  'INSERT', 'DELETE', 'INSERT_HEAD', 'INSERT_TAIL', 'DELETE_HEAD', 'DELETE_TAIL', 'FREE', 'NEW_NODE',
  'MOVE', 'CONNECT', 'DISCONNECT', 'PUSH', 'POP', 'PEEK',
  'ENQUEUE', 'DEQUEUE', 'FRONT', 'REAR', 'VISIT', 'MARK', 'TRAVERSE', 'ROTATE', 'SEARCH', 'HEAPIFY', 'UPDATE',
  'HEAP_INSERT', 'HEAP_EXTRACT', 'HEAP_DECREASE', 'BUILD_HEAP',
  'HASH_MAP', 'HASHMAP_INSERT', 'HASHMAP_LOOKUP', 'HASHMAP_DELETE',
  'TRIE_INSERT', 'TRIE_SEARCH', 'TRIE_DELETE', 'TRIE_AUTOCOMPLETE', 'TRIE_STARTSWITH',
  'SET', 'STATE', 'LOOP', 'LENGTH', 'NULL', 'TRIE', 'IF', 'HEAD', 'CLEAR', 'IS_EMPTY',
  'ROOT', 'REMOVE', 'COPY', 'FIND', 'SELECT',
  'PREORDER', 'INORDER', 'POSTORDER', 'LEVELORDER', 'REVERSELEVELORDER', 'REVERSE', 'ZIGZAG',
  'DFS', 'BFS', 'DIJKSTRA', 'BELLMAN_FORD', 'ASTAR', 'PRIM', 'KRUSKAL', 'TOPO_SORT',
  'ADD_VERTEX', 'ADD_EDGE', 'REMOVE_EDGE', 'REMOVE_VERTEX', 'VERTEX_AT', 'VERTEX_COUNT', 'EDGE_AT', 'EDGE_COUNT',
  'IN_DEGREE', 'NEIGHBOR', 'WEIGHT', 'HAS_EDGE', 'TRUE', 'FALSE', 'INFINITY',
  'CONTAINS', 'KEY_AT', 'BUCKET_OF', 'CAPACITY', 'TEXT_LENGTH', 'CHAR_AT', 'CHAR_CODE',
  'HAS_CHILD', 'GET_CHILD', 'ADD_CHILD', 'REMOVE_CHILD', 'CHILD_COUNT', 'CHILD_AT', 'WORD_COUNT', 'NODE_COUNT',
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
  'WHILE', 'ELSE', 'PRINT', 'AND', 'OR', 'FUNCTION', 'RETURN',
  'LAYOUT', 'AS', 'LINE', 'HIERARCHY', 'FORCE_DIRECTED', 'GRID', 'CUSTOM',
  'CAMERA', 'FOCUS', 'AUTO_FIT', 'ORBIT', 'POSITION', 'AT',
]);

/** Structural modifiers get their own (italic) treatment. */
export const STRUCTURAL = new Set(['CIRCULAR', 'DIRECTED', 'UNDIRECTED', 'DOUBLY', 'SINGLY']);

const SPLIT = /(\s+|"[^"]*"|'[^']*'|<->|<-|->|<=|>=|==|!=|\[|\]|\{|\}|:|=|,|\(|\)|>|<|\+|-|\*|\/|\.)/g;

function tokenClass(part: string): string | null {
  if (STRUCTURAL.has(part)) return 'tk-st';
  if (AQVL_KEYWORDS.has(part)) return 'tk-kw';
  if (/^(["']).*\1$/.test(part)) return 'tk-str';
  if (/^\d+(\.\d+)?$/.test(part)) return 'tk-num';
  if (/^[=><!{}:,+\-*/[\]().]+$/.test(part) && part.trim()) return 'tk-op';
  return null;
}

/** One React node per source line (no trailing newline). */
export function highlightLines(source: string): React.ReactNode[] {
  return source.split('\n').map((line, li) => {
    const commentAt = line.indexOf('//');
    const code = commentAt >= 0 ? line.slice(0, commentAt) : line;
    const comment = commentAt >= 0 ? line.slice(commentAt) : '';
    const parts = code.split(SPLIT).filter((p) => p !== '');
    return (
      <React.Fragment key={li}>
        {parts.map((part, pi) => {
          const cls = tokenClass(part);
          return cls ? (
            <span key={pi} className={cls}>
              {part}
            </span>
          ) : (
            <React.Fragment key={pi}>{part}</React.Fragment>
          );
        })}
        {comment && <span className="tk-com">{comment}</span>}
      </React.Fragment>
    );
  });
}
