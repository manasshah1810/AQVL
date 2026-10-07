import React, { useEffect, useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { CanvasTexture, Group, SRGBColorSpace, Sprite, SpriteMaterial, Vector3 } from 'three';
import type { StageModel } from '../../model/StageModel';
import type { StageSample } from '../../model/sampler';
import type { StageDriver } from '../../three/driver';
import type { Playhead } from '../../timeline/Playhead';
import { IdleBrain, type Box, type IdleContext, type IdleOut, type Spots } from '../idle';
import { buildPanda, createBlobShadow, type IdleAct, type PandaPersonality, type Rig } from './rigs';
import { ParticlePool, hash } from './particles';
import { pandaSpots, worldLayout } from './layout';
import type { WorldClock } from './WorldLayer';

/**
 * The rest of the colony: eight more pandas who live in the grove alongside
 * the crew. Three are students, with backpacks and books: the moment a run
 * plays they come and sit in a row in front of it and take notes (and clap at
 * the end). The other five get on with their lives: they eat bamboo, climb
 * the gym, go down the slide, swing, roll about, lie in the sun, wander, play
 * with each other; at night most of them sleep, the rest doze, gaze at the
 * stars, chase fireflies, or go round with a lantern. No two do the same
 * thing at the same moment (see Colony in idle.ts).
 *
 * Like the crew's idle life this is not a pure function of the run's time (it
 * is life in the grove, not the algorithm), so it lives beside the stage.
 */

interface Member {
  name: string;
  role: 'student' | 'resident';
  scale: number;
  personality: PandaPersonality;
  prop?: 'bamboo' | 'leaf';
  bag?: string;
  book?: string;
  glasses?: boolean;
  lamp?: boolean;
}

const MEMBERS: Member[] = [
  // The students: young, quick, a little bouncy, each with its own backpack and book.
  { name: 'Lin', role: 'student', scale: 1.14, bag: '#d4553f', book: '#2f6db5', personality: { size: 1.0, sway: 1.15, tempo: 1.12, bounce: 1.2, blink: 3.6, plump: 0.96, headSize: 1.1, ear: 1.2 } },
  { name: 'Tao', role: 'student', scale: 1.08, bag: '#3d7cc0', book: '#e0a43a', glasses: true, personality: { size: 1.0, sway: 0.9, tempo: 1.0, bounce: 0.95, blink: 4.8, plump: 1.02, headSize: 1.08, ear: 0.9 } },
  { name: 'Yuki', role: 'student', scale: 1.02, bag: '#e3b43a', book: '#8a4fb0', personality: { size: 1.0, sway: 1.3, tempo: 1.22, bounce: 1.35, blink: 3.1, plump: 0.94, headSize: 1.12, ear: 1.4 } },
  // The residents: a big lazy one with a cane (it used to watch from the rocks), its cub, an old one with a lantern, two more.
  { name: 'Dumpling', role: 'resident', scale: 1.38, prop: 'bamboo', personality: { size: 1.06, sway: 0.85, tempo: 0.82, bounce: 0.75, blink: 5.2, plump: 1.16, headSize: 0.98, ear: 0.75 } },
  { name: 'Bean', role: 'resident', scale: 0.86, personality: { size: 1.0, sway: 1.35, tempo: 1.3, bounce: 1.45, blink: 2.9, plump: 1.0, headSize: 1.15, ear: 1.5 } },
  { name: 'Grandpa Wu', role: 'resident', scale: 1.36, lamp: true, personality: { size: 1.0, sway: 0.8, tempo: 0.78, bounce: 0.6, blink: 5.6, plump: 1.08, headSize: 0.96, ear: 0.7 } },
  { name: 'Peach', role: 'resident', scale: 1.18, prop: 'leaf', personality: { size: 1.0, sway: 1.1, tempo: 1.05, bounce: 1.1, blink: 4.1, plump: 0.98, headSize: 1.03, ear: 1.1 } },
  { name: 'Momo', role: 'resident', scale: 1.25, personality: { size: 1.0, sway: 1.0, tempo: 0.95, bounce: 1.0, blink: 4.4, plump: 1.05, headSize: 1.0, ear: 1.0 } },
];

/** What a panda is up to, for the bubble when the viewer points at it. */
const DOING: Partial<Record<IdleAct, string>> = {
  sit: 'sitting about',
  chew: 'munching bamboo',
  scratch: 'having a scratch',
  stretch: 'stretching',
  drink: 'having a drink',
  look: 'looking about',
  sniff: 'sniffing about',
  wave: 'waving',
  bow: 'bowing',
  play: 'playing',
  shake: 'shaking off',
  sleep: 'fast asleep',
  doze: 'nodding off',
  stargaze: 'watching the stars',
  yawn: 'yawning',
  lounge: 'lolling about',
  dance: 'dancing',
  chase: 'chasing fireflies',
  slide: 'wheee!',
  swing: 'on the swing',
  notes: 'taking notes',
  ponder: 'thinking it over',
  clap: 'clapping',
  raise: 'has a question',
};

/** Facing the camera (the stage camera sits a little to the left). */
const CAMERA_FACE = -0.16;
/** Seconds of pause before the students leave their seats (a short pause is not the end of the lesson). */
const RECESS = 5;

const _head = new Vector3();

/** A box round everything standing on the ground at rest in this frame (the colony walks round it). */
function obstacleBox(model: StageModel, rest: ReturnType<StageModel['rest']>): Box | null {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let s = 0; s < model.slots.length; s++) {
    if (!rest.present[s]) continue;
    if (rest.pos[s * 3 + 1] - rest.dims[s * 3 + 1] / 2 - model.floorY > 1.2) continue;
    minX = Math.min(minX, rest.pos[s * 3] - rest.dims[s * 3] / 2);
    maxX = Math.max(maxX, rest.pos[s * 3] + rest.dims[s * 3] / 2);
    minZ = Math.min(minZ, rest.pos[s * 3 + 2] - rest.dims[s * 3 + 2] / 2);
    maxZ = Math.max(maxZ, rest.pos[s * 3 + 2] + rest.dims[s * 3 + 2] / 2);
  }
  return Number.isFinite(minX) ? { minX, maxX, minZ, maxZ } : null;
}

