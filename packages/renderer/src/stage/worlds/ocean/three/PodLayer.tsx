import React, { useEffect, useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  Euler,
} from 'three';
import type { StageModel } from '../../../model/StageModel';
import type { StageSample } from '../../../model/sampler';
import type { StageDriver } from '../../../three/driver';
import { STATE_TREATMENTS } from '../../../look/treatments';
import type { Playhead } from '../../../timeline/Playhead';
import { WORLDS } from '../../types';
import type { WorldClock } from '../../three/WorldLayer';
import { hash } from '../../three/particles';
import { createPod, samplePod, wrapAngle, type PodMood, type Swimmer } from '../pod';
import { haulAt, waterMotionAt, type HaulPose } from '../water';
import { buildPodRigs, type WhaleRig } from './whale';
import { BubblePool } from './bubbles';
import { reefSpots } from './ReefWorld';
import { roamPose, trickAt, type RoamPose } from '../roam';

interface OceanDebug {
  pod?: { x: number; y: number; z: number; yaw: number; mood: PodMood; contact: number }[];
  camera?: { position: number[]; target: number[] } | ((pod: NonNullable<OceanDebug['pod']>) => { position: number[]; target: number[] } | null);
}

export interface PodLayerProps {
  model: StageModel;
  driver: StageDriver;
  calm: boolean;
  clock: WorldClock;
  playhead: Playhead;
}

const VERBS: Record<PodMood, string> = {
  hover: 'watching',
  compare: 'comparing',
  match: 'matching',
  push: 'moving',
  blow: 'making',
  farewell: 'removing',
  tap: 'writing',
  visit: 'visiting',
  shake: 'ruling out',
  happy: 'pleased',
  celebrate: 'celebrating',
  confused: 'puzzled',
  escort: 'helping',
};

/** What a swimmer says, in a small round bubble, while it acts out a step (short: the scene says the rest). */
function bubbleFor(m: Swimmer, who: number, value: string, sorted: boolean): string {
  switch (m.mood) {
    case 'compare':
      return '?';
    case 'match':
      return 'same!';
    case 'push':
      return m.contact > 0.4 ? (who === 0 ? 'heave…' : 'hup!') : '';
    case 'blow':
      return 'pop!';
    case 'farewell':
      return 'bye!';
    case 'tap':
      return value !== '' && value.length <= 4 ? `=${value}` : '!';
    case 'visit':
      return who === 0 ? '…' : '';
    case 'shake':
      return 'nope';
    case 'happy':
      return who === 0 ? '♪' : '';
    case 'celebrate':
      return who === 0 ? (sorted ? 'sorted!' : 'done!') : 'yay!';
    case 'confused':
      return '…?';
    default:
      return '';
  }
}

const _v = new Vector3();
const _m = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const _e = new Euler(0, 0, 0, 'YXZ');
const _hp: HaulPose = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, speed: 0, s: 0, lean: 0, presence: 1 };
const _roam: RoamPose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, speed: 0 };

