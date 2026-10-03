/**
 * Regression guard for the generic layer: packages/shared/src and
 * packages/runtime/src/models must stay domain-neutral. DSA-specific
 * identifiers (partition boundaries, sorted regions, heap/trie/tree-variant
 * names, ...) belong in a domain-owned module and reach the generic shapes only
 * through the `SceneState.metadata` bag.
 *
 * Usage: pnpm audit:generic   (exits 1 on any violation; runs in CI)
 *
 * To permit a hit, add a path to ALLOWED_PATHS (a whole domain-owned file) or an
 * exact `file:line-text` match to ALLOWED_LINES, each with a reason.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(__dirname, '..');

const SCAN_DIRS = ['packages/shared/src', 'packages/runtime/src/models'];

/** Case-insensitive; separators between words are optional (sortedRegion / SORTED_REGION / sorted-region). */
const FORBIDDEN: { label: string; pattern: RegExp }[] = [
  { label: 'sortedRegion', pattern: /sorted[-_ ]?region/i },
  { label: 'partitionBoundary', pattern: /partition[-_ ]?boundar/i },
  { label: 'heap-', pattern: /\bheap[-_A-Z]|\bheap\b/i },
  { label: 'trie-', pattern: /\btrie\b|\btrie[-_A-Z]/i },
  { label: 'avl / red-black', pattern: /\bavl\b|red[-_ ]?black/i },
  { label: 'union-find', pattern: /union[-_ ]?find/i },
  { label: 'linked-list', pattern: /linked[-_ ]?list/i },
  { label: 'hash-map', pattern: /hash[-_ ]?map/i },
];

/** Whole files that are explicitly domain-owned, relative to the repo root with forward slashes. */
const ALLOWED_PATHS: Record<string, string> = {
  'packages/shared/src/domains/array/regionInstructions.ts':
    'array-domain AQIR region instructions; domain-owned, re-exported from the package root',
};

/** Individual lines that may legitimately mention a forbidden word: `path` -> substrings of allowed lines. */
const ALLOWED_LINES: Record<string, { text: string; reason: string }[]> = {
  'packages/shared/src/index.ts': [
    { text: "export type * from './domains/array/regionInstructions'", reason: 'domain-owned re-export (path only)' },
  ],
};

const SOURCE_EXT = /\.(ts|tsx)$/;
const TEST_FILE = /\.test\.(ts|tsx)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SOURCE_EXT.test(name) && !TEST_FILE.test(name)) out.push(full);
  }
  return out;
}

export interface Violation {
  file: string;
  line: number;
  label: string;
  text: string;
}

export function audit(root: string = ROOT): Violation[] {
  const violations: Violation[] = [];
  for (const dir of SCAN_DIRS) {
    for (const full of walk(join(root, dir))) {
      const file = relative(root, full).split(sep).join('/');
      if (file in ALLOWED_PATHS) continue;
      const allowedLines = ALLOWED_LINES[file] ?? [];
      readFileSync(full, 'utf8')
        .split(/\r?\n/)
        .forEach((text, i) => {
          if (allowedLines.some((a) => text.includes(a.text))) return;
          for (const { label, pattern } of FORBIDDEN) {
            if (pattern.test(text)) violations.push({ file, line: i + 1, label, text: text.trim() });
          }
        });
    }
  }
  return violations;
}

if (require.main === module) {
  const violations = audit();
  if (violations.length === 0) {
    console.log(`audit-generic-layer: OK — no DSA-specific identifiers in ${SCAN_DIRS.join(', ')}`);
  } else {
    console.error(`audit-generic-layer: ${violations.length} DSA-specific identifier(s) in the generic layer:\n`);
    for (const v of violations) console.error(`  ${v.file}:${v.line}  [${v.label}]  ${v.text}`);
    console.error('\nMove the type into a domain-owned module (and carry its data in SceneState.metadata), or add a justified entry to the allowlist in scripts/audit-generic-layer.ts.');
    process.exit(1);
  }
}
