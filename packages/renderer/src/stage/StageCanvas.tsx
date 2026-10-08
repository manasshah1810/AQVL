/// <reference path="./three/troika-three-text.d.ts" />
import React, { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { NeutralToneMapping, SRGBColorSpace } from 'three';
import { preloadFont } from 'troika-three-text';
import type { ExecutionTrace } from '@aqvl/runtime';
import { StageModel } from './model/StageModel';
import { ENVELOPE_SECONDS } from './model/sampler';
import type { Playhead } from './timeline/Playhead';
import type { StageTheme } from './look/palette';
import type { StageWorld } from './worlds/types';
import { STAGE_FOV, StageScene } from './three/StageScene';
import type { StageFonts } from './three/LabelLayer';
import { QUALITY, lowerTier, type QualityTier } from './three/quality';
import { higherTier } from './three/perf';

export type StageStatus =
  | { kind: 'ready' }
  | { kind: 'context-lost' }
  | { kind: 'no-webgl'; message: string }
  | { kind: 'font-error'; message: string };

export interface StageCanvasProps {
  trace: ExecutionTrace;
  playhead: Playhead;
  /** The program's source (for loop cursors and index names). */
  source?: string;
  theme: StageTheme;
  /** Where the structures stand: the plain studio, or a world with a crew (penguins, pandas). */
  world?: StageWorld;
  /** Reduced motion: no arcs, ripples or travelling dots. */
  calm: boolean;
  /** Camera follows the action (off while the viewer orbits by hand). */
  follow: boolean;
  onFollowChange: (follow: boolean) => void;
  tier: QualityTier;
  onTierChange: (tier: QualityTier) => void;
  fonts: StageFonts;
  onStatus?: (status: StageStatus) => void;
  /** Pixels of the canvas covered by UI along the top and right; the picture is centred in the rest. */
  insets?: { top: number; right: number };
}

interface Shown {
  model: StageModel;
  playhead: Playhead;
  phase: 'in' | 'steady' | 'out';
}

class WebGLBoundary extends Component<{ onError: (message: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error instanceof Error ? error.message : String(error));
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Loads the scene's typefaces before any text is drawn, and says so if one fails (no silent fallback). */
function useFontsReady(fonts: StageFonts): { ready: boolean; error: string | null } {
  const [state, setState] = useState<{ key: string; ready: boolean; error: string | null }>({ key: '', ready: false, error: null });
  const key = `${fonts.mono}|${fonts.monoStrong}|${fonts.monoItalic}`;
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      [fonts.mono, fonts.monoStrong, fonts.monoItalic].map(
        (url) =>
          fetch(url).then((r) => {
            if (!r.ok) throw new Error(`${url} answered ${r.status}`);
            return new Promise<void>((resolve) => preloadFont({ font: url, characters: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ[]()=<>.,:-_▾▴…·∞' }, resolve));
          }),
      ),
    ).then(
      () => !cancelled && setState({ key, ready: true, error: null }),
      (e: unknown) => !cancelled && setState({ key, ready: false, error: `Scene font failed to load: ${e instanceof Error ? e.message : String(e)}` }),
    );
    return () => {
      cancelled = true;
    };
  }, [key, fonts.mono, fonts.monoStrong, fonts.monoItalic]);
  return state.key === key ? { ready: state.ready, error: state.error } : { ready: false, error: null };
}

/**
 * The 3D stage. Draws `trace` at `playhead`'s time, in the site's palette
 * for `theme`. A new trace makes the old scene leave (staggered, to a clean
 * floor) before the new one builds in. Handles WebGL context loss by
 * rebuilding the canvas, and drops quality tiers when frames run long.
 */
export function StageCanvas(props: StageCanvasProps) {
  const { trace, playhead, source, theme, world = 'studio', calm, follow, onFollowChange, tier, onTierChange, fonts, onStatus } = props;
  const insets = useMemo(() => props.insets ?? { top: 0, right: 0 }, [props.insets]);
  const model = useMemo(() => new StageModel(trace, theme, source, world), [trace, theme, source, world]);
  const [shown, setShown] = useState<Shown>(() => ({ model, playhead, phase: 'in' }));
  const [canvasKey, setCanvasKey] = useState(0);
  const [lost, setLost] = useState(false);
  const [noWebgl, setNoWebgl] = useState<string | null>(null);
  const fontState = useFontsReady(fonts);
  const statusRef = useRef(onStatus);
  statusRef.current = onStatus;

  // Program change: old scene exits, then the new one enters. Theme change: swap in place.
  useEffect(() => {
    if (shown.model === model && shown.playhead === playhead) return undefined;
    const sameRun = shown.model.trace === model.trace && shown.playhead === playhead;
    if (sameRun || calm) {
      setShown({ model, playhead, phase: sameRun ? shown.phase : 'in' });
      return undefined;
    }
    setShown((s) => ({ ...s, phase: 'out' }));
    const t = window.setTimeout(() => setShown({ model, playhead, phase: 'in' }), 520);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, playhead]);

  useEffect(() => {
    if (shown.phase !== 'in') return undefined;
    const t = window.setTimeout(() => setShown((s) => (s.phase === 'in' ? { ...s, phase: 'steady' } : s)), ENVELOPE_SECONDS * 1000 + 120);
    return () => window.clearTimeout(t);
  }, [shown]);

  useEffect(() => {
    if (noWebgl) statusRef.current?.({ kind: 'no-webgl', message: noWebgl });
    else if (lost) statusRef.current?.({ kind: 'context-lost' });
    else if (fontState.error) statusRef.current?.({ kind: 'font-error', message: fontState.error });
    else statusRef.current?.({ kind: 'ready' });
  }, [lost, noWebgl, fontState.error]);

  const onSlowFrames = useCallback(() => {
    if (tier !== 'low') onTierChange(lowerTier(tier));
  }, [tier, onTierChange]);

  const onHeadroom = useCallback(() => {
    if (tier !== 'high') onTierChange(higherTier(tier));
  }, [tier, onTierChange]);

  const quality = QUALITY[tier];
  const background = model.palette.background;

  return (
    <div style={{ position: 'absolute', inset: 0, background }} data-stage-theme={theme} data-stage-world={world}>
      <WebGLBoundary onError={setNoWebgl}>
        {fontState.ready && !noWebgl && (
          <Canvas
            key={canvasKey}
            frameloop="demand"
            dpr={quality.dpr}
            camera={{ position: [0, 4, 14], fov: STAGE_FOV }}
            gl={{ antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false }}
            onCreated={({ gl }) => {
              gl.toneMapping = NeutralToneMapping;
              gl.outputColorSpace = SRGBColorSpace;
              // Off-screen passes (contact shadows) must start transparent; the picture itself always paints its background.
              gl.setClearAlpha(0);
              // A fresh renderer exists: whatever was lost has been rebuilt.
              setLost(false);
              const canvas = gl.domElement;
              let rebuild = 0;
              canvas.addEventListener('webglcontextlost', (e) => {
                e.preventDefault();
                setLost(true);
                // Don't wait on the browser to hand the context back: rebuild on a new one.
                rebuild = window.setTimeout(() => setCanvasKey((k) => k + 1), 900);
              });
              canvas.addEventListener('webglcontextrestored', () => {
                window.clearTimeout(rebuild);
                setCanvasKey((k) => k + 1);
              });
            }}
            style={{ position: 'absolute', inset: 0 }}
            aria-label="3D visualisation of the running program"
            role="img"
          >
            <StageScene
              model={shown.model}
              playhead={shown.playhead}
              tier={tier}
              calm={calm}
              follow={follow}
              fonts={fonts}
              phase={shown.phase}
              onFollowChange={onFollowChange}
              onSlowFrames={onSlowFrames}
              onHeadroom={onHeadroom}
              insets={insets}
            />
          </Canvas>
        )}
      </WebGLBoundary>
    </div>
  );
}