/** Floating nodes ride the water: a slow bob and a little sway (never for a node on the seabed, never in calm mode). */
function buoy(model: StageModel, sample: StageSample, now: number, hauled: Set<number>): void {
  const n = sample.nodeCount;
  const dx = new Float32Array(n);
  const dy = new Float32Array(n);
  for (let s = 0; s < n; s++) {
    if (sample.presence[s] < 0.01 || hauled.has(s)) continue;
    const bottom = sample.pos[s * 3 + 1] - sample.dims[s * 3 + 1] / 2 - model.floorY;
    const free = Math.min(1, Math.max(0, (bottom - 0.45) / 0.6));
    if (free <= 0) continue;
    dy[s] = (Math.sin(now * 0.75 + s * 1.71) * 0.05 + Math.sin(now * 0.31 + s * 0.6) * 0.025) * free;
    dx[s] = Math.sin(now * 0.37 + s * 2.3) * 0.025 * free;
    sample.pos[s * 3] += dx[s];
    sample.pos[s * 3 + 1] += dy[s];
  }
  // Edges ride with their ends, and hang a little like lines in water (a slight sag, swaying with the current).
  const rest = model.rest(sample.k);
  const before = sample.k > 0 ? model.rest(sample.k - 1) : rest;
  for (let e = 0; e < sample.edgeCount; e++) {
    if (sample.edgeVisible[e] <= 0.002) continue;
    const r = rest.edgePresent[e] ? rest : before;
    const a = r.edgeFrom[e], b = r.edgeTo[e];
    if (a < 0 || b < 0) continue;
    const i3 = e * 3;
    sample.edgeP0[i3] += dx[a];
    sample.edgeP0[i3 + 1] += dy[a];
    sample.edgeP1[i3] += dx[b];
    sample.edgeP1[i3 + 1] += dy[b];
    const len = Math.hypot(sample.edgeP1[i3] - sample.edgeP0[i3], sample.edgeP1[i3 + 1] - sample.edgeP0[i3 + 1], sample.edgeP1[i3 + 2] - sample.edgeP0[i3 + 2]);
    const sag = a === b ? 0 : Math.min(0.22, len * 0.07);
    sample.edgeCtrl[i3] += (dx[a] + dx[b]) / 2 + Math.sin(now * 0.6 + e * 1.3) * 0.04 * Math.min(1, len / 2);
    sample.edgeCtrl[i3 + 1] += (dy[a] + dy[b]) / 2 - sag;
    sample.edgeCtrl[i3 + 2] += Math.cos(now * 0.5 + e) * 0.03 * Math.min(1, len / 2);
  }
}

/** The lantern jelly's glow: a soft additive sprite-like sphere. */
function glowMaterial(color: string): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uColor: { value: new Color(color) }, uStrength: { value: 1 } },
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vV = -mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uStrength; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(max(dot(normalize(vN), normalize(vV)), 0.0), 2.0); gl_FragColor = vec4(uColor * f * uStrength, f * uStrength); }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
}

/**
 * The pod in the scene: the whale and her calf (see pod.ts for where they go
 * and why), rendered with breath, tail beats and moods; bubbles from the
 * blowhole and the wake, silt where a block touches down; little fish that
 * swim along an edge when a step travels it; a lantern jelly that drifts over
 * to whatever the step is about. When the run rests, the pod roams the reef;
 * the moment it plays again they swim back to work. Click a whale and it
 * rolls and says its name.
 */
