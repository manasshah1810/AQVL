export type QualityTier = 'high' | 'medium' | 'low';

export interface QualitySettings {
  dpr: [number, number];
  shadows: boolean;
  shadowMapSize: number;
  reflections: boolean;
  /** Bloom, vignette, dither. */
  post: boolean;
  depthOfField: boolean;
  multisampling: number;
  sphereSegments: number;
}

export const QUALITY: Record<QualityTier, QualitySettings> = {
  high: { dpr: [1, 2], shadows: true, shadowMapSize: 2048, reflections: true, post: true, depthOfField: true, multisampling: 2, sphereSegments: 40 },
  medium: { dpr: [1, 1.5], shadows: true, shadowMapSize: 1024, reflections: false, post: true, depthOfField: false, multisampling: 2, sphereSegments: 28 },
  low: { dpr: [1, 1], shadows: false, shadowMapSize: 512, reflections: false, post: false, depthOfField: false, multisampling: 0, sphereSegments: 18 },
};

export function lowerTier(tier: QualityTier): QualityTier {
  return tier === 'high' ? 'medium' : 'low';
}

/** Which GPU the browser reports (unmasked when allowed), or '' if it can't tell. */
function gpuName(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return '';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return '';
  }
}

/**
 * A starting guess before the frame-time probe has measured anything:
 * software rendering and phones start light, integrated GPUs balanced,
 * everything else high. The probe steps down from there if frames run long.
 */
export function initialTier(): QualityTier {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') return 'medium';
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  if (coarse) return 'low';
  const gpu = gpuName();
  if (/SwiftShader|llvmpipe|Software|Microsoft Basic/i.test(gpu)) return 'low';
  if (/Intel|UHD|Iris|Mali|Adreno|PowerVR|Vivante/i.test(gpu)) return 'medium';
  return (navigator.hardwareConcurrency ?? 4) >= 8 ? 'high' : 'medium';
}

/**
 * Frame-time probe: collects frame times while the scene is actually being
 * drawn and recommends stepping down a tier when the slowest tenth of frames
 * is over budget (60 fps with headroom).
 */
export class FrameProbe {
  private samples: number[] = [];
  private skipped = 0;
  constructor(private readonly budgetMs = 22, private readonly warmup = 30, private readonly window = 90) {}

  reset(): void {
    this.samples = [];
    this.skipped = 0;
  }

  /** Feed one frame's duration; returns true once when the tier should drop. */
  add(ms: number): boolean {
    if (this.skipped < this.warmup) {
      this.skipped++;
      return false;
    }
    if (ms > 250) return false; // a stall (tab switch, GC), not a steady cost
    this.samples.push(ms);
    if (this.samples.length < this.window) return false;
    // The slow tail is what reads as stutter: judge by the 90th percentile.
    const sorted = [...this.samples].sort((a, b) => a - b);
    const p90 = sorted[Math.floor(sorted.length * 0.9)];
    this.samples = [];
    return p90 > this.budgetMs;
  }
}
