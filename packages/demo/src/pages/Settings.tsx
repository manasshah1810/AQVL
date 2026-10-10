import React, { useState } from 'react';
import { motion } from 'motion/react';
import { type QualityTier } from '@aqvl/renderer';
import { setWorld, useWorld, type World } from '../lib/world';
import { setTheme, useTheme } from '../lib/theme';
import { DEFAULT_SETTINGS, resetSettings, updateSettings, useSettings } from '../lib/settings';
import { spring } from '../lib/motion';
import { WorldPortal } from '../components/portal/WorldPortal';
import { DOME_WORLDS, PORTAL, worldToIndex } from '../components/portal/portalWorlds';
import { Segmented, Toggle } from '../components/theme/Controls';
import './settings.css';

const QUALITY_OPTIONS: { value: 'auto' | QualityTier; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto', hint: 'The tier the device suggests; drops by itself when frames run long' },
  { value: 'high', label: 'High', hint: 'Sharpest picture, softest shadows' },
  { value: 'medium', label: 'Balanced', hint: 'A good middle for most laptops' },
  { value: 'low', label: 'Light', hint: 'Fewest effects; best on slow devices' },
];

/**
 * Settings: the world the whole site (and its 3D stage) lives in, the
 * light / dark mode, and how the stage is drawn. Everything applies the
 * moment it is chosen and is kept in this browser.
 */
export default function Settings() {
  const world = useWorld();
  const theme = useTheme();
  const settings = useSettings();

  const [preview, setPreview] = useState(() => worldToIndex(world));
  const target = DOME_WORLDS[preview];
  const lives = target === world;

  const moveIn = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (lives) return;
    const r = e.currentTarget.getBoundingClientRect();
    setWorld(target as World, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
  };

  return (
    <div className="page flex-1 py-10 md:py-16">
      <motion.header className="mb-8 max-w-[46rem]" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0, transition: spring.gentle }}>
        <p className="margin-num mb-3">Settings</p>
        <h1 className="headline">
          Choose where AQVL <span className="italic text-cream">lives.</span>
        </h1>
        <p className="lede mt-4">Drag the globe, or use the arrows, to visit each world. When you find the one you love, move in: the whole site follows.</p>
      </motion.header>

      <motion.div initial={{ opacity: 0, scale: 0.97, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0, transition: { ...spring.gentle, delay: 0.1 } }}>
        <WorldPortal
          index={preview}
          onIndex={setPreview}
          footer={
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button type="button" className="ws-cta" aria-disabled={lives} onClick={moveIn}>
                {lives ? <>✓ You live in {PORTAL[target].name}</> : <>Move in to {PORTAL[target].name} <span aria-hidden="true">→</span></>}
              </button>
            </div>
          }
        />
      </motion.div>

      {/* ── Appearance ────────────────────────────────────────── */}
      <section className="set-section glass" aria-labelledby="set-look">
        <div className="set-head">
          <h2 id="set-look" className="title">
            Appearance
          </h2>
        </div>
        <div className="set-rows">
          <div className="set-row">
            <div className="set-row__text">
              <span className="set-row__label">Light or dark</span>
              <span className="set-row__hint">Applies to the pages and the editor. The 3D ice shelf is always at night and the 3D grove always at dawn.</span>
            </div>
            <Segmented
              label="Light or dark"
              value={theme}
              options={[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
              ]}
              onChange={(v) => setTheme(v)}
            />
          </div>
          <div className="set-row">
            {world === 'panda' ? (
              <Toggle label="Falling leaves" hint="Bamboo leaves drifting behind the pages (bamboo world)." checked={settings.snow} onChange={(v) => updateSettings({ snow: v })} />
            ) : (
              <Toggle label="Snowfall" hint="Snow drifting behind the pages (ice world)." checked={settings.snow} onChange={(v) => updateSettings({ snow: v })} />
            )}
          </div>
          <div className="set-row">
            {world === 'panda' ? (
              <Toggle label="Panda mascots" hint="A panda on the odd page and wandering along the footer (bamboo world)." checked={settings.mascots} onChange={(v) => updateSettings({ mascots: v })} />
            ) : (
              <Toggle label="Penguin mascots" hint="A penguin on the odd page and walking along the footer (ice world)." checked={settings.mascots} onChange={(v) => updateSettings({ mascots: v })} />
            )}
          </div>
        </div>
      </section>

      {/* ── Visualization ─────────────────────────────────────── */}
      <section className="set-section glass" aria-labelledby="set-viz">
        <div className="set-head">
          <h2 id="set-viz" className="title">
            Visualization
          </h2>
          <p className="muted">How the 3D stage is drawn. The Playground has the same switches in its Stage panel.</p>
        </div>
        <div className="set-rows">
          <div className="set-row">
            <div className="set-row__text">
              <span className="set-row__label">Graphics quality</span>
              <span className="set-row__hint">Auto picks for your device and lowers itself if frames run long.</span>
            </div>
            <Segmented label="Graphics quality" value={settings.quality} options={QUALITY_OPTIONS} onChange={(v) => updateSettings({ quality: v })} />
          </div>
          <div className="set-row">
            <div className="set-row__text">
              <span className="set-row__label">Calm motion</span>
              <span className="set-row__hint">No arcs, ripples, slides or waddles: only what the algorithm does. Auto follows your system’s reduce-motion setting.</span>
            </div>
            <Segmented
              label="Calm motion"
              value={settings.calm}
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'on', label: 'On' },
                { value: 'off', label: 'Off' },
              ]}
              onChange={(v) => updateSettings({ calm: v })}
            />
          </div>
          <div className="set-row">
            <Toggle label="Camera follows the action" hint="Frames what each step is about. Dragging the scene turns it off until you press Recenter." checked={settings.follow} onChange={(v) => updateSettings({ follow: v })} />
          </div>
        </div>
      </section>

      <div className="mt-12 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn--quiet btn--sm" onClick={() => resetSettings()}>
          Reset settings
        </button>
        <a className="btn btn--sm" href="#/playground">
          Open the Playground <span className="arrow" aria-hidden="true">→</span>
        </a>
        <span className="mono muted">
          {settings.quality === DEFAULT_SETTINGS.quality && settings.calm === DEFAULT_SETTINGS.calm ? 'Defaults in use' : 'Customised'}
        </span>
      </div>
    </div>
  );
}
