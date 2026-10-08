import React, { useEffect, useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { CanvasTexture, Group, SRGBColorSpace, Sprite, SpriteMaterial, Vector3 } from 'three';
import type { StageModel } from '../../model/StageModel';
import type { StageSample } from '../../model/sampler';
import type { StageDriver } from '../../three/driver';
import type { Playhead } from '../../timeline/Playhead';
import { IdleBrain, type Box, type IdleContext, type IdleOut, type Spots } from '../idle';
import { buildPanda, createBlobShadow, type IdleAct, type Rig } from './rigs';
import { MEMBERS } from './colonyCast';
import { PENGUIN_MEMBERS } from './penguinCast';
import { buildColonyPenguin } from './penguinRig';
import { penguinSpots } from './polarLayout';
import { gatherAt } from '../daycycle';
import { ParticlePool, hash } from './particles';
import { pandaSpots, worldLayout } from './layout';
import type { WorldClock } from './WorldLayer';
import { SleepGate, ViewCuller, perfCounters } from '../../three/perf';
import { useGovernedInvalidate } from '../../three/perf';

/**
 * The rest of the colony: fifteen more pandas who live in the grove alongside
 * the crew. Three are students, with backpacks and books: the moment a run
 * plays they come and sit in a row in front of it and take notes (and clap at
 * the end). Three are the old residents (a big lazy one with a cane, its cub,
 * an old one with a lantern). Nine are characters, each with a look and a
 * routine of its own: the gym, the computer, the guitar, the classroom, the
 * wandering, the following and the dodging (see MEMBERS). Every day at noon
 * the one with the guitar sings by the fire and most of the colony comes to
 * listen and dance; at night the bags come off and nearly everyone goes to
 * bed, the rest sit by the fire, gaze at the stars, chase fireflies or go
 * round with a lantern. No two do the same thing at the same moment (see
 * Colony in idle.ts).
 *
 * Like the crew's idle life this is not a pure function of the run's time (it
 * is life in the grove, not the algorithm), so it lives beside the stage.
 *
 * The penguins' ice shelf has a colony of its own, the same characters as
 * penguins (see PENGUIN_MEMBERS), with the shelf's own places: they swim in
 * the pool and dive off its ledge, go down the ice slide on their bellies,
 * help themselves to fish, and the clumsy one slips on the ice.
 */

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
  guitar: 'singing and strumming',
  type: 'busy on the laptop',
  lift: 'pressing the barbell',
  squat: 'squatting',
  pullup: 'doing pull-ups',
  punch: 'punching the log',
  teach: 'teaching at the board',
  adjust: 'adjusting those glasses',
  glance: 'looking back',
  unbag: 'taking the bag off',
  rebag: 'putting the bag on',
};

/** What a penguin is up to, where it differs from a panda. */
const PENGUIN_DOING: Partial<Record<IdleAct, string>> = {
  chase: 'chasing snowflakes',
  chew: 'having a snack',
  eat: 'gulping down a fish',
  preen: 'preening',
  drink: 'having a drink',
  slide: 'wheee!',
  lounge: 'lying about on the ice',
};

/** The colony as the layer needs it, whichever world it lives in. */
interface Resident {
  name: string;
  role: 'student' | 'resident';
  scale: number;
  bag?: string;
  lamp?: boolean;
  persona: (typeof MEMBERS)[number]['persona'];
}

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

/**
 * The little things a penguin kicks up: snow spray behind a belly slide or a roll, a wake and drops of water while it
 * swims, a burst of droplets where it goes in or comes out, a puff of snow where it lands off the play slide.
 */
