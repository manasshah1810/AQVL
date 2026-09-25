import type { AQVLError } from './index';

/**
 * Levenshtein edit distance, used to power "Did you mean ...?" suggestions
 * against a list of known names (declared variables/functions).
 */
function editDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

/**
 * Finds the closest match to `name` among `candidates`, for a "Did you mean"
 * suggestion. Returns undefined if nothing is close enough to be useful.
 */
export function findClosestMatch(name: string, candidates: Iterable<string>): string | undefined {
  let best: string | undefined;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    if (candidate === name) continue;
    const distance = editDistance(name, candidate);
    // Only suggest names close enough to plausibly be a typo, scaled to length
    // so short identifiers don't match wildly different short identifiers.
    const threshold = Math.max(1, Math.floor(Math.max(name.length, candidate.length) / 3));
    if (distance <= threshold && distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/** Builds a "Did you mean ...?" suggestion string, or undefined if no close match exists. */
export function suggestFor(name: string, candidates: Iterable<string>): string | undefined {
  const match = findClosestMatch(name, candidates);
  return match ? `Did you mean "${match}"?` : undefined;
}

/**
 * Renders an AQVLError as a multi-line human-readable report:
 *
 * [ERROR] UndeclaredVariableError at line 15, col 5
 * myFunc() ← unknown function
 *     ^
 * Undeclared variable "myFunc".
 * Suggestion: Did you mean "myFunction"?
 */
export function formatError(error: AQVLError): string {
  const lines: string[] = [];

  const location = error.lineNumber !== undefined
    ? ` at line ${error.lineNumber}${error.column !== undefined ? `, col ${error.column}` : ''}`
    : '';
  lines.push(`[ERROR] ${error.name}${location}`);

  if (error.source !== undefined && error.lineNumber !== undefined) {
    const sourceLine = error.source.split('\n')[error.lineNumber - 1];
    if (sourceLine !== undefined) {
      lines.push(sourceLine);
      if (error.column !== undefined) {
        lines.push(`${' '.repeat(Math.max(0, error.column - 1))}^`);
      }
    }
  }

  lines.push(error.message);

  if (error.suggestion) {
    lines.push(`Suggestion: ${error.suggestion}`);
  }

  return lines.join('\n');
}

/** Formats a batch of errors (e.g. every diagnostic from one validation pass), separated by blank lines. */
export function formatErrors(errors: AQVLError[]): string {
  return errors.map(formatError).join('\n\n');
}
