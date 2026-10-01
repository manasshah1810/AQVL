import React from 'react';
import * as THREE from 'three';
import {AbsoluteFill} from 'remotion';
import {Director, Stage} from '../gl/Stage';
import {Glass, placeLine, Rig} from '../gl/rig';
import {spring, SNAP} from '../lib/motion';

const director = (): Director => {
  const boxes: Glass[] = [];
  const spheres: Glass[] = [];
  const lines: THREE.Mesh[] = [];
  let burst: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  return {
    init: (rig: Rig) => {
      for (let i = 0; i < 6; i++) {
        const b = rig.glassBox(1, 1, 1, 0.1);
        b.position.set((i - 2.5) * 1.35, 0.6, 0);
        rig.world.add(b);
        boxes.push(b);
      }
      for (let i = 0; i < 3; i++) {
        const s = rig.glassSphere();
        s.position.set((i - 1) * 2.4, 0.5, -3);
        rig.world.add(s);
        spheres.push(s);
      }
      for (let i = 0; i < 2; i++) {
        const l = rig.line();
        rig.world.add(l);
        lines.push(l);
      }
      burst = rig.burst();
      rig.overlay.add(burst);
    },
    draw: (rig, t) => {
      boxes.forEach((b, i) => {
        const s = spring(t - i * 0.05, SNAP);
        b.scale.setScalar(Math.max(s, 0.0001));
        b.u.uActive.value = i === 2 ? 1 : 0;
      });
      spheres.forEach((s) => s.scale.setScalar(0.9));
      lines.forEach((l, i) => placeLine(l, spheres[i].position, spheres[i + 1].position, 0.025));
      const p = boxes[2].position;
      burst.position.copy(p);
      burst.scale.setScalar(1.6);
      burst.material.uniforms.uI.value = 0.8;
      burst.material.uniforms.uR.value = 0.4;
      rig.setBursts([{pos: p, i: 1.2}]);
      const az = 0.6 + t * 0.15;
      const cam = rig.camera;
      cam.position.set(Math.sin(az) * 18, 8, Math.cos(az) * 18);
      cam.lookAt(0, 0.5, -1);
      rig.render({focus: 18, aperture: 6, bloom: 0.7, exposure: 1.0, ca: 0.02, vignette: 0.6, time: t, fade: 1, warm: 0, threshold: 0.9});
    },
  };
};

export const RigTest: React.FC = () => (
  <AbsoluteFill style={{background: '#100d19'}}>
    <Stage director={director} />
  </AbsoluteFill>
);

export const Hello: React.FC = () => (
  <AbsoluteFill style={{background: '#100d19', color: '#ebc0a3', fontSize: 80, justifyContent: 'center', alignItems: 'center'}}>
    hello
  </AbsoluteFill>
);