function penguinTouches(pool: ParticlePool, o: IdleOut, x: number, y: number, z: number, yaw: number, floor: number, now: number, i: number, scale: number): void {
  const back = yaw + Math.PI;
  if ((o.gait === 'glide' || o.gait === 'roll') && o.gaitWeight > 0.3 && y > -0.02 && y < 0.1) {
    for (let p = 0; p < 9; p++) {
      const f = (now * 2.2 + hash(i + 81, p)) % 1;
      const a = back + (hash(i + 82, p) - 0.5) * 1.1;
      const d = 0.2 + f * 0.7 * scale * 0.6;
      pool.add(x + Math.sin(a) * d, floor + 0.04 + Math.sin(f * Math.PI) * 0.18, z + Math.cos(a) * d, 0.9, 0.95, 1, (1 - f) * 0.75 * o.gaitWeight, 0.05 + hash(i, p) * 0.04);
    }
  }
  if (o.gait === 'swim' && y > -0.6) {
    // The wake: two lines of ripples spreading out behind, a few drops off the flippers.
    for (let p = 0; p < 8; p++) {
      const f = (now * 0.9 + p / 8) % 1;
      const side = p % 2 ? 1 : -1;
      const a = back + side * (0.35 + f * 0.25);
      const d = 0.3 + f * 1.1;
      pool.add(x + Math.sin(a) * d, floor + 0.02, z + Math.cos(a) * d, 0.75, 0.9, 1, (1 - f) * 0.55, 0.06 + f * 0.05);
    }
    for (let p = 0; p < 3; p++) {
      const f = (now * 1.6 + hash(i + 91, p)) % 1;
      const side = p % 2 ? 1 : -1;
      pool.add(x + Math.cos(yaw) * side * 0.3 * scale * 0.6, floor + 0.05 + Math.sin(f * Math.PI) * 0.22, z - Math.sin(yaw) * side * 0.3 * scale * 0.6, 0.8, 0.92, 1, (1 - f) * 0.7, 0.035);
    }
  }
  if (o.act === 'slide' && o.actWeight < 0.9 && o.actWeight > 0.05) {
    const q = 1 - o.actWeight;
    for (let p = 0; p < 14; p++) {
      const a = hash(i + 41, p) * Math.PI * 2;
      const v = 0.4 + hash(i + 43, p) * 0.7;
      pool.add(x + Math.cos(a) * v * q, floor + 0.06 + 0.3 * Math.sin(q * Math.PI) * hash(i + 47, p), z + Math.sin(a) * v * q, 0.9, 0.95, 1, (1 - q) * 0.7, 0.09);
    }
  }
}

export interface ColonyLayerProps {
  model: StageModel;
  driver: StageDriver;
  calm: boolean;
  clock: WorldClock;
  playhead: Playhead;
}

