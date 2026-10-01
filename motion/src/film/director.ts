import * as THREE from 'three';
import {Director} from '../gl/Stage';
import {Rig} from '../gl/rig';
import {PostParams} from '../gl/post';
import {clamp, easeInOut, inv, lerp, noise1} from '../lib/motion';
import {applyCam, camAt, HERO} from './camera';
import {CamPose, Classroom} from './classroom';
import {Shatter} from './shatter';
import {T} from './timeline';
import {World} from './world';

const base = (t: number): PostParams => ({
  focus: 20,
  aperture: 0,
  bloom: 0.3,
  exposure: 1,
  ca: 0.02,
  vignette: 0.72,
  time: t,
  fade: 1,
  warm: 0,
  threshold: 1.2,
});

const setPose = (cam: THREE.PerspectiveCamera, p: CamPose, w: number, h: number) => {
  cam.position.copy(p.pos);
  cam.up.set(0, 1, 0);
  if (p.up) cam.up.applyQuaternion(p.up);
  cam.lookAt(p.look);
  if (p.roll) cam.rotateZ(p.roll);
  cam.fov = p.fov;
  cam.aspect = w / h;
  cam.clearViewOffset();
  cam.updateProjectionMatrix();
};

export const filmDirector = (): Director => {
  const cls = new Classroom();
  const world = new World();
  const shatter = new Shatter();
  let lastFocus = 20;
  return {
    init: (rig: Rig) => {
      cls.build(rig);
      world.build(rig);
      shatter.build(cls);
    },
    draw: (rig: Rig, t: number) => {
      const cam = rig.camera;
      const {w, h} = rig;
      const floor = rig.floor.material as THREE.ShaderMaterial;

      // ---------------- analog world
      if (t < T.shatter || (t >= T.easy && t < T.resolve)) {
        world.setVisible(false);
        shatter.update(-1);
        const r = cls.update(t)!;
        setPose(cam, r.pose, w, h);
        rig.render({...base(t), ...r.post}, false);
        return;
      }

      // ---------------- resolve: the pristine void, the mark on the horizon
      if (t >= T.resolve) {
        cls.show(null);
        world.setVisible(true);
        world.update(t, cam);
        const lt = t - T.resolve;
        const c = HERO.tag;
        cam.position.set(c.x, 1.05, c.z + 17 - lt * 0.18);
        cam.up.set(0, 1, 0);
        cam.lookAt(c.x, 1.25, c.z);
        cam.fov = 26;
        cam.aspect = w / h;
        cam.clearViewOffset();
        cam.updateProjectionMatrix();
        floor.uniforms.uPool.value.set(c.x, c.z + 2, 30);
        rig.render({...base(t), bloom: 0.6, threshold: 0.9, vignette: 0.75, fade: clamp(lt / 0.35)}, true);
        return;
      }

      // ---------------- AQVL world (shatter -> four heroes -> tagline)
      world.setVisible(true);
      const shards = shatter.update(t);
      if (!shards) cls.show(null);
      const k = camAt(t);
      // focus-pull: the camera leans toward the executing node
      const pre = world.update(t, cam);
      let nudge = new THREE.Vector3();
      let env = 0;
      if (pre) {
        env = Math.exp(-Math.max(0, t - pre.at) * 2.2) * clamp((t - pre.at + 0.05) / 0.12);
        nudge = pre.pos.clone().sub(new THREE.Vector3(k.x, k.y, k.z)).multiplyScalar(0.1 * env);
      }
      applyCam(cam, k, w, h, nudge);
      // labels face the final camera
      const focus = world.update(t, cam);
      const fd = focus ? cam.position.distanceTo(focus.pos) : k.d;
      lastFocus = lerp(lastFocus, fd, 1);
      floor.uniforms.uPool.value.set(k.x, k.z, 46);
      const hit = clamp(1 - (t - T.shatter) / 0.12);
      const breath = 0.5 + 0.5 * noise1(t * 0.4, 3);
      rig.render(
        {
          ...base(t),
          focus: lastFocus,
          aperture: 2.2 + env * 3.2 + (t < T.fire ? 1.5 : 0),
          bloom: 0.62 + env * 0.15,
          threshold: 0.95,
          exposure: 1.0 + hit * 0.9 + breath * 0.02,
          ca: 0.012 + hit * 0.05,
          vignette: 0.66,
          warm: hit * 0.4,
        },
        true,
      );
      void easeInOut;
      void inv;
    },
  };
};
