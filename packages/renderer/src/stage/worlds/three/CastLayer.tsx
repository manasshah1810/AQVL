import React, { useEffect, useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Color, Group, Vector3 } from 'three';
import type { StageModel } from '../../model/StageModel';
import type { StageSample } from '../../model/sampler';
import type { StageDriver } from '../../three/driver';
import { STATE_TREATMENTS } from '../../look/treatments';
import { createCast, sampleCast, type CastMember, type CastPose, type CastStyle } from '../cast';
import { WORLDS } from '../types';
import { buildPanda, buildPenguin, createBlobShadow, type Rig } from './rigs';
import { ParticlePool, hash } from './particles';

export interface CastLayerProps {
  model: StageModel;
  driver: StageDriver;
  style: CastStyle;
  calm: boolean;
  /** Ambient clock (seconds), shared with the world so everything breathes together. */
  clock: { now: number };
}

const VERBS: Record<CastPose, string> = {
  idle: 'waiting',
  inspect: 'comparing',
  push: 'swapping',
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
const CREW_SCALE = { penguin: 1.4, panda: 1.32 } as const;
/** Head height of the scaled crew, where the bubble sits beside them. */
const HEAD = { penguin: 0.98, panda: 1.08 } as const;

const _head = new Vector3();

const CONFETTI: Record<CastStyle, string[]> = {
  penguin: ['#e9f6ff', '#9fdcff', '#7af0c8', '#ffffff'],
  panda: ['#8cc152', '#f4b6c2', '#ffe08a', '#b8e07a'],
};

/**
 * The crew: two animals sampled with the bodies every frame (see cast.ts),
 * with soft shadows, a speech bubble, and celebratory particles. Click one
 * and it hops (penguin) or rolls (panda) and says its name.
 */
export function CastLayer({ model, driver, style, calm, clock }: CastLayerProps) {
  const invalidate = useThree((s) => s.invalidate);
  const get = useThree((s) => s.get);
  const gl = useThree((s) => s.gl);
  const names = WORLDS[style].crew;
  const cast = useMemo(() => createCast(), []);
  const rigs = useMemo<Rig[]>(
    () =>
      style === 'penguin'
        ? [buildPenguin({ scarf: ['#c8406a', '#f6e7d2'], scale: CREW_SCALE.penguin }), buildPenguin({ scarf: ['#2f5d9e', '#f2c14e'], scale: CREW_SCALE.penguin })]
        : [buildPanda({ prop: 'bamboo', scale: CREW_SCALE.panda }), buildPanda({ prop: 'leaf', scale: CREW_SCALE.panda })],
    [style],
  );
  const holders = useMemo(() => rigs.map(() => new Group()), [rigs]);
  const shadows = useMemo(() => rigs.map(() => createBlobShadow(model.palette.shadow, model.palette.shadowOpacity * 0.85)), [rigs, model.palette]);
  const pool = useMemo(() => new ParticlePool(160, style === 'penguin'), [style]);
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
        const rest = model.rest(sample.k);
        const floor = model.floorY;
        const { camera, size } = get();
        pool.begin();
        for (let i = 0; i < cast.length; i++) {
          const m: CastMember = cast[i];
          const holder = holders[i];
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
            lookLocal: [dx * c - dz * s, m.look[1] - floor, dx * s + dz * c],
            react: react < 1.2 ? react : -1,
            time: now,
            seed: i * 1.7 + 0.3,
          });
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
          } else if (m.active && m.poseWeight > 0.6 && m.poseTime < 2.2) text = bubbleFor(m.pose, style, value, settled);
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
        pool.end();
      }),
    [driver, model, style, cast, holders, bubbles, get, rigs, shadows, pool, confetti, calm, clock, names, invalidate],
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
      <primitive object={pool.points} />
    </>
  );
}
