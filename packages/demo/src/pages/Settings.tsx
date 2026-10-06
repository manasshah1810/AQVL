import React from 'react';
import { motion } from 'motion/react';
import { WORLDS, WORLD_IDS, type QualityTier } from '@aqvl/renderer';
import { setWorld, useWorld, type World } from '../lib/world';
import { setTheme, useTheme } from '../lib/theme';
import { DEFAULT_SETTINGS, resetSettings, updateSettings, useSettings } from '../lib/settings';
import { spring } from '../lib/motion';
import { WorldArt } from '../components/theme/WorldArt';
import { Mascot } from '../components/theme/WorldDecor';
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

  const pick = (w: World, e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setWorld(w, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
  };

  return (
    <div className="page flex-1 py-10 md:py-16">
      <header className="mb-12 grid items-end gap-6 md:grid-cols-12">
        <div className="md:col-span-8">
          <p className="margin-num mb-3">Settings</p>
          <h1 className="headline">
            Pick a <span className="italic text-cream">world</span> to work in.
          </h1>
          <p className="lede mt-5">The 3D stage takes the world you choose, and the whole site follows it. Changes apply at once and stay in this browser.</p>
        </div>
        <Mascot pose="wave" size={110} className="justify-self-end max-md:hidden md:col-span-4" />
      </header>

      {/* ── World ─────────────────────────────────────────────── */}
      <section className="set-section" aria-labelledby="set-world">
        <div className="set-head">
          <h2 id="set-world" className="title">
            World
          </h2>
          <p className="muted">Three places for the same algorithms. The state colours never change between them. Your choice carries across the whole site.</p>
        </div>
        <div className="set-grid" role="radiogroup" aria-label="World">
          {WORLD_IDS.map((w, i) => {
            const info = WORLDS[w];
            const on = w === world;
            return (
              <motion.button
                key={w}
                type="button"
                role="radio"
                aria-checked={on}
                className="world-card"
                onClick={(e) => pick(w, e)}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0, transition: { ...spring.gentle, delay: 0.05 * i } }}
              >
                <WorldArt world={w} />
                <span className="world-card__body">
                  <span className="flex items-center gap-2">
                    <span className="title !text-[1.25rem]">{info.label}</span>
                    {w === 'penguin' && <span className="badge">Primary</span>}
                    {w === 'panda' && <span className="badge">Full theme</span>}
                    {on && <span className="mono muted">· on</span>}
                  </span>
                  <span className="text-[0.98rem] leading-snug muted">{info.blurb}</span>
                </span>
              </motion.button>
            );
          })}
        </div>
        {world === 'penguin' && (
          <p className="set-note">
            <Mascot pose="peek" size={52} />
            <span>
              In the ice world the whole site turns to ice: a polar-night palette, snow drifting behind the pages, and a penguin or two. Switch either off below if you want the quiet version.
            </span>
          </p>
        )}
        {world === 'panda' && (
          <p className="set-note">
            <Mascot pose="eat" size={52} />
            <span>
              In the bamboo grove the whole site turns to forest: a quiet green palette, leaves drifting behind the pages, a panda or two munching along the footer, and the pandas of the 3D stage
              pushing, climbing and carrying for every step. Switch either decoration off below for the quiet version.
            </span>
          </p>
        )}
      </section>

      {/* ── Appearance ────────────────────────────────────────── */}
      <section className="set-section" aria-labelledby="set-look">
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
      <section className="set-section" aria-labelledby="set-viz">
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
