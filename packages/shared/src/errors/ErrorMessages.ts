/**
 * `generateErrorMessage` is the same rendering `formatError` (./formatter)
 * already provides — kind, line:col, a source snippet with a `^` caret, and
 * a suggestion when one is available. It's exported under this name too so
 * call sites can ask for "the error message" without needing to know the
 * formatter module's name.
 */
import type { AQVLError } from './index';
import { formatError } from './formatter';

export function generateErrorMessage(error: AQVLError): string {
  return formatError(error);
}
