import React, { useEffect, useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Color, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { StageModel } from '../../model/StageModel';
import type { StageSample } from '../../model/sampler';
import type { StageDriver } from '../../three/driver';
import { STATE_TREATMENTS } from '../../look/treatments';
import { createCast, sampleCast, type CastMember, type CastPose, type CastStyle } from '../cast';
import { WORLDS } from '../types';
import type { Playhead } from '../../timeline/Playhead';
import { buildEagle, buildPanda, buildPenguin, createBlobShadow, PERSONALITIES, type IdleAct, type Rig } from './rigs';
import { ParticlePool, hash } from './particles';
import { IdleBrain, type Box, type IdleContext, type Spots } from '../idle';
import { iceMotionAt, blockAt, eagleAt, type EagleState } from '../ice';
import { polarSpots } from './layout';
import type { WorldClock } from './WorldLayer';

export interface CastLayerProps {
  model: StageModel;
  driver: StageDriver;
  style: CastStyle;
  calm: boolean;
  /** Ambient clock (seconds), shared with the world so everything breathes together. */
  clock: WorldClock;
  /** The run's playhead: while it plays the crew stays at its work, while it rests the crew may roam. */
  playhead: Playhead;
}

const VERBS: Record<CastPose, string> = {
  idle: 'waiting',
  inspect: 'comparing',
  push: 'swapping',
  pull: 'swapping',
  tap: 'writing',
  present: 'adding',
  shrug: 'ruling out',
  point: 'visiting',
  cheer: 'celebrating',
};

/** What a crew member says, in a small bubble, while it acts out a step. */
function bubbleFor(pose: CastPose, style: CastStyle, value: string, settled: boolean): string {
  switch (pose) {
    case 'inspect':
      return '?';
    case 'push':
      return style === 'penguin' ? 'heave!' : 'oof!';
    case 'pull':
      return 'hup!';
    case 'tap':
      return value !== '' && value.length <= 4 ? `=${value}` : '!';
    case 'present':
      return 'ta-da!';
    case 'shrug':
      return 'nope';
    case 'point':
      return '!';
    case 'cheer':
      return settled ? (style === 'penguin' ? 'sorted!' : 'done!') : 'yay!';
    default:
      return '';
  }
}

/** Crew size relative to a cell (a cell is one unit tall at rest). */
const CREW_SCALE = { penguin: 1.75, panda: 1.32 } as const;
/** Head height of the scaled crew, where the bubble sits beside them. */
const HEAD = { penguin: 1.22, panda: 1.08 } as const;

const _head = new Vector3();
const scratch = { x: 0, z: 0, vx: 0, vz: 0, leg: -1 };
const eg0: EagleState = { visible: false, x: 0, y: 0, z: 0, yaw: 0, flap: 0, holding: false, clock: 0 };
const eg1: EagleState = { visible: false, x: 0, y: 0, z: 0, yaw: 0, flap: 0, holding: false, clock: 0 };

/** A box round everything standing on the ice at rest in this frame (animals keep out of it). */
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

const CONFETTI: Record<CastStyle, string[]> = {
  penguin: ['#e9f6ff', '#9fdcff', '#7af0c8', '#ffffff'],
  panda: ['#8cc152', '#f4b6c2', '#ffe08a', '#b8e07a'],
};

/**
 * The crew: two animals sampled with the bodies every frame (see cast.ts),
 * with soft shadows, a speech bubble, and celebratory particles. Click one
 * and it hops (penguin) or rolls (panda) and says its name.
 */
export function CastLayer({ model, driver, style, calm, clock, playhead }: CastLayerProps) {
  const invalidate = useThree((s) => s.invalidate);
  const get = useThree((s) => s.get);
  const gl = useThree((s) => s.gl);
  const names = WORLDS[style].crew;
  const cast = useMemo(() => createCast(), []);
  const rigs = useMemo<Rig[]>(
    () =>
      style === 'penguin'
        ? [
            buildPenguin({ scarf: ['#c8406a', '#f6e7d2'], scale: CREW_SCALE.penguin * 1.03, personality: PERSONALITIES[0] }),
            buildPenguin({ scarf: ['#2f5d9e', '#f2c14e'], scale: CREW_SCALE.penguin * 0.97, personality: PERSONALITIES[1] }),
          ]
        : [buildPanda({ prop: 'bamboo', scale: CREW_SCALE.panda }), buildPanda({ prop: 'leaf', scale: CREW_SCALE.panda })],
    [style],
  );
  const holders = useMemo(() => rigs.map(() => new Group()), [rigs]);
  // A rope that hangs from a floating cell when an animal climbs to it, and the ice ledge it perches on once there.
  const gear = useMemo(() => {
    const ropeMat = new MeshStandardMaterial({ color: '#d9b98a', roughness: 0.85 });
    const ledgeMat = new MeshStandardMaterial({ color: '#bfe3ff', roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.88, emissive: new Color('#2a5f94'), emissiveIntensity: 0.35 });
    const ropeGeo = new CylinderGeometry(0.05, 0.05, 1, 8);
    const ledgeGeo = new CylinderGeometry(0.62, 0.5, 0.08, 28);
    const ropes = rigs.map(() => {
      const m = new Mesh(ropeGeo, ropeMat);
      m.visible = false;
      return m;
    });
    const ledges = rigs.map(() => {
      const m = new Mesh(ledgeGeo, ledgeMat);
      m.visible = false;
      return m;
    });
    return { ropes, ledges, ledgeW: rigs.map(() => 0), dispose: () => { ropeMat.dispose(); ledgeMat.dispose(); ropeGeo.dispose(); ledgeGeo.dispose(); } };
  }, [rigs]);
  useEffect(() => () => gear.dispose(), [gear]);
  // The eagle that carries new floating nodes to their places (penguin world).
  const eagle = useMemo(() => {
    if (style !== 'penguin') return null;
    const rig = buildEagle(1.3);
    const holder = new Group();
    holder.add(rig.root);
    holder.visible = false;
    const shadow = createBlobShadow(model.palette.shadow, model.palette.shadowOpacity * 0.8);
    shadow.mesh.visible = false;
    return { rig, holder, shadow };
  }, [style, model.palette]);
  useEffect(
    () => () => {
      eagle?.rig.dispose();
      eagle?.shadow.dispose();
    },
    [eagle],
  );
  const shadows = useMemo(() => rigs.map(() => createBlobShadow(model.palette.shadow, model.palette.shadowOpacity * 0.85)), [rigs, model.palette]);
  const pool = useMemo(() => new ParticlePool(320, style === 'penguin'), [style]);
  // Idle life (penguins): what each animal does when nothing is asked of it.
  const brains = useMemo(() => [new IdleBrain(11, 0), new IdleBrain(11, 1)], [model]);
  const spots = useMemo<Spots | null>(() => {
    if (style !== 'penguin') return null;
    const p = polarSpots(model);
    return { bucket: [p.bucket.x, p.bucket.z], hole: [p.hole.x, p.hole.z], igloo: { door: p.igloo.door, approach: p.igloo.approach, center: p.igloo.center } };
  }, [model, style]);
  const roam = useRef({ freeFor: 0, last: 0, k: -1, keepOut: null as Box | null, area: { minX: -4, maxX: 4, minZ: 0, maxZ: 3 } as Box });
  const fidget = useRef<{ act: IdleAct; start: number; next: number }[]>([
    { act: 'none', start: 0, next: 5 },
    { act: 'none', start: 0, next: 8.5 },
  ]);
  const confetti = useMemo(() => CONFETTI[style].map((c) => new Color(c)), [style]);
  const clickedAt = useRef<number[]>(rigs.map(() => -10));
  const hovered = useRef(-1);
  const lastText = useRef<string[]>(['', '']);

  // Speech bubbles: plain DOM over the canvas, placed by projecting each animal's head every frame.
  const bubbles = useMemo<HTMLDivElement[]>(() => {
    if (typeof document === 'undefined') return [];
    return rigs.map(() => {
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
  }, [rigs, model.palette]);
  useEffect(() => {
    const host = gl.domElement.parentElement;
    if (!host) return undefined;
    bubbles.forEach((b) => host.appendChild(b));
    return () => bubbles.forEach((b) => b.remove());
  }, [bubbles, gl]);

  useEffect(() => {
    holders.forEach((h, i) => h.add(rigs[i].root));
    return () => holders.forEach((h, i) => h.remove(rigs[i].root));
  }, [holders, rigs]);

  useEffect(
    () =>
      driver.register((sample: StageSample) => {
        sampleCast(model, style, sample.k, sample.tau, sample.duration, sample, cast, calm);
        const now = clock.now;
        const wall = performance.now() / 1000;
        const rest = model.rest(sample.k);
        const floor = model.floorY;
        const { camera, size } = get();
        pool.begin();

        // Idle life: while the run rests, the crew roams; the moment it moves again they are back at their stations.
        const r = roam.current;
        const dt = r.last > 0 ? Math.min(0.1, wall - r.last) : 0;
        r.last = wall;
        const playing = playhead.getSnapshot().playing;
        const settled = sample.k === 0 || sample.tau >= sample.duration - 1e-3;
        const rested = !playing && settled && style === 'penguin' && !calm;
        r.freeFor = rested ? r.freeFor + dt : 0;
        if (r.k !== sample.k) {
          r.k = sample.k;
          r.keepOut = obstacleBox(model, rest);
          const f = model.footprint();
          const front = (r.keepOut?.maxZ ?? f.maxZ) + 0.95;
          r.area = { minX: f.minX - 2.6, maxX: f.maxX + 2.6, minZ: front, maxZ: front + 2.4 };
        }
        const idleOut = brains.map((brain, i) => {
          const m = cast[i];
          if (style !== 'penguin' || calm) return null;
          const cheering = m.pose === 'cheer' && m.poseTime < 2.8 && m.poseWeight > 0.3;
          const ctx: IdleContext = {
            free: rested && !cheering && !m.scripted,
            freeFor: r.freeFor,
            home: { x: m.x, z: m.z, yaw: m.yaw },
            keepOut: r.keepOut,
            area: r.area,
            spots,
            far: r.freeFor > 5,
            partner: brains[1 - i],
            radius: 3.2,
          };
          return brain.update(dt, ctx);
        });
        for (let i = 0; i < cast.length; i++) {
          const m: CastMember = cast[i];
          const holder = holders[i];
          // Roaming: the animal's own business takes over from the script's station.
          const roamed = idleOut[i];
          let idleAct: IdleAct = 'none';
          let idleT = 0;
          let idleW = 0;
          let fish = 0;
          if (roamed && roamed.away) {
            m.x = roamed.x;
            m.z = roamed.z;
            m.yaw = roamed.yaw;
            m.gait = roamed.gait;
            m.gaitPhase = roamed.gaitPhase;
            m.gaitWeight = roamed.gaitWeight;
            m.pose = 'idle';
            m.poseWeight = 1;
            m.prevWeight = 0;
            m.active = false;
            m.target = -1;
            m.effort = 0;
            m.y = roamed.gait === 'walk' ? Math.abs(Math.sin(roamed.gaitPhase)) * 0.035 * roamed.gaitWeight : 0;
            m.look[0] = m.x + Math.sin(m.yaw) * 3;
            m.look[1] = floor + 0.6;
            m.look[2] = m.z + Math.cos(m.yaw) * 3;
            idleAct = roamed.act;
            idleT = roamed.actT;
            idleW = roamed.actWeight;
            fish = roamed.fish;
            holders[i].visible = roamed.hide < 0.5;
            if (roamed.splash) clock.fishAt = wall;
          } else {
            holders[i].visible = true;
            // At the station, between steps' work: a look about, a preen, a shake, now and then.
            const fd = fidget.current[i];
            if (!calm && style === 'penguin' && !m.active && !m.scripted && m.pose === 'idle' && !playing) {
              /* the brain is in charge while the run rests */
            } else if (!calm && style === 'penguin' && !m.active && !m.scripted && m.pose === 'idle') {
              if (fd.act === 'none' && now > fd.next) {
                fd.act = (['look', 'look', 'preen', 'sniff', 'shake'] as IdleAct[])[Math.floor(hash(now, i + 5) * 5)];
                fd.start = now;
              }
              if (fd.act !== 'none') {
                const dur = fd.act === 'look' ? 4.2 : fd.act === 'preen' ? 3.2 : fd.act === 'shake' ? 1.1 : 2.4;
                if (now - fd.start > dur) {
                  fd.act = 'none';
                  fd.next = now + 5 + hash(now, i + 9) * 8;
                } else {
                  idleAct = fd.act;
                  idleT = now - fd.start;
                  idleW = Math.min(1, idleT / 0.25) * Math.min(1, (dur - idleT) / 0.3);
                }
              }
            } else {
              fd.act = 'none';
              fd.next = now + 4 + hash(now, i + 3) * 5;
            }
          }
          holder.position.set(m.x, floor + m.y, m.z);
          holder.rotation.y = m.yaw;
          const dx = m.look[0] - m.x;
          const dz = m.look[2] - m.z;
          const c = Math.cos(m.yaw), s = Math.sin(m.yaw);
          const react = performance.now() / 1000 - clickedAt.current[i];
          rigs[i].update({
            gait: m.gait,
            gaitPhase: m.gaitPhase,
            gaitWeight: m.gaitWeight,
            pose: m.pose,
            poseWeight: m.poseWeight,
            poseTime: m.poseTime,
            prevPose: m.prevPose,
            prevWeight: m.prevWeight,
            lookLocal: [dx * c - dz * s, m.look[1] - floor - m.y, dx * s + dz * c],
            react: react < 1.2 ? react : -1,
            time: now,
            seed: i * 1.7 + 0.3,
            idle: idleW > 0 ? { act: idleAct, t: idleT, weight: idleW } : undefined,
            fish,
            effort: m.effort,
            climb: m.gait === 'climb' ? { weight: m.gaitWeight, phase: m.gaitPhase, slope: m.climbSlope } : undefined,
          });

          // The rope the animal climbs, and the ledge it perches on.
          const rope = gear.ropes[i];
          rope.visible = m.rope > 0.02;
          if (rope.visible) {
            const len = Math.max(0.05, m.ropeTop * m.rope);
            rope.scale.set(1, len, 1);
            rope.position.set(m.ropeX, floor + m.ropeTop - len / 2, m.ropeZ);
          }
          const perched = m.y > 0.3 && m.gait !== 'climb' && m.gait !== 'leap' && m.gaitWeight < 0.5;
          gear.ledgeW[i] += ((perched ? 1 : 0) - gear.ledgeW[i]) * Math.min(1, dt * 9 + (perched ? 0 : 0.2));
          const ledge = gear.ledges[i];
          ledge.visible = gear.ledgeW[i] > 0.03;
          if (ledge.visible) {
            ledge.position.set(m.x, floor + m.y - 0.045, m.z);
            ledge.scale.setScalar(gear.ledgeW[i]);
          }
          if (react < 1.2) invalidate();

          const lift = holder.position.y - floor + rigs[i].root.position.y;
          const sh = shadows[i].mesh;
          sh.position.set(m.x, floor + 0.004, m.z);
          const spread = (style === 'panda' ? 0.86 : 0.68) * CREW_SCALE[style] * (1 + (m.gait === 'glide' ? m.gaitWeight * 0.55 : 0)) * (1 / (1 + lift * 1.6));
          sh.scale.set(spread, spread, 1);

          // Speech bubble: what this one is doing, while it does it (or its name, when clicked / hovered).
          let text = '';
          const value = m.target >= 0 && rest.present[m.target] ? rest.text[m.target] : '';
          const settled = m.target >= 0 && rest.state[m.target] === 'SUCCESS';
          if (react < 1.6) text = `I'm ${names[i]}!`;
          else if (hovered.current === i) {
            const where = m.target >= 0 ? model.slots[m.target].structure : undefined;
            const caption = m.target >= 0 ? rest.caption[m.target] : '';
            const cell = where ? (/^\d+$/.test(caption) ? `${where}[${caption}]` : where) : '';
            text = `${names[i]} · ${VERBS[m.pose]}${cell ? ` ${cell}` : ''}${m.target >= 0 && rest.present[m.target] ? ` (${STATE_TREATMENTS[rest.state[m.target]].word})` : ''}`;
          } else if (m.active && !m.scripted && m.poseWeight > 0.6 && m.poseTime < 2.2) text = bubbleFor(m.pose, style, value, settled);
          else if (m.scripted && (m.gait === 'push' || m.gait === 'pull') && m.gaitWeight > 0.5) text = bubbleFor(m.pose, style, value, settled);
          const el = bubbles[i];
          if (el) {
            _head.set(m.x, floor + m.y + rigs[i].root.position.y + HEAD[style] + 0.12, m.z).project(camera);
            const visible = text !== '' && _head.z < 1;
            if (text !== lastText.current[i]) {
              el.textContent = text;
              lastText.current[i] = text;
            }
            el.style.opacity = visible ? '1' : '0';
            const px = (_head.x * 0.5 + 0.5) * size.width;
            const py = (-_head.y * 0.5 + 0.5) * size.height;
            el.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(-50%, -100%)`;
          }

          // Celebration: confetti (ice sparkles / leaves and petals) bursting up and drifting down.
          if (!calm && m.pose === 'cheer' && m.poseWeight > 0.2 && m.poseTime < 2.4) {
            const t = m.poseTime;
            for (let p = 0; p < 26; p++) {
              const a = hash(i + 3, p) * Math.PI * 2;
              const v = 0.9 + hash(i + 7, p) * 1.3;
              const up = 2.2 + hash(i + 11, p) * 1.6;
              const life = 1.4 + hash(i + 13, p) * 1.0;
              const tt = t - hash(i + 17, p) * 0.25;
              if (tt < 0 || tt > life) continue;
              const x = m.x + Math.cos(a) * v * tt * 0.6;
              const z = m.z + Math.sin(a) * v * tt * 0.6;
              const y = floor + 0.75 + up * tt - 2.6 * tt * tt;
              if (y < floor) continue;
              const col = confetti[p % confetti.length];
              pool.add(x, y, z, col.r, col.g, col.b, (1 - tt / life) * 0.95, 0.07 + hash(i + 19, p) * 0.05);
            }
          }
          // A belly slide throws up a spray of snow behind.
          if (!calm && m.gait === 'glide' && m.gaitWeight > 0.2) {
            const back = m.yaw + Math.PI;
            for (let p = 0; p < 40; p++) {
              const f = (m.gaitPhase * 7 + hash(i, p)) % 1;
              const spread = (hash(i + 5, p) - 0.5) * 1.6;
              const d = 0.45 + f * 1.2;
              const x = m.x + Math.sin(back + spread * 0.5) * d;
              const z = m.z + Math.cos(back + spread * 0.5) * d;
              const y = floor + 0.05 + Math.sin(f * Math.PI) * 0.38 * (0.5 + hash(i + 9, p));
              pool.add(x, y, z, 0.92, 0.97, 1, (1 - f) * 0.95 * m.gaitWeight, 0.08 + 0.09 * (1 - f));
            }
          }
          // Pushing: little puffs kicked up at the feet as they dig in.
          if (!calm && m.pose === 'push' && m.poseWeight > 0.4 && m.poseTime < 1.4) {
            const dust = style === 'penguin' ? [0.9, 0.95, 1] : [0.78, 0.7, 0.52];
            for (let p = 0; p < 14; p++) {
              const f = (m.poseTime * 1.6 + hash(i + 21, p)) % 1;
              const a = m.yaw + Math.PI + (hash(i + 23, p) - 0.5) * 2.2;
              const d = 0.18 + f * 0.45;
              pool.add(m.x + Math.sin(a) * d, floor + 0.03 + f * 0.18, m.z + Math.cos(a) * d, dust[0], dust[1], dust[2], (1 - f) * 0.55 * m.poseWeight, 0.06 + f * 0.06);
            }
          }
          // A roll kicks up a few leaves.
          if (!calm && m.gait === 'roll' && m.gaitWeight > 0.2) {
            for (let p = 0; p < 10; p++) {
              const f = (m.gaitPhase / (Math.PI * 2) + hash(i, p)) % 1;
              const back = m.yaw + Math.PI + (hash(i + 2, p) - 0.5) * 1.4;
              const d = 0.3 + f * 0.6;
              const col = confetti[p % 2 === 0 ? 0 : 3];
              pool.add(m.x + Math.sin(back) * d, floor + 0.05 + Math.sin(f * Math.PI) * 0.3, m.z + Math.cos(back) * d, col.r, col.g, col.b, (1 - f) * 0.85, 0.06);
            }
          }
        }
        // The eagle: in for the ball the penguin has made, over to its place, away again.
        if (eagle) {
          const f = sample.duration > 0 ? sample.tau / sample.duration : 1;
          eagleAt(model, sample.k, f, eg0);
          if (eg0.visible && !calm) {
            eagleAt(model, sample.k, f + 0.02, eg1);
            const dx = eg1.x - eg0.x, dy = eg1.y - eg0.y, dz = eg1.z - eg0.z;
            const run = Math.max(1e-4, Math.hypot(dx, dz));
            const pitch = Math.max(-0.7, Math.min(0.7, Math.atan2(dy, run) * 0.8));
            const turn = Math.atan2(Math.sin(eg1.yaw - eg0.yaw), Math.cos(eg1.yaw - eg0.yaw));
            eagle.holder.visible = true;
            eagle.holder.position.set(eg0.x, eg0.y, eg0.z);
            eagle.holder.rotation.y = eg0.yaw;
            eagle.rig.update({ clock: eg0.clock, flap: eg0.flap, holding: eg0.holding, pitch, bank: Math.max(-0.5, Math.min(0.5, -turn * 6)) });
            const height = Math.max(0, eg0.y - floor);
            eagle.shadow.mesh.visible = true;
            eagle.shadow.mesh.position.set(eg0.x, floor + 0.006, eg0.z);
            const spread = 1.5 / (1 + height * 0.35);
            eagle.shadow.mesh.scale.set(spread, spread, 1);
          } else {
            eagle.holder.visible = false;
            eagle.shadow.mesh.visible = false;
          }
        }

        // Ice physics: shavings thrown up where a block is shoved off, scraped along, and brought to rest.
        if (!calm && style === 'penguin') {
          const motion = iceMotionAt(model, sample.k);
          if (motion) {
            const f = sample.duration > 0 ? sample.tau / sample.duration : 1;
            for (const job of motion.jobs) {
              blockAt(job, f, scratch);
              const speed = Math.hypot(scratch.vx, scratch.vz);
              if (speed < 1.2) continue;
              const s3 = job.slot * 3;
              const hw = sample.dims[s3] / 2;
              const fade = Math.min(1, speed / 6) * sample.presence[job.slot];
              const ux = scratch.vx / speed, uz = scratch.vz / speed;
              for (let p = 0; p < 9; p++) {
                const life = (now * 2.6 + hash(job.slot + 31, p)) % 1;
                const lateral = (hash(job.slot + 37, p) - 0.5) * 1.1 * hw * 2;
                const back = hw * 0.9 + life * 0.7;
                const x = scratch.x - ux * back - uz * lateral;
                const z = scratch.z - uz * back + ux * lateral;
                const y = floor + 0.04 + Math.sin(life * Math.PI) * 0.22 * (0.4 + hash(job.slot + 41, p));
                pool.add(x, y, z, 0.92, 0.97, 1, (1 - life) * 0.8 * fade, 0.06 + 0.07 * (1 - life));
              }
            }
          }
        }
        pool.end();
      }),
    [driver, model, style, cast, holders, bubbles, get, rigs, shadows, pool, confetti, calm, clock, names, invalidate, playhead, brains, spots, gear, eagle],
  );

  useEffect(
    () => () => {
      rigs.forEach((r) => r.dispose());
      shadows.forEach((s) => s.dispose());
    },
    [rigs, shadows],
  );
  useEffect(() => () => pool.dispose(), [pool]);
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
      {eagle && <primitive object={eagle.holder} />}
      {eagle && <primitive object={eagle.shadow.mesh} />}
      {gear.ropes.map((r, i) => (
        <primitive key={`r${i}`} object={r} />
      ))}
      {gear.ledges.map((l, i) => (
        <primitive key={`l${i}`} object={l} />
      ))}
      <primitive object={pool.points} />
    </>
  );
}
