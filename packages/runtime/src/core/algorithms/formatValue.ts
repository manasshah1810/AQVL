/** Formats a PRINT argument for the output console. */
export function formatPrintValue(value: unknown): string {
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value === null || value === undefined) return 'null';
  return String(value);
}
