/**
 * 2D sketches of AQVL's six layout strategies, used for the explanatory
 * diagrams on the site. These mirror the idea of each strategy, not the
 * engine's exact 3D numbers (those live in the runtime's layout modules).
 * Coordinates are in a unit box, x and y in [-1, 1].
 */
export type Strategy = 'LINE' | 'HIERARCHY' | 'CIRCULAR' | 'FORCE_DIRECTED' | 'GRID' | 'CUSTOM';
export type Pt = [number, number];

export const STRATEGIES: Strategy[] = ['LINE', 'CIRCULAR', 'HIERARCHY', 'GRID', 'FORCE_DIRECTED', 'CUSTOM'];

/** Seven vertices: a small tree plus one cross edge, so force layout has a cycle to resolve. */
export const SAMPLE = {
  labels: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  edges: [
    [0, 1],
    [0, 2],
    [1, 3],
    [1, 4],
    [2, 5],
    [2, 6],
    [4, 5],
  ] as [number, number][],
};

export function lineLayout(n: number, axis: 'horizontal' | 'vertical' = 'horizontal'): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : -0.9 + (1.8 * i) / (n - 1);
    return axis === 'horizontal' ? [t, 0] : [0, t];
  });
}

export function circularLayout(n: number, startAngleDeg = -90, radius = 0.82): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = ((startAngleDeg + (360 * i) / n) * Math.PI) / 180;
    return [Math.cos(a) * radius, Math.sin(a) * radius];
  });
}

/** Depth-leveled tree from root 0 using BFS over the sample's tree edges (cross edges ignored). */
export function hierarchyLayout(n: number, edges: [number, number][]): Pt[] {
  const children: number[][] = Array.from({ length: n }, () => []);
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length) {
    const u = queue.shift() as number;
    for (const [a, b] of edges) {
      const v = a === u ? b : b === u ? a : -1;
      if (v >= 0 && !seen.has(v)) {
        seen.add(v);
        children[u].push(v);
        queue.push(v);
      }
    }
  }
  // Leaves get consecutive slots; parents centre over their children.
  const pos: Pt[] = Array.from({ length: n }, () => [0, 0]);
  let slot = 0;
  const leaves = (() => {
    let c = 0;
    const count = (u: number): void => {
      if (!children[u].length) c++;
      children[u].forEach(count);
    };
    count(0);
    return c;
  })();
  let maxDepth = 0;
  const place = (u: number, depth: number): number => {
    maxDepth = Math.max(maxDepth, depth);
    let x: number;
    if (!children[u].length) {
      x = leaves === 1 ? 0 : -0.9 + (1.8 * slot++) / (leaves - 1);
    } else {
      const xs = children[u].map((c) => place(c, depth + 1));
      x = (Math.min(...xs) + Math.max(...xs)) / 2;
    }
    pos[u] = [x, depth];
    return x;
  };
  place(0, 0);
  return pos.map(([x, d]) => [x, maxDepth === 0 ? 0 : -0.8 + (1.6 * d) / maxDepth]);
}

export function gridLayout(n: number, columns = 3): Pt[] {
  const rows = Math.ceil(n / columns);
  return Array.from({ length: n }, (_, i) => {
    const c = i % columns;
    const r = Math.floor(i / columns);
    const x = columns === 1 ? 0 : -0.75 + (1.5 * c) / (columns - 1);
    const y = rows === 1 ? 0 : -0.7 + (1.4 * r) / (rows - 1);
    return [x, y];
  });
}

/** Deterministic spring-electrical simulation (Fruchterman–Reingold), seeded from the ring. */
export function forceLayout(n: number, edges: [number, number][], iterations = 240): Pt[] {
  const p = circularLayout(n, -90, 0.5).map(([x, y], i) => [x + (i % 2 ? 0.07 : -0.05), y + (i % 3 ? 0.04 : -0.06)] as Pt);
  const k = 0.62;
  let temp = 0.18;
  for (let it = 0; it < iterations; it++) {
    const d: Pt[] = p.map(() => [0, 0]);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const dx = p[i][0] - p[j][0];
        const dy = p[i][1] - p[j][1];
        const dist = Math.max(0.01, Math.hypot(dx, dy));
        const rep = (k * k) / dist;
        d[i][0] += (dx / dist) * rep;
        d[i][1] += (dy / dist) * rep;
      }
    }
    for (const [a, b] of edges) {
      const dx = p[a][0] - p[b][0];
      const dy = p[a][1] - p[b][1];
      const dist = Math.max(0.01, Math.hypot(dx, dy));
      const att = (dist * dist) / k;
      d[a][0] -= (dx / dist) * att;
      d[a][1] -= (dy / dist) * att;
      d[b][0] += (dx / dist) * att;
      d[b][1] += (dy / dist) * att;
    }
    for (let i = 0; i < n; i++) {
      const len = Math.max(0.0001, Math.hypot(d[i][0], d[i][1]));
      p[i][0] += (d[i][0] / len) * Math.min(len, temp);
      p[i][1] += (d[i][1] / len) * Math.min(len, temp);
    }
    temp *= 0.985;
  }
  return fit(p);
}

/** Hand-placed points: CUSTOM disables automatic placement, so here the vertices trace the AQVL mark. */
export function customLayout(n: number): Pt[] {
  const pts: Pt[] = [];
  const arcCount = Math.max(1, n - 2);
  for (let i = 0; i < arcCount; i++) {
    const a = ((50 + (-(360 - 40) * i) / Math.max(1, arcCount - 1)) * Math.PI) / 180;
    pts.push([-0.16 + Math.cos(a) * 0.62, -0.12 + Math.sin(a) * 0.62]);
  }
  pts.push([0.42, 0.5], [0.9, 0.5]);
  return pts.slice(0, n);
}

function fit(p: Pt[], pad = 0.88): Pt[] {
  const xs = p.map((q) => q[0]);
  const ys = p.map((q) => q[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 || 1;
  return p.map(([x, y]) => [((x - cx) / span) * pad, ((y - cy) / span) * pad]);
}

export function layoutFor(s: Strategy, n = SAMPLE.labels.length, edges = SAMPLE.edges): Pt[] {
  switch (s) {
    case 'LINE':
      return lineLayout(n);
    case 'CIRCULAR':
      return circularLayout(n);
    case 'HIERARCHY':
      return hierarchyLayout(n, edges);
    case 'GRID':
      return gridLayout(n, 3);
    case 'FORCE_DIRECTED':
      return forceLayout(n, edges);
    case 'CUSTOM':
      return customLayout(n);
  }
}

/** The statement a program would use, with arguments taken from the docs. */
export const STATEMENT: Record<Strategy, string> = {
  LINE: 'LAYOUT g AS LINE(spacing=1.5, axis=horizontal)',
  CIRCULAR: 'LAYOUT g AS CIRCULAR(radius=3, startAngle=0)',
  HIERARCHY: 'LAYOUT g AS HIERARCHY(levelGap=2, siblingGap=1)',
  GRID: 'LAYOUT g AS GRID(columns=3, spacingX=1.5, spacingY=1.5)',
  FORCE_DIRECTED: 'LAYOUT g AS FORCE_DIRECTED(repulsion=50, iterations=100)',
  CUSTOM: 'LAYOUT g AS CUSTOM()',
};