export function ColonyLayer({ model, driver, calm, clock, playhead }: ColonyLayerProps) {
  const invalidate = useGovernedInvalidate();
  const get = useThree((s) => s.get);
  const gl = useThree((s) => s.gl);
  const penguin = model.world === 'penguin';
  const cast = useMemo<Resident[]>(() => (penguin ? PENGUIN_MEMBERS.map((m) => ({ ...m, bag: m.look.bag })) : MEMBERS), [penguin]);
  const ice = useMemo(() => (penguin ? penguinSpots(model) : null), [model, penguin]);
  const spotsAll = useMemo(() => {
    if (!ice) return pandaSpots(model);
    // The ice shelf, in the shape the layer reads the grove in (its own places in `ice`).
    return { clearX: ice.clearX, clearZ: ice.clearZ, seats: ice.seats, dens: ice.dens, obstacles: ice.obstacles } as unknown as ReturnType<typeof pandaSpots>;
  }, [model, ice]);
  const layout = useMemo(() => worldLayout(model), [model]);
  const spots = useMemo<Spots>(
    () =>
      ice
        ? {
            slide: ice.places.play.slide,
            camp: ice.places.camp,
            yard: ice.places.yard,
            beds: ice.places.beds,
            desk: ice.places.desk,
            school: ice.places.school,
            nooks: ice.places.nooks,
            paths: ice.places.paths,
            pool: ice.places.pool,
            ramp: ice.places.ramp,
            fish: ice.places.fish,
          }
        : {
      snack: spotsAll.snack.map((c) => ({ at: c.at, face: c.face })),
      gym: { base: spotsAll.gym.base, top: spotsAll.gym.top, deck: [spotsAll.gym.x, spotsAll.gym.z], height: spotsAll.gym.height, drop: spotsAll.gym.drop },
      pond: { at: spotsAll.pond.at, face: spotsAll.pond.face },
      slide: spotsAll.slide,
      swing: { seat: spotsAll.swing.seat, height: spotsAll.swing.height, length: spotsAll.swing.length, face: spotsAll.swing.face, approach: spotsAll.swing.approach },
      camp: spotsAll.places.camp,
      yard: spotsAll.places.yard,
      beds: spotsAll.places.beds,
      desk: spotsAll.places.desk,
      school: spotsAll.places.school,
      nooks: spotsAll.places.nooks,
      paths: spotsAll.places.paths,
    },
    [spotsAll, ice],
  );

  const rigs = useMemo<Rig[]>(
    () =>
      penguin
        ? PENGUIN_MEMBERS.map((m) => buildColonyPenguin({ scale: m.scale, personality: m.personality, ...m.look }))
        : MEMBERS.map((m) => buildPanda({ prop: m.prop ?? null, scale: m.scale, personality: m.personality, bag: m.bag, book: m.book, glasses: m.glasses, lamp: m.lamp, ...m.look })),
    [penguin],
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
  const pool = useMemo(() => new ParticlePool(penguin ? 520 : 240, false), [penguin]);
  useEffect(() => () => pool.dispose(), [pool]);

  // Their minds: each its own seed, so no two choose alike. They start where they live, already about their business.
  const brains = useMemo(() => {
    const list = cast.map((m, i) => {
      const b = new IdleBrain(29 + i * 7 + (penguin ? 101 : 0), i + 2, penguin ? 'penguin' : 'panda', m.role);
      b.lantern = !!m.lamp;
      b.height = (penguin ? 0.72 : 0.62) * m.scale;
      b.name = m.name;
      b.persona = m.persona;
      b.hasBag = !!m.bag;
      b.bed = i;
      return b;
    });
    list.forEach((b, i) => {
      const [x, z] = spotsAll.dens[i % spotsAll.dens.length];
      b.reset(x, z, CAMERA_FACE + (hash(i, 3) - 0.5));
    });
    return list;
  }, [spotsAll, cast, penguin]);
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

  const bagSpots = useRef<([number, number] | null)[]>(cast.map(() => null));
  const state = useRef({ last: 0, mounted: -1, lastPlay: -100, wasPlaying: false, endAt: -100, inClass: false, k: -1, keepOut: null as Box | null, stage: null as Box | null });
  const clickedAt = useRef<number[]>(cast.map(() => -10));
  const hovered = useRef(-1);
  const lastText = useRef<string[]>(cast.map(() => ''));
  const culler = useMemo(() => new ViewCuller(), []);
  const gates = useMemo(() => cast.map(() => new SleepGate(0.1)), [cast]);
  const lastOut = useRef<(IdleOut | null)[]>(cast.map(() => null));
  const frameNo = useRef(0);
  const bubbles = useMemo<HTMLDivElement[]>(() => {
    if (typeof document === 'undefined') return [];
    return cast.map(() => {
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
  }, [model.palette, cast]);
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
        const gather = gatherAt(clock.day);

        pool.begin();
        culler.update(camera);
        frameNo.current++;
        let inView = 0;
        let awake = 0;
        for (let i = 0; i < cast.length; i++) {
          const member = cast[i];
          const brain = brains[i];
          const rig = rigs[i];
          const holder = holders[i];
          const den = spotsAll.dens[i % spotsAll.dens.length];
          let o: IdleOut | null = null;
          // An animal out of shot keeps living (it still walks, sits down, goes to bed) but is decided on ten times a
          // second and not posed at all; one in view runs every frame, as before.
          const prev = lastOut.current[i];
          const seen = calm || !prev || culler.sees(prev.x, floor + prev.y + 0.8, prev.z, 3.4);
          const stepDt = calm ? dt : gates[i].step(dt, seen);
          if (seen) inView++;
          if (!calm && stepDt <= 0 && prev) {
            o = prev;
          } else if (!calm) {
            const seat = member.role === 'student' ? spotsAll.seats[i % spotsAll.seats.length] : null;
            const ctx: IdleContext = {
              free: true,
              freeFor,
              home: { x: den[0], z: den[1], yaw: CAMERA_FACE },
              keepOut: lessonOn ? st.stage : st.keepOut,
              area,
              spots,
              far: true,
              radius: 6.5,
              colony: clock.colony,
              night: clock.day.night,
              now,
              obstacles: spotsAll.obstacles,
              roam: { cx: layout.cx, cz: layout.cz, rx: spotsAll.clearX, rz: spotsAll.clearZ },
              lesson: seat ? { on: lessonOn, cheer: cheer && st.inClass, seat: seat.at, face: seat.face } : undefined,
              gather,
            };
            o = brain.update(stepDt, ctx);
            lastOut.current[i] = o;
            awake++;
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
          // The school bag, once it is off, is put down on the floor beside where it came off and stays there.
          const bagW = o ? o.bag : 1;
          if (!member.bag || bagW >= 0.999) bagSpots.current[i] = null;
          else if (!bagSpots.current[i]) bagSpots.current[i] = [x + Math.cos(yaw) * 0.85 + Math.sin(yaw) * 0.25, z - Math.sin(yaw) * 0.85 + Math.cos(yaw) * 0.25];
          const bagSpot = bagSpots.current[i];
          if (seen || (frameNo.current + i) % 8 === 0)
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
            bag: bagW,
            bagAt: bagSpot ? [bagSpot[0], floor + 0.2, bagSpot[1]] : undefined,
            climb: o && o.gait === 'climb' ? { weight: o.gaitWeight, phase: o.gaitPhase, slope: o.climbSlope } : undefined,
            fish: o ? o.fish : 0,
          });
          // A splash where it goes into the water or comes out of it (the pool ripples).
          if (o && o.splash && penguin && !calm) {
            clock.splashes.push({ x, z, at: now });
            if (clock.splashes.length > 6) clock.splashes.shift();
          }
          if (react < 1.2) invalidate();

          // Its shadow, smaller the higher it is (up the slide, on the swing).
          const sh = shadows[i].mesh;
          sh.visible = y > -0.02 && seen;
          sh.position.set(x, floor + 0.004, z);
          const spread = 0.86 * member.scale * (o && (o.act === 'sleep' || o.act === 'lounge') ? 1.25 : 1) / (1 + y * 1.6);
          sh.scale.set(spread, spread, 1);

          if (penguin) {
            if (o && !calm) penguinTouches(pool, o, x, y, z, yaw, floor, now, i, member.scale);
          }
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
            sp.position.set(x + Math.sin(yaw + side * 1.2) * 0.25 + f * 0.35, floor + y + brain.height * 0.55 + f * 0.9, z + Math.cos(yaw + side * 1.2) * 0.25);
            const scale = 0.16 + f * 0.2;
            sp.scale.set(scale, scale, 1);
            sp.material.opacity = Math.sin(f * Math.PI) * 0.9;
          }

          // A few touches: crumbs while it chews, leaves kicked up by a roll, a puff where it lands off the slide.
          if (o && !calm && seen) {
            if (!penguin && o.stalk >= 0 && o.gaitWeight < 0.1) {
              for (let p = 0; p < 5; p++) {
                const f = (now * 0.9 + hash(i + 51, p)) % 1;
                pool.add(x + Math.sin(yaw) * 0.32 * member.scale + (hash(i + 53, p) - 0.5) * 0.25, floor + 0.42 * member.scale - f * 0.4, z + Math.cos(yaw) * 0.32 * member.scale, 0.55, 0.72, 0.3, (1 - f) * 0.7, 0.04);
              }
            }
            // Notes drift up from the guitar while it is played and sung.
            if (o.act === 'guitar' && o.actWeight > 0.4) {
              for (let p = 0; p < 4; p++) {
                const f = (now * 0.45 + p / 4 + hash(i + 71, p) * 0.2) % 1;
                const side = (p % 2 ? 1 : -1) * (0.3 + f * 0.5);
                const hue = p % 3;
                pool.add(x + Math.cos(yaw) * side + Math.sin(yaw) * 0.5, floor + y + 0.6 * member.scale + f * 1.4, z - Math.sin(yaw) * side + Math.cos(yaw) * 0.5, hue === 0 ? 1 : 0.95, hue === 1 ? 0.9 : 0.78, hue === 2 ? 0.95 : 0.4, Math.sin(f * Math.PI) * 0.9, 0.07);
              }
            }
            if (!penguin && o.gait === 'roll' && o.gaitWeight > 0.2) {
              for (let p = 0; p < 8; p++) {
                const f = (o.gaitPhase / (Math.PI * 2) + hash(i, p)) % 1;
                const back = yaw + Math.PI + (hash(i + 2, p) - 0.5) * 1.4;
                const d = 0.25 + f * 0.5;
                pool.add(x + Math.sin(back) * d, floor + 0.05 + Math.sin(f * Math.PI) * 0.25, z + Math.cos(back) * d, 0.55, 0.72, 0.3, (1 - f) * 0.8, 0.055);
              }
            }
            if (!penguin && o.act === 'slide' && o.actWeight < 0.9 && o.actWeight > 0.05) {
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
            const swimming = o && penguin && o.y < -0.02;
            const penguinDoing = penguin
              ? swimming
                ? o!.y < -0.7 ? 'diving' : 'swimming'
                : brain.doing === 'belly' && o && (o.gait === 'glide' || o.gait === 'climb')
                  ? o.gait === 'climb' ? 'up the ice slide' : 'down the ice slide on its belly!'
                  : brain.doing === 'slip' && o && o.gait === 'tumble'
                    ? 'whoops! slipped on the ice'
                    : o && o.gait === 'glide'
                      ? 'sliding on its belly'
                      : act !== 'none' && brain.doing !== 'lesson'
                        ? PENGUIN_DOING[act]
                        : undefined
              : undefined;
            const doing = penguinDoing ?? (brain.doing === 'lesson' ? (act === 'notes' ? 'taking notes' : DOING[act] ?? 'at the lesson') : DOING[act] ?? (o && o.gait === 'roll' ? 'rolling about' : o && o.gait === 'climb' ? 'climbing' : o && o.gait === 'walk' ? (brain.doing === 'workout' ? 'jogging round the yard' : brain.doing === 'gather' ? 'off to the fire' : brain.doing === 'evade' ? 'getting away' : brain.doing === 'tail' ? 'out for a stroll (not following anyone)' : brain.doing === 'sleep' ? 'off to bed' : 'out for a stroll') : brain.doing === 'class' ? 'in the lesson' : 'resting'));
            text = `${member.name} · ${doing}`;
          }
          const el = bubbles[i];
          if (el && (text !== '' || lastText.current[i] !== '')) {
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
        perfCounters.animalsTotal = cast.length;
        perfCounters.animalsVisible = inView;
        perfCounters.animalsAwake = awake + inView;
      }),
    [driver, model, calm, clock, playhead, brains, rigs, holders, shadows, pool, zzz, bubbles, get, invalidate, spots, spotsAll, layout, cast, penguin],
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