/** A soft "Z" for sleepers. */
function zTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.font = '700 46px "JetBrains Mono", ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(30, 40, 70, 0.55)';
  ctx.strokeText('Z', size / 2, size / 2 + 2);
  ctx.fillStyle = '#f4f1ff';
  ctx.fillText('Z', size / 2, size / 2 + 2);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export interface ColonyLayerProps {
  model: StageModel;
  driver: StageDriver;
  calm: boolean;
  clock: WorldClock;
  playhead: Playhead;
}

export function ColonyLayer({ model, driver, calm, clock, playhead }: ColonyLayerProps) {
  const invalidate = useThree((s) => s.invalidate);
  const get = useThree((s) => s.get);
  const gl = useThree((s) => s.gl);
  const spotsAll = useMemo(() => pandaSpots(model), [model]);
  const layout = useMemo(() => worldLayout(model), [model]);
  const spots = useMemo<Spots>(
    () => ({
      snack: spotsAll.snack.map((c) => ({ at: c.at, face: c.face })),
      gym: { base: spotsAll.gym.base, top: spotsAll.gym.top, deck: [spotsAll.gym.x, spotsAll.gym.z], height: spotsAll.gym.height, drop: spotsAll.gym.drop },
      pond: { at: spotsAll.pond.at, face: spotsAll.pond.face },
      slide: spotsAll.slide,
      swing: { seat: spotsAll.swing.seat, height: spotsAll.swing.height, length: spotsAll.swing.length, face: spotsAll.swing.face, approach: spotsAll.swing.approach },
    }),
    [spotsAll],
  );

  const rigs = useMemo<Rig[]>(
    () => MEMBERS.map((m) => buildPanda({ prop: m.prop ?? null, scale: m.scale, personality: m.personality, bag: m.bag, book: m.book, glasses: m.glasses, lamp: m.lamp })),
    [],
  );
  const holders = useMemo(() => rigs.map(() => new Group()), [rigs]);
  useEffect(() => {
    holders.forEach((h, i) => h.add(rigs[i].root));
    return () => holders.forEach((h, i) => h.remove(rigs[i].root));
  }, [holders, rigs]);
  const shadows = useMemo(() => rigs.map(() => createBlobShadow(model.palette.shadow, model.palette.shadowOpacity * 0.8)), [rigs, model.palette]);
  useEffect(
    () => () => {
      rigs.forEach((r) => r.dispose());
      shadows.forEach((s) => s.dispose());
    },
    [rigs, shadows],
  );
  const pool = useMemo(() => new ParticlePool(240, false), []);
  useEffect(() => () => pool.dispose(), [pool]);

  // Their minds: each its own seed, so no two choose alike. They start where they live, already about their business.
  const brains = useMemo(() => {
    const list = MEMBERS.map((m, i) => {
      const b = new IdleBrain(29 + i * 7, i + 2, 'panda', m.role);
      b.lantern = !!m.lamp;
      b.height = 0.62 * m.scale;
      return b;
    });
    list.forEach((b, i) => {
      const [x, z] = spotsAll.dens[i % spotsAll.dens.length];
      b.reset(x, z, CAMERA_FACE + (hash(i, 3) - 0.5));
    });
    return list;
  }, [spotsAll]);
  useEffect(() => {
    brains.forEach((b) => clock.colony.join(b));
    return () => brains.forEach((b) => clock.colony.leave(b));
  }, [brains, clock]);

  // Sleepers breathe out Zs: three to a sleeper, rising, growing, fading.
  const zzz = useMemo(() => {
    const tex = zTexture();
    const sprites = rigs.flatMap(() =>
      [0, 1, 2].map(() => {
        const s = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
        s.visible = false;
        s.renderOrder = 7;
        return s;
      }),
    );
    return { tex, sprites };
  }, [rigs]);
  useEffect(
    () => () => {
      zzz.tex?.dispose();
      zzz.sprites.forEach((s) => s.material.dispose());
    },
    [zzz],
  );

  const state = useRef({ last: 0, mounted: -1, lastPlay: -100, wasPlaying: false, endAt: -100, inClass: false, k: -1, keepOut: null as Box | null, stage: null as Box | null });
  const clickedAt = useRef<number[]>(MEMBERS.map(() => -10));
  const hovered = useRef(-1);
  const lastText = useRef<string[]>(MEMBERS.map(() => ''));
  const bubbles = useMemo<HTMLDivElement[]>(() => {
    if (typeof document === 'undefined') return [];
    return MEMBERS.map(() => {
      const el = document.createElement('div');
      el.setAttribute('aria-hidden', 'true');
      Object.assign(el.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        whiteSpace: 'nowrap',
        font: '600 12px/1.15 "JetBrains Mono", ui-monospace, monospace',
        padding: '5px 9px 6px',
        borderRadius: '12px',
        background: model.palette.frame,
        color: model.palette.frameText,
        boxShadow: '0 6px 18px rgba(0,0,0,0.22)',
        opacity: '0',
        pointerEvents: 'none',
        zIndex: '5',
        transition: 'opacity 140ms ease',
        willChange: 'transform',
      } satisfies Partial<CSSStyleDeclaration>);
      return el;
    });
  }, [model.palette]);
  useEffect(() => {
    const host = gl.domElement.parentElement;
    if (!host) return undefined;
    bubbles.forEach((b) => host.appendChild(b));
    return () => bubbles.forEach((b) => b.remove());
  }, [bubbles, gl]);

  useEffect(
    () =>
      driver.register((sample: StageSample) => {
        const st = state.current;
        const wall = performance.now() / 1000;
        if (st.mounted < 0) st.mounted = wall;
        const dt = st.last > 0 ? Math.min(0.1, wall - st.last) : 0;
        st.last = wall;
        const now = clock.now;
        const floor = model.floorY;
        const { camera, size } = get();
        const snap = playhead.getSnapshot();
        const playing = snap.playing;

        // The lesson: on while the run plays (and through a short pause); applause when it reaches the end.
        if (playing) st.lastPlay = wall;
        if (!playing && st.wasPlaying && snap.atEnd && !model.trace.error) st.endAt = wall;
        st.wasPlaying = playing;
        const lessonOn = !calm && (playing || (wall - st.lastPlay < RECESS && !snap.atEnd));
        const cheer = !calm && wall - st.endAt < 4.5;
        if (lessonOn) st.inClass = true;
        else if (!cheer) st.inClass = false;

        if (st.k !== sample.k) {
          st.k = sample.k;
          const rest = model.rest(sample.k);
          st.keepOut = obstacleBox(model, rest);
          // While a run plays, the space in front of the structures is the crew's stage: the colony keeps off it.
          const b = st.keepOut;
          st.stage = b ? { minX: b.minX - 0.8, maxX: b.maxX + 0.8, minZ: b.minZ - 0.4, maxZ: b.maxZ + 2.6 } : null;
        }
        const area: Box = { minX: layout.cx - spotsAll.clearX, maxX: layout.cx + spotsAll.clearX, minZ: layout.cz - spotsAll.clearZ, maxZ: layout.cz + spotsAll.clearZ };
        const freeFor = wall - st.mounted + 3;

        pool.begin();
        for (let i = 0; i < MEMBERS.length; i++) {
          const member = MEMBERS[i];
          const brain = brains[i];
          const rig = rigs[i];
          const holder = holders[i];
          const den = spotsAll.dens[i % spotsAll.dens.length];
          let o: IdleOut | null = null;
          if (!calm) {
            const seat = member.role === 'student' ? spotsAll.seats[i % spotsAll.seats.length] : null;
            const ctx: IdleContext = {
              free: true,
              freeFor,
              home: { x: den[0], z: den[1], yaw: CAMERA_FACE },
              keepOut: lessonOn ? st.stage : st.keepOut,
              area,
              spots,
              far: true,
              radius: 4.2,
              colony: clock.colony,
              night: clock.day.night,
              now,
              obstacles: spotsAll.obstacles,
              roam: { cx: layout.cx, cz: layout.cz, rx: spotsAll.clearX, rz: spotsAll.clearZ },
              lesson: seat ? { on: lessonOn, cheer: cheer && st.inClass, seat: seat.at, face: seat.face } : undefined,
            };
            o = brain.update(dt, ctx);
          }
          const x = o ? o.x : den[0];
          const z = o ? o.z : den[1];
          const y = o ? o.y : 0;
          const yaw = o ? o.yaw : CAMERA_FACE;
          holder.position.set(x, floor + y, z);
          holder.rotation.y = yaw;
          // Students at a lesson watch the structures; everyone else looks where it is going.
          const watching = o && (o.act === 'notes' || o.act === 'ponder' || o.act === 'sit' || o.act === 'clap') && brain.doing === 'lesson';
          const lx = watching ? layout.cx - x : Math.sin(yaw) * 3;
          const ly = watching ? 0.9 + layout.lift * 0.2 : 0.6;
          const lz = watching ? layout.cz - z : Math.cos(yaw) * 3;
          const c = Math.cos(yaw), s = Math.sin(yaw);
          const react = wall - clickedAt.current[i];
          rig.update({
            gait: o ? o.gait : 'stand',
            gaitPhase: o ? o.gaitPhase : 0,
            gaitWeight: o ? o.gaitWeight : 0,
            pose: 'idle',
            poseWeight: 1,
            poseTime: now,
            prevPose: 'idle',
            prevWeight: 0,
            lookLocal: [lx * c - lz * s, ly - y, lx * s + lz * c],
            react: react < 1.2 ? react : -1,
            time: now + i * 2.7,
            seed: 3.1 + i * 2.3,
            idle: o && o.actWeight > 0 && o.act !== 'none' ? { act: o.act, t: o.actT, weight: o.actWeight } : undefined,
            seat: o ? o.seat : 0,
            lamp: o ? o.lamp : 0,
            climb: o && o.gait === 'climb' ? { weight: o.gaitWeight, phase: o.gaitPhase, slope: o.climbSlope } : undefined,
          });
          if (react < 1.2) invalidate();

          // Its shadow, smaller the higher it is (up the slide, on the swing).
          const sh = shadows[i].mesh;
          sh.position.set(x, floor + 0.004, z);
          const spread = 0.86 * member.scale * (o && (o.act === 'sleep' || o.act === 'lounge') ? 1.25 : 1) / (1 + y * 1.6);
          sh.scale.set(spread, spread, 1);

          // For the grove: where it is (bamboo rustles as it brushes past) and which stalk it is chewing.
          const slot = clock.crew[2 + i];
          if (slot) {
            const moved = dt > 0 ? Math.hypot(x - slot.x, z - slot.z) / dt : 0;
            slot.speed += (Math.min(6, moved) - slot.speed) * Math.min(1, dt * 8);
            slot.x = x;
            slot.z = z;
            slot.y = y;
            clock.chew[2 + i] = o ? o.stalk : -1;
          }

          // Zs over a sleeper.
          const asleep = o && o.act === 'sleep' && o.actWeight > 0.6 && o.actT > 1.5;
          for (let k = 0; k < 3; k++) {
            const sp = zzz.sprites[i * 3 + k];
            sp.visible = !!asleep && !calm;
            if (!sp.visible) continue;
            const f = ((now * 0.32 + k / 3 + i * 0.17) % 1 + 1) % 1;
            const side = Math.sin(3.1 + i * 2.3) > 0 ? 1 : -1;
            sp.position.set(x + Math.sin(yaw + side * 1.2) * 0.25 + f * 0.35, floor + brain.height * 0.55 + f * 0.9, z + Math.cos(yaw + side * 1.2) * 0.25);
            const scale = 0.16 + f * 0.2;
            sp.scale.set(scale, scale, 1);
            sp.material.opacity = Math.sin(f * Math.PI) * 0.9;
          }

          // A few touches: crumbs while it chews, leaves kicked up by a roll, a puff where it lands off the slide.
          if (o && !calm) {
            if (o.stalk >= 0 && o.gaitWeight < 0.1) {
              for (let p = 0; p < 5; p++) {
                const f = (now * 0.9 + hash(i + 51, p)) % 1;
                pool.add(x + Math.sin(yaw) * 0.32 * member.scale + (hash(i + 53, p) - 0.5) * 0.25, floor + 0.42 * member.scale - f * 0.4, z + Math.cos(yaw) * 0.32 * member.scale, 0.55, 0.72, 0.3, (1 - f) * 0.7, 0.04);
              }
            }
            if (o.gait === 'roll' && o.gaitWeight > 0.2) {
              for (let p = 0; p < 8; p++) {
                const f = (o.gaitPhase / (Math.PI * 2) + hash(i, p)) % 1;
                const back = yaw + Math.PI + (hash(i + 2, p) - 0.5) * 1.4;
                const d = 0.25 + f * 0.5;
                pool.add(x + Math.sin(back) * d, floor + 0.05 + Math.sin(f * Math.PI) * 0.25, z + Math.cos(back) * d, 0.55, 0.72, 0.3, (1 - f) * 0.8, 0.055);
              }
            }
            if (o.act === 'slide' && o.actWeight < 0.9 && o.actWeight > 0.05) {
              const q = 1 - o.actWeight;
              for (let p = 0; p < 14; p++) {
                const a = hash(i + 41, p) * Math.PI * 2;
                const v = 0.4 + hash(i + 43, p) * 0.7;
                pool.add(x + Math.cos(a) * v * q, floor + 0.06 + 0.3 * Math.sin(q * Math.PI) * hash(i + 47, p), z + Math.sin(a) * v * q, 0.78, 0.7, 0.52, (1 - q) * 0.7, 0.09);
              }
            }
          }

          // The bubble: its name when clicked; what it is up to when pointed at.
          let text = '';
          if (react < 1.6) text = `I'm ${member.name}!`;
          else if (hovered.current === i) {
            const act = o?.act ?? 'none';
            const doing = brain.doing === 'lesson' ? (act === 'notes' ? 'taking notes' : DOING[act] ?? 'at the lesson') : DOING[act] ?? (o && o.gait === 'roll' ? 'rolling about' : o && o.gait === 'climb' ? 'climbing' : o && o.gait === 'walk' ? 'out for a stroll' : 'resting');
            text = `${member.name} · ${doing}`;
          }
          const el = bubbles[i];
          if (el) {
            _head.set(x, floor + y + brain.height + 0.45, z).project(camera);
            const visible = text !== '' && _head.z < 1;
            if (text !== lastText.current[i]) {
              el.textContent = text;
              lastText.current[i] = text;
            }
            el.style.opacity = visible ? '1' : '0';
            if (visible) el.style.transform = `translate(${((_head.x * 0.5 + 0.5) * size.width).toFixed(1)}px, ${((-_head.y * 0.5 + 0.5) * size.height).toFixed(1)}px) translate(-50%, -100%)`;
          }
        }
        pool.end();
      }),
    [driver, model, calm, clock, playhead, brains, rigs, holders, shadows, pool, zzz, bubbles, get, invalidate, spots, spotsAll, layout],
  );

  useEffect(
    () => () => {
      if (typeof document !== 'undefined') document.body.style.cursor = '';
    },
    [],
  );

  return (
    <>
      {holders.map((h, i) => (
        <primitive
          key={i}
          object={h}
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
            hovered.current = -1;
            document.body.style.cursor = '';
            invalidate();
          }}
        />
      ))}
      {shadows.map((s, i) => (
        <primitive key={`s${i}`} object={s.mesh} />
      ))}
      {zzz.sprites.map((s, i) => (
        <primitive key={`z${i}`} object={s} />
      ))}
      <primitive object={pool.points} />
    </>
  );
}

