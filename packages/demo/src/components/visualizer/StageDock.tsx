import React, { forwardRef, useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { WORLDS, WORLD_IDS, type QualityTier, type StageTheme } from '@aqvl/renderer';
import type { TraceFrame } from '@aqvl/runtime';
import { spring } from '../../lib/motion';
import { setWorld, type World } from '../../lib/world';
import { updateSettings, type DockTab, type Settings } from '../../lib/settings';
import { WorldArt } from '../theme/WorldArt';
import { Segmented, Toggle } from '../theme/Controls';
import { WatchPanel } from './WatchPanel';
import { Legend } from './Legend';

const TABS: { id: DockTab; label: string; key: string }[] = [
  { id: 'watch', label: 'Variables', key: 'V' },
  { id: 'key', label: 'Key', key: 'K' },
  { id: 'output', label: 'Output', key: 'O' },
  { id: 'stage', label: 'Stage', key: 'S' },
];

const QUALITY: { value: Settings['quality']; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto', hint: 'The device’s tier; drops by itself when frames run long' },
  { value: 'high', label: 'High', hint: 'Sharpest picture' },
  { value: 'medium', label: 'Balanced', hint: 'A good middle' },
  { value: 'low', label: 'Light', hint: 'Fewest effects' },
];

export interface StageDockProps {
  id: string;
  tab: DockTab;
  onTab: (t: DockTab) => void;
  onClose: () => void;
  theme: StageTheme;
  world: World;
  calm: boolean;
  onCalm: () => void;
  follow: boolean;
  onFollow: (v: boolean) => void;
  /** The tier in use, and what the viewer chose ('auto' lets the stage pick). */
  tier: QualityTier;
  quality: Settings['quality'];
  frame: TraceFrame;
  previous: TraceFrame | undefined;
  /** The run's printed output (the Playground supplies it). */
  output?: ReactNode;
  outputCount: number;
  /** The stage is pinned to one world (challenges use the plain studio): no world picker. */
  worldLocked?: boolean;
}

/**
 * Everything secondary, in one place beside the stage: variables and the
 * call stack, the colour key, the run's output, and the stage settings
 * (world, motion, camera, graphics). It slides in when asked for, never
 * draws over the scene on a wide screen, and remembers which tab was open.
 */
export const StageDock = forwardRef<HTMLElement, StageDockProps>(function StageDock(props, ref) {
  const { id, tab, onTab, onClose, theme, world, output, outputCount } = props;
  const tabs = TABS.filter((t) => t.id !== 'output' || output);
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === tab);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      onTab(next.id);
      requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-tab="${next.id}"]`)?.focus());
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <motion.aside
      ref={ref}
      id={id}
      className="vz-dock"
      aria-label="Stage panels"
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0, transition: spring.gentle }}
      exit={{ opacity: 0, x: 28, transition: { duration: 0.14 } }}
    >
      <div className="vz-dock__head">
        <div className="vz-dock__tabs" role="tablist" aria-label="Panels" ref={listRef} onKeyDown={onKeyDown}>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`${id}-tab-${t.id}`}
              data-tab={t.id}
              aria-selected={tab === t.id}
              aria-controls={`${id}-panel`}
              tabIndex={tab === t.id ? 0 : -1}
              className={`vz-dock__tab${tab === t.id ? ' is-on' : ''}`}
              onClick={() => onTab(t.id)}
              title={`${t.label} (${t.key})`}
            >
              {tab === t.id && <motion.span layoutId={`dock-tab-${id}`} className="vz-dock__tabbg" transition={spring.layout} />}
              <span className="relative">
                {t.label}
                {t.id === 'output' && outputCount > 0 && <span className="vz-dock__count">{outputCount}</span>}
              </span>
            </button>
          ))}
        </div>
        <button type="button" className="vz-dock__close" onClick={onClose} aria-label="Close panel" title="Close panel (Esc)">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M3 3l8 8M11 3l-8 8" />
          </svg>
        </button>
      </div>

      <div className="vz-dock__body" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${tab}`}>
        {tab === 'watch' && <Variables frame={props.frame} previous={props.previous} />}
        {tab === 'key' && <Legend theme={theme} id={`${id}-legend`} world={world} />}
        {tab === 'output' && output}
        {tab === 'stage' && <StageSettings {...props} />}
      </div>
    </motion.aside>
  );
});

function Variables({ frame, previous }: { frame: TraceFrame; previous: TraceFrame | undefined }) {
  const empty = Object.keys(frame.vars).length === 0 && frame.callStack.length === 0;
  if (empty) return <p className="vz-dock__empty">This program has no variables or calls to show at this step.</p>;
  return <WatchPanel frame={frame} previous={previous} />;
}

function StageSettings({ world, calm, onCalm, follow, onFollow, quality, tier, worldLocked = false }: StageDockProps) {
  const pick = (w: World, e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setWorld(w, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
  };
  return (
    <div className="vz-set">
      {worldLocked ? (
        <section aria-labelledby="vzs-world">
          <h3 id="vzs-world" className="vz-dock__title">
            World
          </h3>
          <p className="vz-set__blurb">This stage always uses the plain {WORLDS[world].label} world, so the focus stays on the data.</p>
        </section>
      ) : (
        <section aria-labelledby="vzs-world">
          <h3 id="vzs-world" className="vz-dock__title">
            World
          </h3>
          <div className="vz-set__worlds" role="radiogroup" aria-label="World">
            {WORLD_IDS.map((w) => (
              <button key={w} type="button" role="radio" aria-checked={w === world} className="vz-set__world" onClick={(e) => pick(w, e)} title={WORLDS[w].blurb}>
                <WorldArt world={w} />
                <span>{WORLDS[w].label}</span>
              </button>
            ))}
          </div>
          <p className="vz-set__blurb">{WORLDS[world].blurb}</p>
        </section>
      )}

      <section aria-labelledby="vzs-motion">
        <h3 id="vzs-motion" className="vz-dock__title">
          Motion and camera
        </h3>
        <div className="vz-set__rows">
          <Toggle label="Calm motion" hint="No arcs, ripples, slides or waddles (C)" checked={calm} onChange={() => onCalm()} />
          <Toggle label="Camera follows the action" hint="Drag the scene to take it yourself; F to follow again" checked={follow} onChange={onFollow} />
        </div>
      </section>

      <details className="vz-set__advanced">
        <summary>Advanced</summary>
        <div className="vz-set__rows">
          <div>
            <p className="tog__label">Graphics quality</p>
            <p className="tog__hint mb-2">
              {quality === 'auto' ? `Auto (now ${tier === 'medium' ? 'balanced' : tier === 'low' ? 'light' : 'high'}); drops itself when frames run long.` : 'Fixed; it will not change by itself.'}
            </p>
            <Segmented label="Graphics quality" value={quality} options={QUALITY} onChange={(v) => updateSettings({ quality: v })} />
          </div>
        </div>
      </details>

      <p className="vz-set__more">
        <a className="ulink" href="#/settings">
          All settings
        </a>
      </p>
    </div>
  );
}
