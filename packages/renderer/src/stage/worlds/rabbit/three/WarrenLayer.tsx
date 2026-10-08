import React, { useEffect, useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { StageModel } from '../../../model/StageModel';
import type { StageSample } from '../../../model/sampler';
import type { StageDriver } from '../../../three/driver';
import type { Playhead } from '../../../timeline/Playhead';
import { ParticlePool, hash } from '../../three/particles';
import type { WorldClock } from '../../three/WorldLayer';
import { Warren, type Bunny, type Pose } from '../warren';
import { buildBunny, disposeBunny, poseBunny } from './bunny';

const NOTE_COLORS = [[1, 0.56, 0.69], [1, 0.84, 0.3], [0.53, 0.7, 1], [0.71, 0.59, 0.94]];

const _head = new Vector3();

/** What a pose looks like it is (for the hover bubble). */
const POSE_DOING: Partial<Record<Pose, string>> = {
  eat: 'munching a snack', dig: 'digging', sniff: 'sniffing about', sleep: 'fast asleep', read: 'reading', gaze: 'gazing at the sky',
  chat: 'having a chat', cheer: 'cheering!', inspect: 'inspecting the run', push: 'pushing a value along', tap: 'tapping a cell',
  point: 'pointing it out', nod: 'nodding along', startle: 'startled!', shrug: 'shrugging', present: 'presenting the step', watch: 'watching',
  lift: 'lifting weights', stretch: 'stretching', jumps: 'doing jumping jacks', type: 'typing at the computer', nap: 'napping',
  lazy: 'lazing about', guitar: 'playing the guitar', sing: 'singing along', teach: 'teaching the class', notes: 'taking notes',
  raise: 'raising a paw', ponder: 'pondering', adjust: 'adjusting those glasses', stumble: 'whoops! tripped', dance: 'dancing',
  listen: 'listening', cool: 'looking cool', hide: 'hiding', drink: 'having a drink', roll: 'rolling about', peer: 'peering around',
  wave: 'waving', clap: 'clapping', look: 'looking around',
};

function doingOf(b: Bunny): string {
  if (b.gait === 'leap') return 'bouncing high';
  if (b.gait === 'float') return 'floating on a balloon';
  if (b.gait === 'ride') return 'riding across';
  if (b.gait === 'slide') return 'down the slide!';
  if (b.gait === 'hop') {
    if (b.intent === 'fire') return 'off to the campfire';
    if (b.intent === 'sleep' || b.intent === 'home') return 'heading home';
    if (b.intent === 'audience' || b.intent === 'crew') return 'off to the run';
    if (b.spot?.act === 'hide') return 'getting away';
    if (b.spot?.act === 'follow' || b.spot?.act === 'drift') return 'out for a stroll';
    return 'hopping about';
  }
  if (b.intent === 'fire' && (b.pose === 'idle' || b.pose === 'sit')) return 'by the campfire';
  return POSE_DOING[b.pose] ?? (b.intent === 'sleep' ? 'asleep' : b.spot ? `at the ${b.spot.act}` : 'resting');
}

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
  const invalidate = useThree((s) => s.invalidate);
  const get = useThree((s) => s.get);
  const gl = useThree((s) => s.gl);
  const hovered = useRef(-1);
  const clickedAt = useRef<number[]>(warren.bunnies.map(() => -10));
  const lastText = useRef<string[]>(warren.bunnies.map(() => ''));
  const bubbles = useMemo<HTMLDivElement[]>(() => {
    if (typeof document === 'undefined') return [];
    return warren.bunnies.map(() => {
      const el = document.createElement('div');
      el.setAttribute('aria-hidden', 'true');
      Object.assign(el.style, {
        position: 'absolute', left: '0', top: '0', whiteSpace: 'nowrap',
        font: '600 12px/1.15 "JetBrains Mono", ui-monospace, monospace',
        padding: '5px 9px 6px', borderRadius: '12px',
        background: model.palette.frame, color: model.palette.frameText,
        boxShadow: '0 6px 18px rgba(0,0,0,0.22)', opacity: '0', pointerEvents: 'none', zIndex: '5',
        transition: 'opacity 140ms ease', willChange: 'transform',
      } satisfies Partial<CSSStyleDeclaration>);
      return el;
    });
  }, [model.palette, warren]);
  useEffect(() => {
    const host = gl.domElement.parentElement;
    if (!host) return undefined;
    bubbles.forEach((b) => host.appendChild(b));
    return () => bubbles.forEach((b) => b.remove());
  }, [bubbles, gl]);
  useEffect(
    () => () => {
      if (typeof document !== 'undefined') document.body.style.cursor = '';
    },
    [],
  );
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
          // The bubble: its name when clicked; who it is and what it is up to when pointed at.
          const el = bubbles[i];
          if (el) {
            const text = wall - clickedAt.current[i] < 1.6 ? `I'm ${b.info.name}!` : hovered.current === i ? `${b.info.name} · ${doingOf(b)}` : '';
            const { camera, size } = get();
            _head.set(b.x, b.y + 1.25 * b.info.look.scale, b.z).project(camera);
            const visible = text !== '' && _head.z < 1;
            if (text !== lastText.current[i]) {
              el.textContent = text;
              lastText.current[i] = text;
            }
            el.style.opacity = visible ? '1' : '0';
            if (visible) el.style.transform = `translate(${((_head.x * 0.5 + 0.5) * size.width).toFixed(1)}px, ${((-_head.y * 0.5 + 0.5) * size.height).toFixed(1)}px) translate(-50%, -100%)`;
          }
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
    [driver, model, warren, rigs, pool, clock, calm, playhead, bubbles, get],
  );

  return (
    <>
      {rigs.map((r, i) => (
        <primitive
          key={i}
          object={r.root}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            clickedAt.current[i] = performance.now() / 1000;
            invalidate();
          }}
          onPointerOver={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            hovered.current = i;
            document.body.style.cursor = 'pointer';
            invalidate();
          }}
          onPointerOut={() => {
            if (hovered.current === i) hovered.current = -1;
            document.body.style.cursor = '';
            invalidate();
          }}
        />
      ))}
      <primitive object={pool.points} />
    </>
  );
}
