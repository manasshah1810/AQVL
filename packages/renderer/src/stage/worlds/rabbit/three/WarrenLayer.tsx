import React, { useEffect, useMemo, useRef } from 'react';
import { Group } from 'three';
import type { StageModel } from '../../../model/StageModel';
import type { StageSample } from '../../../model/sampler';
import type { StageDriver } from '../../../three/driver';
import type { Playhead } from '../../../timeline/Playhead';
import { ParticlePool, hash } from '../../three/particles';
import type { WorldClock } from '../../three/WorldLayer';
import { Warren } from '../warren';
import { buildBunny, disposeBunny, poseBunny } from './bunny';

const NOTE_COLORS = [[1, 0.56, 0.69], [1, 0.84, 0.3], [0.53, 0.7, 1], [0.71, 0.59, 0.94]];

/** How long after the run stops (or the step last changed) the crew stays at the structures before going off to play. */
const STAY = 12;

/**
 * Everyone in the kingdom, drawn: the crew at the structures, the colony
 * about its day. Little extras ride on top: a "z" or two rising from a
 * sleeper, confetti when a run finishes, a puff of cloud where a rabbit
 * lands from a bounce or a drop.
 */
export function WarrenLayer({ model, driver, calm, clock, playhead }: { model: StageModel; driver: StageDriver; calm: boolean; clock: WorldClock; playhead: Playhead }) {
  const warren = useMemo(() => new Warren(model, clock.day), [model, clock]);
  const rigs = useMemo(() => warren.bunnies.map((b) => buildBunny(b.info.look)), [warren]);
  const group = useMemo(() => {
    const g = new Group();
    rigs.forEach((r) => g.add(r.root));
    return g;
  }, [rigs]);
  const pool = useMemo(() => new ParticlePool(260, false), []);
  const state = useRef({ last: 0, rest: 0, lastK: -1, gaits: [] as string[], landings: [] as { x: number; y: number; z: number; t: number }[], cheerAt: -100 });

  useEffect(() => () => rigs.forEach(disposeBunny), [rigs]);
  useEffect(() => () => pool.dispose(), [pool]);

  useEffect(
    () =>
      driver.register((sample: StageSample) => {
        const st = state.current;
        const wall = performance.now() / 1000;
        const dt = st.last > 0 ? Math.min(0.1, wall - st.last) : 0;
        st.last = wall;
        const playing = playhead.getSnapshot().playing;
        if (playing || sample.k !== st.lastK) st.rest = 0;
        else st.rest += dt;
        const lastFrame = sample.k === model.frameCount - 1 && sample.k > 0;
        if (lastFrame && sample.k !== st.lastK) st.cheerAt = clock.now;
        st.lastK = sample.k;
        const working = playing || (sample.k > 0 && st.rest < STAY);
        warren.update({ model, sample, now: clock.now, dt, day: clock.day, playing, working, calm });

        const now = clock.now;
        pool.begin();
        warren.bunnies.forEach((b, i) => {
          poseBunny(rigs[i], b, now, dt, calm);
          const prev = st.gaits[i];
          // Landing puffs: when a leap or a float ends on a cloud.
          if ((prev === 'leap' || prev === 'float') && b.gait !== 'leap' && b.gait !== 'float') st.landings.push({ x: b.x, y: b.y, z: b.z, t: now });
          st.gaits[i] = b.gait;
          if (calm) return;
          if (b.pose === 'sleep' || b.pose === 'nap') {
            for (let q = 0; q < 3; q++) {
              const f = (now * 0.3 + q / 3 + i * 0.13) % 1;
              pool.add(b.x + 0.2 + Math.sin(f * 6 + q) * 0.12, b.y + 0.7 + f * 1.1, b.z, 0.85, 0.88, 1, Math.sin(f * Math.PI) * 0.8, 0.06 + f * 0.05);
            }
          }
          // Music notes drifting up from Manan's guitar.
          if ((b.pose === 'guitar' || b.pose === 'sing') && b.gear === 'play') {
            const s = b.info.look.scale;
            for (let q = 0; q < 4; q++) {
              const f = (now * 0.35 + q / 4) % 1;
              const c = NOTE_COLORS[q % NOTE_COLORS.length];
              pool.add(b.x + Math.sin(f * 7 + q * 2) * 0.35 * s, b.y + (0.7 + f * 1.4) * s, b.z + Math.cos(f * 5 + q) * 0.25 * s, c[0], c[1], c[2], Math.sin(f * Math.PI) * 0.9, 0.07);
            }
          }
          if (b.held === 'lantern') {
            const s = b.info.look.scale;
            pool.add(b.x + Math.sin(b.yaw) * 0.3 * s, b.y + 0.36 * s, b.z + Math.cos(b.yaw) * 0.3 * s, 1, 0.8, 0.45, 0.6 * clock.day.night, 0.35);
          }
        });
        st.landings = st.landings.filter((l) => now - l.t < 0.9);
        for (const l of st.landings) {
          const tt = now - l.t;
          for (let p = 0; p < 14; p++) {
            const a = hash(p, 3) * Math.PI * 2;
            const r = 0.2 + tt * (0.9 + hash(p, 4) * 0.6);
            pool.add(l.x + Math.cos(a) * r, l.y + 0.08 + tt * 0.35, l.z + Math.sin(a) * r, 1, 1, 1, (1 - tt / 0.9) * 0.75, 0.16);
          }
        }
        // Confetti over the plaza when a run reaches its end.
        const ct = now - st.cheerAt;
        if (ct >= 0 && ct < 3.5 && !calm) {
          const k = warren.kingdom;
          const cols = [[1, 0.56, 0.69], [1, 0.84, 0.3], [0.53, 0.7, 1], [0.5, 0.86, 0.71], [0.71, 0.59, 0.94]];
          for (let p = 0; p < 90; p++) {
            const f = (ct / 3.5 + hash(p, 1) * 0.3) % 1;
            const c = cols[p % cols.length];
            const x = k.cx + (hash(p, 2) - 0.5) * k.clearX * 2.2 + Math.sin(ct * 3 + p) * 0.3;
            const z = k.cz + (hash(p, 5) - 0.5) * k.clearZ * 2.2;
            const y = k.floorY + 6 * (1 - f) + 0.2;
            pool.add(x, y, z, c[0], c[1], c[2], Math.min(1, (1 - ct / 3.5) * 3) * 0.95, 0.09);
          }
        }
        pool.end();
      }),
    [driver, model, warren, rigs, pool, clock, calm, playhead],
  );

  return (
    <>
      <primitive object={group} />
      <primitive object={pool.points} />
    </>
  );
}
