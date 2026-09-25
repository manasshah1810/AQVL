/**
 * Value-display formatting for array elements: number/string formatting plus
 * density-aware label sizing so labels stay legible from small (~5 element)
 * to large (~100 element) arrays, per array-visual-language-spec.md §2.
 */

const DEFAULT_MAX_CHARS = 8;

/** Formats a single array element's value for display on the floating value label. */
export function formatArrayValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return formatNumericValue(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return truncateStringValue(String(value));
}

/**
 * Formats a number for display, keeping very large/very small magnitudes and
 * long floating-point tails from overflowing the element's face.
 */
export function formatNumericValue(value: number, maxChars: number = DEFAULT_MAX_CHARS): string {
  if (Number.isNaN(value)) return 'NaN';
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '-∞';
  if (Object.is(value, -0)) return '0';

  const abs = Math.abs(value);
  if (abs !== 0 && (abs >= 1_000_000 || abs < 0.0001)) {
    return value.toExponential(2);
  }

  // Round away long floating point tails, then fall back to fewer significant
  // digits if the plain representation is still too wide for the element face.
  const rounded = Math.round(value * 10000) / 10000;
  let str = String(rounded);
  if (str.length > maxChars) {
    str = rounded.toPrecision(4);
    if (str.length > maxChars) {
      str = value.toExponential(2);
    }
  }
  return str;
}

/** Truncates a string value with an ellipsis so it never overruns the element face. */
export function truncateStringValue(value: string, maxChars: number = DEFAULT_MAX_CHARS): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars - 1)}…`;
}

export interface ValueLabelDensityConfig {
  /** Text font size to use for the value/index label at this array size. */
  fontSize: number;
  /** Whether the label should render at all at this array size. */
  visible: boolean;
}

const BASE_VALUE_FONT_SIZE = 0.4;
const BASE_INDEX_FONT_SIZE = 0.25;
const MIN_FONT_SIZE = 0.12;
/** Elements start shrinking their labels once the array grows past this size. */
const SHRINK_START_COUNT = 16;
/** Beyond this many elements, labels overlap too much and are hidden by default. */
const HIDE_THRESHOLD_COUNT = 40;

function scaledDensityConfig(baseFontSize: number, arrayLength: number, forceShow: boolean): ValueLabelDensityConfig {
  const n = Math.max(0, arrayLength);

  let fontSize = baseFontSize;
  if (n > SHRINK_START_COUNT) {
    const t = Math.min(1, (n - SHRINK_START_COUNT) / (HIDE_THRESHOLD_COUNT - SHRINK_START_COUNT));
    fontSize = baseFontSize - (baseFontSize - MIN_FONT_SIZE) * t;
  }

  const visible = forceShow || n <= HIDE_THRESHOLD_COUNT;

  return { fontSize: Math.max(MIN_FONT_SIZE, fontSize), visible };
}

/**
 * Density config for the primary value label. Shrinks smoothly past
 * SHRINK_START_COUNT elements and hides (with a toggle to force it back on)
 * past HIDE_THRESHOLD_COUNT, where labels would otherwise overlap.
 */
export function getValueLabelDensityConfig(arrayLength: number, forceShow = false): ValueLabelDensityConfig {
  return scaledDensityConfig(BASE_VALUE_FONT_SIZE, arrayLength, forceShow);
}

/** Density config for the secondary `arr[i]` index label, scaled to match the value label. */
export function getIndexLabelDensityConfig(arrayLength: number, forceShow = false): ValueLabelDensityConfig {
  return scaledDensityConfig(BASE_INDEX_FONT_SIZE, arrayLength, forceShow);
}