export function PodLayer({ model, driver, calm, clock, playhead }: PodLayerProps) {
  const invalidate = useThree((s) => s.invalidate);
  const get = useThree((s) => s.get);
  const gl = useThree((s) => s.gl);
  const names = WORLDS.ocean.crew;
  const pod = useMemo(() => createPod(), []);
  const rigs = useMemo<WhaleRig[]>(() => buildPodRigs(), []);
  const spots = useMemo(() => reefSpots(model), [model]);
  // A run that swaps things about is a sort: its finale is cheered as such.
  const sorting = useMemo(() => model.frames.some((f) => f.event.kind === 'swap'), [model]);
  const pool = useMemo(() => new BubblePool(520), []);
  const clickedAt = useRef<number[]>([-10, -10]);
  const hovered = useRef(-1);
  const lastText = useRef<string[]>(['', '']);
  const state = useRef({
    last: 0,
    freeFor: 0,
    roam: 0,
    prev: [new Vector3(), new Vector3()],
    has: false,
    yaw: [0, 0],
    pitch: [0, 0],
    turn: [0, 0],
    climb: [0, 0],
    speed: [0, 0],
    lantern: new Vector3(),
    lanternOn: 0,
    k: -1,
    landed: new Map<number, number>(),
  });

  // Messenger fish: little fish that swim along an edge while a step travels it.
  const messengers = useMemo(() => {
    const geo = new SphereGeometry(1, 10, 7);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i);
      const t = 1 - Math.max(0, -z) * 0.75;
      p.setXYZ(i, p.getX(i) * 0.05 * t, p.getY(i) * 0.075 * t, z * 0.16);
    }
    geo.computeVertexNormals();
    const mat = new MeshStandardMaterial({ color: '#ffe27a', roughness: 0.35, emissive: new Color('#ffb648'), emissiveIntensity: 0.6 });
    const mesh = new InstancedMesh(geo, mat, 12);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    return { mesh, geo, mat };
  }, []);
  useEffect(
    () => () => {
      messengers.geo.dispose();
      messengers.mat.dispose();
      messengers.mesh.dispose();
    },
    [messengers],
  );

  // The lantern jelly: small, glowing, it hangs above the node the step is about and lights it softly.
  const lantern = useMemo(() => {
    const group = new Group();
    const bellMat = glowMaterial('#ffe9a8');
    const bell = new Mesh(new SphereGeometry(0.16, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), bellMat);
    const haloMat = glowMaterial('#ffd36b');
    haloMat.uniforms.uStrength.value = 0.35;
    const halo = new Mesh(new SphereGeometry(0.42, 18, 12), haloMat);
    const light = new PointLight('#ffe2a0', 0, 4.5, 1.6);
    group.add(bell, halo, light);
    group.traverse((o) => (o.frustumCulled = false));
    group.renderOrder = 8;
    return { group, bell, bellMat, halo, haloMat, light };
  }, []);
  useEffect(
    () => () => {
      lantern.bell.geometry.dispose();
      lantern.halo.geometry.dispose();
      lantern.bellMat.dispose();
      lantern.haloMat.dispose();
    },
    [lantern],
  );

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
        padding: '5px 10px 6px',
        borderRadius: '999px',
        background: 'radial-gradient(120% 140% at 30% 20%, rgba(255,255,255,0.32), rgba(15,65,87,0.9) 55%)',
        border: '1px solid rgba(190, 245, 255, 0.55)',
        color: model.palette.frameText,
        boxShadow: '0 6px 18px rgba(0,20,30,0.3), inset 0 0 8px rgba(190,245,255,0.25)',
        opacity: '0',
        pointerEvents: 'none',
        zIndex: '5',
        transition: 'opacity 160ms ease',
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

  useEffect(
    () =>
      driver.register((sample: StageSample) => {
        const now = clock.now;
        const wall = performance.now() / 1000;
        const st = state.current;
        // Frame time (clamped, for smoothing) and wall time (for how long things have rested: right even at a low frame rate).
        const wallDt = st.last > 0 ? Math.min(1, wall - st.last) : 0;
        const dt = Math.min(0.1, wallDt);
        st.last = wall;
        const f = sample.duration > 0 ? Math.min(1, sample.tau / sample.duration) : 1;
        const water = calm ? null : waterMotionAt(model, sample.k);
        const hauled = new Set<number>();
        if (water) for (const h of water.hauls) if (f < 1) hauled.add(h.slot);
        if (!calm) buoy(model, sample, now, hauled);

        samplePod(model, sample.k, sample.tau, sample.duration, sample, pod, calm);

        // Idle life: while the run rests the pod roams the reef; when it plays again they return to their stations.
        const playing = playhead.getSnapshot().playing;
        const settled = sample.k === 0 || sample.tau >= sample.duration - 1e-3;
        const rested = !playing && settled && !calm;
        st.freeFor = rested ? st.freeFor + wallDt : 0;
        const celebrating = pod[0].mood === 'celebrate' && st.freeFor < 3;
        const wantRoam = rested && st.freeFor > 2.4 && !celebrating ? 1 : 0;
        st.roam += (wantRoam - st.roam) * Math.min(1, Math.min(0.25, wallDt) * (wantRoam ? 0.7 : 2.2));
        if (st.roam < 0.002) st.roam = 0;
        const roamW = st.roam * st.roam * (3 - 2 * st.roam);

        const { camera, size } = get();
        const rest = model.rest(sample.k);
        pool.begin();
        for (let i = 0; i < pod.length; i++) {
          const m = pod[i];
          const rig = rigs[i];
          let x = m.x, y = m.y, z = m.z, yaw = m.yaw, pitch = m.pitch;
          // Hovering in place is never perfectly still: a slow drift (not while the nose is on a node).
          const free = 1 - m.contact;
          if (!calm) {
            y += Math.sin(now * 0.7 + i * 2.1) * 0.06 * free;
            x += Math.sin(now * 0.43 + i) * 0.04 * free;
            z += Math.sin(now * 0.29 + i * 1.3) * 0.03 * free;
          }
          let trick = { kind: 'none' as 'none' | 'roll' | 'spyhop' | 'loop' | 'nod', t: 0, weight: 0 };
          if (roamW > 0) {
            roamPose(spots.area, now, i, _roam);
            x += (_roam.x - x) * roamW;
            y += (_roam.y - y) * roamW;
            z += (_roam.z - z) * roamW;
            yaw = yaw + wrapAngle(_roam.yaw - yaw) * roamW;
            pitch += (_roam.pitch - pitch) * roamW;
            const tr = trickAt(now, i);
            trick = { kind: tr.kind, t: tr.t, weight: tr.weight * roamW };
          }
          // How fast it moves and turns (from frame to frame), smoothed: the body bends and the flukes beat with it.
          const prev = st.prev[i];
          let speed = m.speed;
          if (st.has && dt > 0) {
            const v = Math.hypot(x - prev.x, y - prev.y, z - prev.z) / dt;
            speed = Math.max(m.speed * (1 - roamW), v);
            const turn = wrapAngle(yaw - st.yaw[i]) / dt;
            const climb = (pitch - st.pitch[i]) / dt;
            st.turn[i] += (Math.max(-3, Math.min(3, turn)) - st.turn[i]) * Math.min(1, dt * 6);
            st.climb[i] += (Math.max(-3, Math.min(3, climb)) - st.climb[i]) * Math.min(1, dt * 6);
          }
          st.speed[i] += (Math.min(8, speed) - st.speed[i]) * Math.min(1, dt * 5 + (st.has ? 0 : 1));
          prev.set(x, y, z);
          st.yaw[i] = yaw;
          st.pitch[i] = pitch;
          const bank = Math.max(-0.45, Math.min(0.45, -st.turn[i] * 0.16));
          // Resting a moment between steps (before it wanders off), it turns a little to look at the viewer.
          const curious = rested && !calm ? Math.min(1, Math.max(0, (st.freeFor - 0.9) / 0.8)) * (1 - roamW) * (1 - m.contact) : 0;
          if (curious > 0) {
            const toCam = Math.atan2(camera.position.x - x, camera.position.z - z);
            yaw = yaw + wrapAngle(toCam - yaw) * 0.22 * curious * (i === 0 ? 1 : 1.4);
          }
          rig.root.position.set(x, y, z);
          rig.root.rotation.set(-pitch, yaw, m.roll * (1 - roamW) + bank * roamW + (roamW < 1 ? bank * 0.4 * (1 - roamW) : 0));
          rig.root.updateMatrixWorld();
          _v.set(m.look[0], m.look[1], m.look[2]);
          if (curious > 0.5) _v.copy(camera.position);
          if (roamW > 0.5) _v.set(x + Math.sin(yaw) * 4, y, z + Math.cos(yaw) * 4);
          rig.root.worldToLocal(_v);
          const react = wall - clickedAt.current[i];
          rig.update({
            time: now,
            speed: st.speed[i],
            effort: m.contact,
            turn: st.turn[i],
            climb: st.climb[i],
            look: [_v.x, _v.y, _v.z],
            mood: roamW > 0.5 ? 'hover' : m.mood,
            moodTime: m.moodTime,
            moodWeight: m.moodWeight * (1 - roamW),
            blow: m.blow,
            react: react < 1.6 ? react : -1,
            roam: roamW,
            trick,
          });
          if (react < 1.6) invalidate();
          const c = clock.crew[i];
          c.x = x;
          c.y = y;
          c.z = z;
          c.speed = st.speed[i];

          if (!calm) {
            // Breath: every so often a few bubbles rise from the blowhole (a stream while roaming now and then).
            const hole = _v.copy(rig.blowhole).applyMatrix4(rig.root.matrixWorld);
            const hx = hole.x, hy = hole.y, hz = hole.z;
            const period = i === 0 ? 7.5 : 5.2;
            const since = (now + i * 2.7) % period;
            const stream = trick.kind === 'loop' ? trick.weight : 0;
            for (let p = 0; p < 10; p++) {
              const tt = since - p * 0.09;
              if (tt < 0 || tt > 2.6) continue;
              pool.bubble(hx + Math.sin(tt * 5 + p) * 0.06, hy + tt * (0.55 + hash(p, i) * 0.3) + tt * tt * 0.12, hz + Math.cos(tt * 4 + p) * 0.06, (1 - tt / 2.6) * 0.85, (i === 0 ? 0.07 : 0.045) + hash(p, i + 3) * 0.04);
            }
            if (stream > 0.1) {
              for (let p = 0; p < 16; p++) {
                const tt = (now * 0.9 + hash(p, 9)) % 1.8;
                pool.bubble(hx + Math.sin(tt * 6 + p) * 0.08, hy + tt * 0.9, hz, (1 - tt / 1.8) * stream, 0.05 + hash(p, 10) * 0.05);
              }
            }
            // The wake: bubbles shed from the flukes when it swims hard or pushes.
            const tail = _v.copy(rig.tail).applyMatrix4(rig.root.matrixWorld);
            const wake = Math.min(1, Math.max(0, (st.speed[i] - 1.2) / 3) + m.contact * 0.8);
            if (wake > 0.05) {
              for (let p = 0; p < 14; p++) {
                const tt = (now * 1.4 + hash(p, i + 20)) % 1.2;
                pool.bubble(tail.x + (hash(p, 21) - 0.5) * 0.5, tail.y + tt * 0.5 + (hash(p, 22) - 0.5) * 0.3, tail.z + (hash(p, 23) - 0.5) * 0.5, (1 - tt / 1.2) * 0.7 * wake, 0.035 + hash(p, 24) * 0.04);
              }
            }
            // Blowing a node: a stream of bubbles from the mouth gathering where the node forms.
            if (m.blow > 0.02 && water) {
              const h = water.hauls.find((hh) => hh.who === i && hh.kind === 'birth');
              const mouth = _v.copy(rig.mouth).applyMatrix4(rig.root.matrixWorld);
              if (h) {
                for (let p = 0; p < 18; p++) {
                  const q = (now * 1.6 + hash(p, 31)) % 1;
                  const tx = h.ctrl[0], ty = h.ctrl[1], tz = h.ctrl[2];
                  const swirl = (1 - q) * 0.35;
                  pool.bubble(mouth.x + (tx - mouth.x) * q + Math.cos(p * 2.4 + now * 3) * swirl, mouth.y + (ty - mouth.y) * q + Math.sin(p * 2.4 + now * 3) * swirl, mouth.z + (tz - mouth.z) * q, m.blow * (0.4 + 0.6 * q), 0.05 + hash(p, 32) * 0.05);
                }
              }
            }
            // Celebrating: a ring of bubbles bursting out round the body.
            if (m.mood === 'celebrate' && m.moodTime < 2.6 && roamW < 0.5) {
              for (let p = 0; p < 26; p++) {
                const a = (p / 26) * Math.PI * 2;
                const tt = m.moodTime - 0.4;
                if (tt < 0) continue;
                const rr = 0.4 + tt * 1.3;
                pool.bubble(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8 + tt * 0.5, z + Math.sin(a * 2) * 0.2, (1 - tt / 2.2) * 0.9, 0.07);
              }
            }
          }

          // Speech bubble: what it is doing, while it does it (or its name, when clicked; a description, when hovered).
          let text = '';
          const value = m.target >= 0 && rest.present[m.target] ? rest.text[m.target] : '';
          if (react < 1.8) text = i === 0 ? `I'm ${names[0]}!` : `${names[1]}!`;
          else if (hovered.current === i) {
            const where = m.target >= 0 ? model.slots[m.target].structure : undefined;
            const caption = m.target >= 0 ? rest.caption[m.target] : '';
            const cell = where ? (/^\d+$/.test(caption) ? `${where}[${caption}]` : where) : '';
            text = `${names[i]} · ${roamW > 0.5 ? 'exploring' : VERBS[m.mood]}${cell && roamW < 0.5 ? ` ${cell}` : ''}${m.target >= 0 && rest.present[m.target] && roamW < 0.5 ? ` (${STATE_TREATMENTS[rest.state[m.target]].word})` : ''}`;
          } else if (roamW < 0.3 && m.active && m.moodWeight > 0.6 && m.moodTime < 2.2 && st.freeFor < 2.2) text = bubbleFor(m, i, value, sorting);
          const el = bubbles[i];
          if (el) {
            const size0 = i === 0 ? 0.75 : 0.45;
            _v.set(x, y + size0 + 0.2, z).project(camera);
            const visible = text !== '' && _v.z < 1;
            if (text !== lastText.current[i]) {
              el.textContent = text;
              lastText.current[i] = text;
            }
            el.style.opacity = visible ? '1' : '0';
            const px = (_v.x * 0.5 + 0.5) * size.width;
            const py = (-_v.y * 0.5 + 0.5) * size.height;
            el.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(-50%, -100%)`;
          }
        }
        st.has = true;

        // Nodes in the water: bubbles shed by a node as it dissolves, silt where one lifts off or touches down on the sand.
        if (water && !calm) {
          for (const h of water.hauls) {
            haulAt(h, f, _hp);
            const D = sample.duration;
            if (h.fade && f > h.fade[0] && f < 1) {
              const q = (f - h.fade[0]) / (h.fade[1] - h.fade[0]);
              for (let p = 0; p < 22; p++) {
                const tt = q - hash(p, h.slot) * 0.5;
                if (tt < 0 || tt > 1) continue;
                pool.bubble(_hp.x + (hash(p, 41) - 0.5) * 0.9 * (1 + tt), _hp.y + (hash(p, 42) - 0.5) * 0.6 + tt * 1.4, _hp.z + (hash(p, 43) - 0.5) * 0.9, (1 - tt) * 0.9, 0.05 + hash(p, 44) * 0.08);
              }
            }
            const puff = (at: number, x0: number, z0: number, strength: number) => {
              const tt = (f - at) * D;
              if (tt < 0 || tt > 1.6) return;
              for (let p = 0; p < 26; p++) {
                const a = hash(p, 51 + h.slot) * Math.PI * 2;
                const v = 0.5 + hash(p, 52) * 0.8;
                const out = 1 - Math.exp(-tt * 3);
                const yy = model.floorY + 0.04 + (0.15 + hash(p, 53) * 0.4) * out;
                pool.puff(x0 + Math.cos(a) * v * out * (0.6 + h.half[0]), yy, z0 + Math.sin(a) * v * out * (0.6 + h.half[2]), 0.64, 0.75, 0.72, (1 - tt / 1.6) * 0.45 * strength, 0.16 + hash(p, 54) * 0.18 + tt * 0.12);
              }
            };
            if (h.liftsOffFloor) puff(h.t0 + 0.02, h.ctrl[0], h.ctrl[2], 0.8);
            if (h.landsOnFloor) puff(Math.min(0.97, h.t2 - 0.02), h.ctrl[9], h.ctrl[11], 1);
          }
        }

        // Messenger fish: the step travels an edge, a little fish swims along it (the travelling dot becomes the fish).
        let fi = 0;
        if (!calm) {
          for (let j = 0; j + 1 < sample.pulseCount && fi < messengers.mesh.count; j += 2) {
            const hx = sample.pulse[j * 4], hy = sample.pulse[j * 4 + 1], hz = sample.pulse[j * 4 + 2];
            const tx = sample.pulse[(j + 1) * 4], ty = sample.pulse[(j + 1) * 4 + 1], tz = sample.pulse[(j + 1) * 4 + 2];
            const sz = sample.pulse[j * 4 + 3];
            const dx = hx - tx, dy = hy - ty, dz = hz - tz;
            if (Math.hypot(dx, dy, dz) < 1e-4 || sz < 0.01) continue;
            _q.setFromEuler(_e.set(-Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(dx, dz), 0));
            const k = Math.min(1, sz / 0.08) * 1.6;
            _s.set(k, k, k);
            _v.set(hx, hy, hz);
            messengers.mesh.setMatrixAt(fi++, _m.compose(_v, _q, _s));
            sample.pulse[j * 4 + 3] = 0;
            sample.pulse[(j + 1) * 4 + 3] = 0;
          }
        }
        for (let j = fi; j < messengers.mesh.count; j++) messengers.mesh.setMatrixAt(j, _m.makeScale(0, 0, 0));
        messengers.mesh.instanceMatrix.needsUpdate = true;

        // The lantern jelly drifts over to the node the step is about, and dims when there is none.
        const focus = pod[0].target >= 0 && sample.presence[pod[0].target] > 0.05 && st.roam < 0.5 ? pod[0].target : -1;
        const on = focus >= 0 && !calm ? 1 : 0;
        st.lanternOn += (on - st.lanternOn) * Math.min(1, dt * 2.5);
        if (focus >= 0) {
          const tx = sample.pos[focus * 3] - 0.45, ty = sample.pos[focus * 3 + 1] + sample.dims[focus * 3 + 1] / 2 + 0.95, tz = sample.pos[focus * 3 + 2] - 0.35;
          if (!st.lantern.lengthSq()) st.lantern.set(tx, ty, tz);
          const k = Math.min(1, dt * 2.2);
          st.lantern.x += (tx - st.lantern.x) * k;
          st.lantern.y += (ty - st.lantern.y) * k;
          st.lantern.z += (tz - st.lantern.z) * k;
        }
        const pulse = 0.85 + 0.15 * Math.sin(now * 2.4);
        lantern.group.visible = st.lanternOn > 0.02;
        lantern.group.position.set(st.lantern.x, st.lantern.y + Math.sin(now * 1.2) * 0.06, st.lantern.z);
        lantern.bellMat.uniforms.uStrength.value = st.lanternOn * pulse;
        lantern.haloMat.uniforms.uStrength.value = 0.3 * st.lanternOn * pulse;
        lantern.light.intensity = 2.2 * st.lanternOn * pulse;
        pool.end();

        // A hook for automated visual checks (never set by the site): report the pod, optionally hold the camera on it.
        const dbg = (globalThis as { __AQVL_OCEAN_DEBUG__?: OceanDebug }).__AQVL_OCEAN_DEBUG__;
        if (dbg) {
          dbg.pod = rigs.map((r, i) => ({ x: r.root.position.x, y: r.root.position.y, z: r.root.position.z, yaw: r.root.rotation.y, mood: pod[i].mood, contact: pod[i].contact }));
          const cam = typeof dbg.camera === 'function' ? dbg.camera(dbg.pod) : dbg.camera;
          if (cam) {
            camera.position.set(cam.position[0], cam.position[1], cam.position[2]);
            camera.lookAt(cam.target[0], cam.target[1], cam.target[2]);
            invalidate();
          }
        }
      }),
    [driver, model, pod, rigs, calm, clock, playhead, get, pool, bubbles, names, invalidate, spots, messengers, lantern, sorting],
  );

  useEffect(() => () => rigs.forEach((r) => r.dispose()), [rigs]);
  useEffect(() => () => pool.dispose(), [pool]);
  useEffect(
    () => () => {
      if (typeof document !== 'undefined') document.body.style.cursor = '';
    },
    [],
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
            hovered.current = -1;
            document.body.style.cursor = '';
            invalidate();
          }}
        />
      ))}
      <primitive object={messengers.mesh} />
      <primitive object={lantern.group} />
      <primitive object={pool.points} />
    </>
  );
}
