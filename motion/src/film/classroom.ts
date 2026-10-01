import * as THREE from 'three';
import {fontFamily} from '../lib/fonts';
import {clamp, easeInOut, easeOut, inv, lerp, noise1, rng, shake} from '../lib/motion';
import {PostParams} from '../gl/post';
import {Rig} from '../gl/rig';
import {applyCam, camAt} from './camera';
import {
  BOARD,
  boardLive,
  boardNotes,
  boardTree,
  handoutText,
  hookScribble,
  INK,
  notebookA,
  notebookB,
  notebookClean,
  PAGE,
  progress,
  sequence,
  SLIDE,
  Stroke,
  transparency,
  wallCode,
  WB,
  whiteboard,
} from './content';
import {boardBase, chalk, ink, mkCanvas, noiseCanvas, paperBase, pointAt, Pt} from './draw2d';
import {Dust, makeChalk, makePen, pointAlong, Sheet} from './props';
import {T} from './timeline';

const CHALK = '#f1e7dc';
const MARKER = '#2a2238';

export type CamPose = {pos: THREE.Vector3; look: THREE.Vector3; fov: number; roll?: number; up?: THREE.Quaternion};

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const drawStrokes = (ctx: CanvasRenderingContext2D, strokes: Stroke[], t: number, kind: 'chalk' | 'ink', color: string, seed = 1, alpha = 1) => {
  strokes.forEach((s, i) => {
    const p = progress(s, t);
    if (p <= 0) return;
    if (kind === 'chalk') chalk(ctx, s.pts, p, s.w, s.color ?? color, seed + i, alpha);
    else ink(ctx, s.pts, p, s.w, s.color ?? color, seed + i, alpha);
  });
};

const staticLines = (ctx: CanvasRenderingContext2D, lines: Pt[][], kind: 'chalk' | 'ink', w: number, color: string, seed: number, alpha = 1) => {
  lines.forEach((l, i) => (kind === 'chalk' ? chalk(ctx, l, 1, w, color, seed + i, alpha) : ink(ctx, l, 1, w, color, seed + i, alpha)));
};

// Tip of the currently drawing stroke (for pens and chalk).
const activeTip = (strokes: Stroke[], t: number): {pt: Pt; down: boolean} | null => {
  let last: Stroke | null = null;
  for (const s of strokes) {
    if (t >= s.t0 && t <= s.t1) return {pt: pointAt(s.pts, progress(s, t)), down: true};
    if (t > s.t1) last = s;
  }
  if (last) return {pt: last.pts[last.pts.length - 1], down: false};
  return null;
};

export class Classroom {
  group = new THREE.Group();
  sets: Record<string, THREE.Group> = {};
  board!: Sheet;
  nbA!: Sheet;
  nbB!: Sheet;
  slide!: Sheet;
  stage!: THREE.Mesh;
  handout!: Sheet;
  handout2!: Sheet;
  wb!: Sheet;
  screen!: Sheet;
  chalkA!: THREE.Mesh;
  chalkB!: THREE.Mesh;
  dust!: Dust;
  motes!: Dust;
  pens: Record<string, THREE.Group> = {};
  lights: Record<string, THREE.Light[]> = {};
  hookStroke!: Pt[];
  live!: Stroke[];
  strokesA: Record<string, Stroke[]> = {};
  strokesB: Record<string, Stroke[]> = {};
  wbStrokes!: Stroke[];
  liveArrow!: Stroke[];
  cleanStrokes!: Stroke[];
  deskB!: THREE.Mesh;
  boardStatic!: HTMLCanvasElement;
  handoutGeo0!: Float32Array;
  rig!: Rig;

  build(rig: Rig) {
    this.rig = rig;
    rig.scene.add(this.group);
    const bump = new THREE.CanvasTexture(noiseCanvas(512, 512, 9));
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
    bump.repeat.set(6, 6);

    const mkSet = (name: string, x: number) => {
      const g = new THREE.Group();
      g.position.x = x;
      this.sets[name] = g;
      this.group.add(g);
      return g;
    };
    const warmLights = (g: THREE.Group, key: number, dir: THREE.Vector3, amb = 0.25, color = '#ffdcbc') => {
      const d = new THREE.DirectionalLight(color, key);
      d.position.copy(dir);
      d.target.position.set(0, 0, 0);
      g.add(d, d.target);
      const h = new THREE.HemisphereLight('#fff0e2', '#20160f', amb);
      g.add(h);
      return [d, h];
    };

    // ---- board
    {
      const g = mkSet('board', -400);
      const base = boardBase(BOARD.w, BOARD.h, 3);
      const bctx = base.getContext('2d')!;
      staticLines(bctx, boardTree.lines, 'chalk', 16, CHALK, 30, 0.95);
      staticLines(bctx, boardNotes, 'chalk', 14, CHALK, 60, 0.8);
      this.board = new Sheet(base, BOARD.w / 640, BOARD.h / 640, {rough: 0.95, bump, bumpScale: 0.6});
      g.add(this.board.mesh, this.backdrop('#14100e'));
      this.lights.board = warmLights(g, 2.4, V(-3, 3.5, 4), 0.3);
      this.chalkA = makeChalk(0.3);
      this.chalkB = makeChalk(0.08);
      g.add(this.chalkA, this.chalkB);
      this.dust = new Dust(260, '#f2e9df', 14);
      g.add(this.dust.points);
      this.hookStroke = hookScribble();
      this.live = boardLive(T.boardTree + 0.02, T.boardTree + 0.58);
    }

    // ---- notebook A (hook) â€” also the "easy" page
    {
      const g = mkSet('nbA', -300);
      const desk = this.desk();
      g.add(desk);
      this.nbA = new Sheet(paperBase(PAGE.w, PAGE.h, 11), 2.1, 2.8, {rough: 0.92, bump, bumpScale: 0.35});
      g.add(this.nbA.mesh);
      this.lights.nbA = warmLights(g, 2.6, V(-2.5, 2, 2.2), 0.32);
      const easyKey = new THREE.PointLight('#ebc0a3', 0, 6, 1.4);
      easyKey.position.set(1.4, -0.4, 1.0);
      const easyAmb = new THREE.HemisphereLight('#4a3d68', '#100c18', 0);
      g.add(easyKey, easyAmb);
      this.lights.easy = [easyKey, easyAmb];
      this.pens.nbA = makePen();
      g.add(this.pens.nbA);
      const A = notebookA;
      const t0 = T.notebook;
      this.strokesA.a1 = A.a1.map((pts) => ({pts, t0: -1, t1: -0.5, w: 6}));
      this.strokesA.x1 = [{pts: A.x1, t0: t0 + 0.06, t1: t0 + 0.46, w: 7}];
      this.strokesA.a2 = sequence(A.a2, t0 + 0.56, t0 + 1.0, 6);
      this.strokesA.x2 = [
        {pts: A.x2, t0: t0 + 1.2, t1: t0 + 1.38, w: 12},
        {pts: A.x2b, t0: t0 + 1.4, t1: t0 + 1.56, w: 13},
      ];
      this.strokesA.q = sequence(A.q, t0 + 1.6, t0 + 1.84, 11, undefined, 0.3);
      this.cleanStrokes = sequence(notebookClean, T.easy + 0.55, T.easy + 2.0, 6, undefined, 0.25);
    }

    // ---- notebook B (tangle, wall, break page): placed right in front of
    // the world camera's first pose so the page can shatter into the world.
    {
      const g = new THREE.Group();
      this.sets.nbB = g;
      this.group.add(g);
      const k = camAt(T.shatter);
      const cam = new THREE.PerspectiveCamera();
      applyCam(cam, k, 1920, 1080);
      cam.clearViewOffset();
      const fwd = new THREE.Vector3();
      cam.getWorldDirection(fwd);
      g.position.copy(cam.position).addScaledVector(fwd, 2.3);
      g.quaternion.copy(cam.quaternion);
      this.deskB = this.desk();
      g.add(this.deskB);
      this.nbB = new Sheet(paperBase(PAGE.w, PAGE.h, 21), 2.1, 2.8, {rough: 0.92, bump, bumpScale: 0.35});
      g.add(this.nbB.mesh);
      this.lights.nbB = warmLights(g, 2.5, V(-2.2, 2.4, 2.4), 0.34);
      this.pens.nbB = makePen();
      g.add(this.pens.nbB);
      const B = notebookB;
      this.strokesB.tangle1 = sequence(B.tangles.slice(0, 10), T.tangle + 0.05, T.tangle + 0.95, 7);
      this.strokesB.q1 = sequence(B.qs.slice(0, 4), T.wall + 1.55, T.wall + 1.9, 9, undefined, 0.4);
      this.strokesB.tangle2 = sequence(B.tangles.slice(10), T.wall + 2.3, T.wall + 2.55, 8);
      this.strokesB.q2 = sequence(B.qs.slice(4), T.wall + 2.4, T.wall + 2.6, 9, undefined, 0.3);
    }

    // ---- overhead projector transparency on a glowing stage
    {
      const g = mkSet('projector', -200);
      const stageMat = new THREE.MeshBasicMaterial({color: new THREE.Color(2.2, 1.7, 1.25)});
      this.stage = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.9), stageMat);
      this.stage.position.z = -0.02;
      this.stage.layers.enable(2);
      const frame = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 3.6), new THREE.MeshStandardMaterial({color: '#2a2422', roughness: 0.5, metalness: 0.6}));
      frame.position.z = -0.03;
      frame.layers.enable(2);
      const slideBase = mkCanvas(SLIDE.w, SLIDE.h);
      const sctx = slideBase.getContext('2d')!;
      sctx.fillStyle = '#f7efe4';
      sctx.fillRect(0, 0, SLIDE.w, SLIDE.h);
      // fingerprint smudges / scratches on the film
      const r = rng(77);
      for (let i = 0; i < 70; i++) {
        sctx.strokeStyle = `rgba(150,120,100,${0.04 + r() * 0.05})`;
        sctx.lineWidth = 1;
        sctx.beginPath();
        const x = r() * SLIDE.w;
        const y = r() * SLIDE.h;
        sctx.moveTo(x, y);
        sctx.lineTo(x + (r() - 0.5) * 300, y + (r() - 0.5) * 60);
        sctx.stroke();
      }
      staticLines(sctx, transparency.lines, 'ink', 9, MARKER, 1100, 0.85);
      this.slide = new Sheet(slideBase, 2.0, 1.5, {rough: 0.3});
      const sm = this.slide.mesh.material;
      sm.emissive = new THREE.Color('#ffffff');
      sm.emissiveMap = this.slide.tex;
      sm.emissiveIntensity = 1.15;
      g.add(frame, this.stage, this.slide.mesh, this.backdrop('#100c0b'));
      this.lights.projector = warmLights(g, 0.6, V(0, 2, 3), 0.15);
      this.motes = new Dust(140, '#ffe9d2', 7);
      g.add(this.motes.points);
      this.pens.projector = makePen();
      g.add(this.pens.projector);
      this.liveArrow = sequence(transparency.live, T.projector + 0.25, T.projector + 0.7, 10);
    }

    // ---- handout (printed, dense), page turn
    {
      const g = mkSet('handout', -100);
      g.add(this.desk());
      const mk = (seed: number, offset: number) => {
        const c = paperBase(PAGE.w, PAGE.h, seed, false, '#f1e8dc');
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = 'rgba(40,32,44,0.88)';
        ctx.font = `500 50px ${fontFamily}`;
        for (let i = 0; i < 46; i++) {
          const line = handoutText[(i + offset) % handoutText.length];
          ctx.fillText(line, 120, 200 + i * 54);
        }
        return c;
      };
      this.handout2 = new Sheet(mk(31, 7), 2.1, 2.8, {rough: 0.9, bump, bumpScale: 0.25});
      this.handout2.mesh.position.z = -0.004;
      this.handout = new Sheet(mk(32, 0), 2.1, 2.8, {rough: 0.9, bump, bumpScale: 0.25, segs: 48});
      this.handout.mesh.material.side = THREE.DoubleSide;
      this.handoutGeo0 = Float32Array.from(this.handout.mesh.geometry.attributes.position.array as Float32Array);
      g.add(this.handout2.mesh, this.handout.mesh);
      this.lights.handout = warmLights(g, 2.4, V(-2, 2.5, 2.5), 0.3);
    }

    // ---- whiteboard
    {
      const g = mkSet('whiteboard', 0 - 500);
      const c = mkCanvas(WB.w, WB.h);
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#e9e5df';
      ctx.fillRect(0, 0, WB.w, WB.h);
      const r = rng(55);
      for (let i = 0; i < 40; i++) {
        const x = r() * WB.w;
        const y = r() * WB.h;
        const rad = 100 + r() * 400;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, 'rgba(120,110,120,0.04)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      staticLines(ctx, whiteboard.ghosts, 'ink', 16, '#5c5466', 1230, 0.18);
      staticLines(ctx, whiteboard.lines, 'ink', 15, MARKER, 1200, 0.95);
      this.wb = new Sheet(c, 4.8, 2.7, {rough: 0.28});
      g.add(this.wb.mesh, this.backdrop('#1b1613'));
      this.lights.whiteboard = warmLights(g, 2.2, V(-2.5, 3, 3), 0.35, '#fff0e0');
      this.pens.whiteboard = makePen();
      this.pens.whiteboard.scale.setScalar(1.5);
      g.add(this.pens.whiteboard);
      const w0 = T.whiteboard;
      this.wbStrokes = [
        ...sequence(whiteboard.swap1, w0 + 0.1, w0 + 0.32, 15),
        ...sequence(whiteboard.swap2, w0 + 0.34, w0 + 0.55, 15),
        ...sequence(whiteboard.swap3, w0 + 0.62, w0 + 0.86, 15),
      ];
    }

    // ---- projection screen (the wall of code)
    {
      const g = mkSet('screen', -600);
      const c = mkCanvas(2560, 1440);
      const ctx = c.getContext('2d')!;
      const gr = ctx.createRadialGradient(1100, 650, 100, 1280, 720, 1600);
      gr.addColorStop(0, '#fbf3e8');
      gr.addColorStop(1, '#b9a796');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, 2560, 1440);
      this.screen = new Sheet(c, 6.4, 3.6, {rough: 1});
      const sm = this.screen.mesh.material;
      sm.emissive = new THREE.Color('#ffffff');
      sm.emissiveMap = this.screen.tex;
      sm.emissiveIntensity = 0.9;
      g.add(this.screen.mesh, this.backdrop('#0d0a0a'));
      this.lights.screen = warmLights(g, 0.3, V(0, 2, 4), 0.1);
    }
  }

  backdrop(color: string) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshStandardMaterial({color, roughness: 0.9}));
    m.position.z = -0.06;
    m.layers.enable(2);
    return m;
  }

  desk() {
    const c = mkCanvas(1024, 1024);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#2a1f1a';
    ctx.fillRect(0, 0, 1024, 1024);
    const r = rng(5);
    for (let i = 0; i < 400; i++) {
      ctx.strokeStyle = `rgba(${r() > 0.5 ? '70,50,40' : '20,14,12'},${0.2 + r() * 0.3})`;
      ctx.lineWidth = 1 + r() * 3;
      const y = r() * 1024;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(300, y + (r() - 0.5) * 30, 700, y + (r() - 0.5) * 30, 1024, y + (r() - 0.5) * 20);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 7), new THREE.MeshStandardMaterial({map: tex, roughness: 0.55}));
    m.position.z = -0.02;
    m.layers.enable(2);
    return m;
  }

  show(name: string | null) {
    for (const [k, g] of Object.entries(this.sets)) g.visible = k === name;
  }

  // Place a pen/chalk tip on a sheet at canvas px, lifted when not drawing.
  tip(obj: THREE.Object3D, sheet: Sheet, pt: Pt, lift: number, dir: THREE.Vector3) {
    const p = sheet.local(pt[0], pt[1], lift);
    p.applyMatrix4(sheet.mesh.matrix);
    obj.position.copy(p);
    pointAlong(obj, dir);
  }

  // Returns the camera pose (world space) and post settings for time t, or
  // null when the classroom isn't on screen.
  update(t: number): {pose: CamPose; post: Partial<PostParams>} | null {
    const sh = (amp: number, hits: number[]) => hits.reduce((s, h) => s + shake(t, h, amp, 7, 30, h * 10), 0);
    const hand = (amp: number, seed: number) => V(noise1(t * 0.9, seed) * amp, noise1(t * 0.8, seed + 3) * amp, 0);
    const pens = this.pens;
    Object.values(pens).forEach((p) => (p.visible = false));

    // ===== HOOK: chalk circling, slash, snap =====
    if (t < T.notebook) {
      this.show('board');
      const g = this.sets.board;
      // time remap: violent stroke, a held jolt at the snap, slow-mo after
      const lt = t < T.snap ? t : t < T.snap + 0.16 ? T.snap : T.snap + (t - T.snap - 0.16) * 0.35;
      const prog = t < T.snap ? 0.22 + 0.78 * Math.pow(t / T.snap, 1.12) : 1;
      this.board.draw(`hook${prog.toFixed(4)}`, (ctx) => {
        chalk(ctx, this.hookStroke, prog, 26, CHALK, 900, 1);
      });
      const tipPt = pointAt(this.hookStroke, prog);
      const tipL = this.board.local(tipPt[0], tipPt[1], 0);
      // chalk stick rides the stroke, then snaps
      const dir = V(0.55, 0.35, 0.75);
      if (t < T.snap) {
        this.chalkA.visible = true;
        this.chalkB.visible = false;
        this.chalkA.position.copy(tipL);
        pointAlong(this.chalkA, dir);
        this.chalkA.scale.set(1, 1, 1);
      } else {
        const d = lt - T.snap;
        this.chalkA.visible = true;
        this.chalkA.position.copy(tipL).add(V(0.06 + d * 0.5, 0.05 + d * 0.6, 0.12 + d * 0.8));
        pointAlong(this.chalkA, V(0.55, 0.15 + d, 0.75));
        this.chalkA.scale.set(1, 0.72, 1);
        this.chalkB.visible = true;
        this.chalkB.position.copy(tipL).add(V(0.12 + d * 0.9, 0.04 + d * 0.5 - 2.4 * d * d, 0.06 + d * 0.6));
        this.chalkB.rotation.set(d * 22, d * 9, d * 14);
      }
      // dust: trickle along the stroke + burst at the snap
      const r = rng(4);
      for (let i = 0; i < this.dust.n; i++) {
        const burst = i > 120;
        const born = burst ? T.snap : (i / 120) * T.snap;
        const age = (burst ? lt : Math.min(lt, T.snap + (lt - T.snap))) - born;
        const v = V((r() - 0.3) * (burst ? 1.4 : 0.25), (r() - 0.2) * (burst ? 1.1 : 0.2), r() * (burst ? 0.9 : 0.25));
        const origin = burst ? tipL : this.board.local(...pointAt(this.hookStroke, 0.22 + 0.78 * Math.pow(Math.max(0, born) / T.snap, 1.12)), 0);
        if (age < 0) {
          this.dust.set(i, 0, 0, 0, 0);
          continue;
        }
        const drag = (1 - Math.exp(-age * 3)) / 3;
        this.dust.set(i, origin.x + v.x * drag, origin.y + v.y * drag - 0.08 * age * age, origin.z + 0.01 + v.z * drag, Math.exp(-age * (burst ? 0.9 : 2.2)) * (burst ? 0.55 : 0.35), 0.6 + r() * 1.4);
      }
      this.dust.commit();
      const kick = sh(0.05, [0, T.snap]) + sh(0.02, [0.3]);
      const look = this.board.local(...pointAt(this.hookStroke, Math.min(1, prog * 0.6 + 0.25)), 0).lerp(tipL, 0.35);
      const pos = look.clone().add(V(0.45, -0.32, 1.05)).add(V(kick, kick * 0.6, 0));
      return {
        pose: {pos: pos.add(g.position), look: look.add(g.position).add(V(kick * 0.5, 0, 0)), fov: 36, roll: kick * 0.6},
        post: {focus: pos.distanceTo(tipL.clone().add(g.position)), aperture: 22, warm: 0.7, exposure: 1.15, ca: 0.02 + Math.abs(kick) * 0.4, motion: [kick * 0.25, kick * 0.1]},
      };
    }

    // ===== HOOK: notebook crossings =====
    if (t < T.oldWay) {
      this.show('nbA');
      return this.notebookAShot(t, sh, hand);
    }

    // ===== OLD WAY =====
    if (t < T.boardTree) return this.projectorShot(t, hand);
    if (t < T.handout) return this.boardTreeShot(t, sh, hand);
    if (t < T.whiteboard) return this.handoutShot(t, hand);
    if (t < T.tangle) return this.whiteboardShot(t, sh, hand);
    if (t < T.wall) return this.tangleShot(t, sh, hand);

    // ===== THE WALL =====
    if (t < T.shatter) return this.wallShot(t, sh, hand);

    // ===== OH, IT'S EASY =====
    if (t >= T.easy && t < T.resolve) return this.easyShot(t, hand);

    this.show(null);
    return null;
  }

  drawNotebookA(t: number, easy = 0, now = t) {
    const s = this.strokesA;
    this.nbA.draw(`A${t.toFixed(3)}${easy.toFixed(3)}${now.toFixed(3)}`, (ctx) => {
      // on the easy page the old mess lifts off the paper
      const old = 1 - easy;
      if (old > 0.01) {
        drawStrokes(ctx, s.a1, t, 'ink', INK, 1, old);
        drawStrokes(ctx, s.x1, t, 'ink', INK, 7, old);
        drawStrokes(ctx, s.a2, t, 'ink', INK, 9, old);
        drawStrokes(ctx, s.x2, t, 'ink', '#17121f', 3, old);
        drawStrokes(ctx, s.q, t, 'ink', INK, 5, old);
        // gouge: a torn, darker groove where the pen dug in
        if (t > T.notebook + 1.42) {
          ctx.save();
          ctx.globalAlpha = 0.5 * old;
          ctx.strokeStyle = '#f8f1e6';
          ctx.lineWidth = 3;
          ctx.beginPath();
          const g = notebookA.x2b;
          for (let i = 20; i < 60; i++) ctx.lineTo(g[i][0] + 3, g[i][1] - 6);
          ctx.stroke();
          ctx.restore();
        }
      }
      if (easy > 0) {
        // ghost of the old attempts, then the clean list drawing itself
        this.cleanStrokes.forEach((st, i) => {
          const p = progress(st, now);
          if (p > 0) ink(ctx, st.pts, easeOut(p), 6, INK, 800 + i);
        });
      }
    });
  }

  notebookAShot(t: number, sh: (a: number, h: number[]) => number, hand: (a: number, s: number) => THREE.Vector3) {
    const g = this.sets.nbA;
    this.lightsFor('nbA', 1);
    this.drawNotebookA(t);
    const s = this.strokesA;
    const all = [...s.x1, ...s.a2, ...s.x2, ...s.q];
    const tp = activeTip(all, t);
    const pen = this.pens.nbA;
    if (tp) {
      pen.visible = true;
      this.tip(pen, this.nbA, tp.pt, tp.down ? 0 : 0.06 + 0.05 * Math.sin(t * 20), V(0.4, 0.45, 1));
    }
    const t0 = T.notebook;
    const kick = sh(0.03, [t0 + 0.06, t0 + 1.2, t0 + 1.4]) + sh(0.015, [t0 + 0.56, t0 + 1.6]);
    let look: THREE.Vector3;
    let dist: number;
    let off: THREE.Vector3;
    if (t < t0 + 0.55) {
      look = this.nbA.local(900, 600);
      dist = 1.25;
      off = V(0.2, -0.55, 1);
    } else if (t < t0 + 1.18) {
      look = this.nbA.local(820 + (t - t0 - 0.55) * 300, 1320);
      dist = 1.2;
      off = V(-0.3, -0.5, 1);
    } else if (t < t0 + 1.58) {
      look = this.nbA.local(1000, 1330);
      dist = 0.95;
      off = V(0.35, -0.4, 1);
    } else {
      look = this.nbA.local(1150, 1500);
      dist = 2.1 - (t - t0 - 1.58) * 0.5;
      off = V(0.1, -0.35, 1);
    }
    const pos = look.clone().add(off.normalize().multiplyScalar(dist)).add(hand(0.02, 2)).add(V(kick, kick, 0));
    return {
      pose: {pos: pos.add(g.position), look: look.clone().add(g.position), fov: 32, roll: kick * 0.8 + 0.04},
      post: {focus: dist, aperture: 16, warm: 0.7, exposure: 1.05, ca: 0.018 + Math.abs(kick) * 0.35, motion: [kick * 0.3, kick * 0.3]},
    };
  }

  projectorShot(t: number, hand: (a: number, s: number) => THREE.Vector3) {
    this.show('projector');
    const g = this.sets.projector;
    const lt = t - T.projector;
    this.slide.draw(`P${t.toFixed(3)}`, (ctx) => drawStrokes(ctx, this.liveArrow, t, 'ink', MARKER, 3, 0.9));
    const tp = activeTip(this.liveArrow, t);
    if (tp) {
      this.pens.projector.visible = true;
      this.tip(this.pens.projector, this.slide, tp.pt, tp.down ? 0 : 0.08, V(0.3, -0.5, 1));
    }
    // flicker of an old lamp
    const fl = 1 + 0.06 * noise1(t * 24, 4) + 0.04 * noise1(t * 61, 8);
    (this.stage.material as THREE.MeshBasicMaterial).color.setRGB(2.2 * fl, 1.7 * fl, 1.25 * fl);
    this.slide.mesh.material.emissiveIntensity = 1.15 * fl;
    // dust motes floating in the beam above the stage
    const r = rng(12);
    for (let i = 0; i < this.motes.n; i++) {
      const x = (r() - 0.5) * 2.4 + noise1(t * 0.3 + i, 1) * 0.1;
      const y = (r() - 0.5) * 1.8 + noise1(t * 0.25 + i, 2) * 0.1;
      const z = 0.1 + r() * 1.4 + ((t * 0.08 + r()) % 1) * 0.2;
      this.motes.set(i, x, y, z, 0.25 + 0.35 * r(), 0.5 + r());
    }
    this.motes.commit();
    const look = V(-0.1 + lt * 0.1, 0.05, 0);
    const pos = V(0.9 - lt * 0.25, -1.15, 0.75 - lt * 0.12).add(hand(0.02, 5));
    return {
      pose: {pos: pos.add(g.position), look: look.add(g.position), fov: 34, roll: -0.08},
      post: {focus: 1.35, aperture: 14, warm: 0.75, exposure: 0.9, bloom: 0.5, threshold: 1.6, ca: 0.018},
    };
  }

  boardTreeShot(t: number, sh: (a: number, h: number[]) => number, hand: (a: number, s: number) => THREE.Vector3) {
    this.show('board');
    this.chalkA.visible = false;
    this.chalkB.visible = false;
    for (let i = 0; i < this.dust.n; i++) this.dust.set(i, 0, 0, 0, 0);
    this.dust.commit();
    const g = this.sets.board;
    const lt = t - T.boardTree;
    this.board.draw(`T${t.toFixed(3)}`, (ctx) => {
      chalk(ctx, this.hookStroke, 1, 26, CHALK, 900, 1);
      drawStrokes(ctx, this.live, t, 'chalk', CHALK, 40);
    });
    const tp = activeTip(this.live, t);
    if (tp && tp.down) {
      this.chalkA.visible = true;
      this.chalkA.position.copy(this.board.local(tp.pt[0], tp.pt[1]));
      pointAlong(this.chalkA, V(0.5, 0.4, 0.8));
    }
    // whip pan from the live tree to the hook circle
    const w = easeInOut(inv(0.6, 0.82, lt));
    const lookA = this.board.local(6650, 1060);
    const lookB = this.board.local(2100, 820);
    const look = lookA.clone().lerp(lookB, w);
    const dist = lerp(2.4, 3.0, w);
    const pos = look.clone().add(V(0.5 - w * 0.2, -0.3, dist)).add(hand(0.02, 7));
    const speed = Math.sin(Math.PI * clamp(inv(0.6, 0.82, lt))) ;
    return {
      pose: {pos: pos.add(g.position), look: look.add(g.position), fov: 34, roll: 0.03},
      post: {focus: dist, aperture: 9, warm: 0.7, exposure: 1.1, ca: 0.018, motion: [-speed * 0.045, 0]},
    };
  }

  handoutShot(t: number, hand: (a: number, s: number) => THREE.Vector3) {
    this.show('handout');
    const g = this.sets.handout;
    const lt = t - T.handout;
    // page turn: cylindrical curl sweeping from the lower-right corner
    const geo = this.handout.mesh.geometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const c = easeInOut(inv(0.5, 1.0, lt));
    const R = 0.22;
    const nrm = new THREE.Vector2(-0.8, -0.6).normalize(); // fold travels toward upper-left
    const d0 = 1.9 - c * 4.2; // fold line offset
    for (let i = 0; i < pos.count; i++) {
      const x = this.handoutGeo0[i * 3];
      const y = this.handoutGeo0[i * 3 + 1];
      const d = -(x * nrm.x + y * nrm.y) - d0; // >0 beyond the fold
      if (d <= 0 || c <= 0) {
        pos.setXYZ(i, x, y, 0.002);
        continue;
      }
      let nd: number;
      let z: number;
      if (d < Math.PI * R) {
        const a = d / R;
        nd = R * Math.sin(a);
        z = R * (1 - Math.cos(a));
      } else {
        nd = -(d - Math.PI * R);
        z = 2 * R;
      }
      const shift = nd - d;
      pos.setXYZ(i, x - nrm.x * shift, y - nrm.y * shift, z + 0.002);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    const look = V(-0.45 + lt * 0.5, 0.55 - lt * 0.15, 0);
    const p = look.clone().add(V(0.25, -0.5, 1.15)).add(hand(0.015, 9));
    return {
      pose: {pos: p.add(g.position), look: look.add(g.position), fov: 30, roll: 0.06},
      post: {focus: 1.3, aperture: 18, warm: 0.65, exposure: 1.05, ca: 0.018},
    };
  }

  whiteboardShot(t: number, sh: (a: number, h: number[]) => number, hand: (a: number, s: number) => THREE.Vector3) {
    this.show('whiteboard');
    const g = this.sets.whiteboard;
    const lt = t - T.whiteboard;
    this.wb.draw(`W${t.toFixed(3)}`, (ctx) => drawStrokes(ctx, this.wbStrokes, t, 'ink', MARKER, 20, 0.95));
    const tp = activeTip(this.wbStrokes, t);
    if (tp) {
      this.pens.whiteboard.visible = true;
      this.tip(this.pens.whiteboard, this.wb, tp.pt, tp.down ? 0 : 0.1, V(0.5, -0.2, 1));
    }
    const cut = lt > 0.58;
    const look = cut ? this.wb.local(1250, 620) : this.wb.local(800, 680);
    const dist = cut ? 1.5 : 2.6;
    const kick = sh(0.02, [T.whiteboard + 0.58]);
    const pos = look.clone().add(V(cut ? -0.6 : 0.4, -0.2, dist)).add(hand(0.02, 11)).add(V(kick, 0, 0));
    return {
      pose: {pos: pos.add(g.position), look: look.add(g.position), fov: 32, roll: cut ? -0.05 : 0.02},
      post: {focus: dist, aperture: 10, warm: 0.55, exposure: 0.95, ca: 0.018},
    };
  }

  drawNotebookB(t: number, crack = 0) {
    const B = notebookB;
    const s = this.strokesB;
    this.nbB.draw(`B${t.toFixed(3)}${crack.toFixed(3)}`, (ctx) => {
      staticLines(ctx, B.base, 'ink', 6, INK, 900);
      staticLines(ctx, B.code, 'ink', 5, INK, 1000, 0.9);
      drawStrokes(ctx, s.tangle1, t, 'ink', INK, 950);
      drawStrokes(ctx, s.tangle2, t, 'ink', INK, 960);
      drawStrokes(ctx, s.q1, t, 'ink', INK, 990);
      drawStrokes(ctx, s.q2, t, 'ink', INK, 995);
      // frozen pen: an ink blot spreading under the tip
      const blot = clamp((t - (T.wall + 1.5)) / 1.0);
      if (blot > 0) {
        const x = 1180;
        const y = 1540;
        const r = 10 + 46 * easeOut(blot);
        const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(25,18,32,0.95)');
        gr.addColorStop(0.75, 'rgba(25,18,32,0.85)');
        gr.addColorStop(1, 'rgba(25,18,32,0)');
        ctx.fillStyle = gr;
        ctx.beginPath();
        for (let k = 0; k <= 30; k++) {
          const a = (k / 30) * Math.PI * 2;
          const rr = r * (1 + 0.12 * noise1(k * 0.7, 3));
          ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.fill();
      }
      if (crack > 0) this.drawCracks(ctx, crack);
    });
  }

  cracks: Pt[][] = [];
  drawCracks(ctx: CanvasRenderingContext2D, c: number) {
    if (this.cracks.length === 0) {
      const r = rng(99);
      const cx = 1150;
      const cy = 1350;
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + r() * 0.3;
        const pts: Pt[] = [[cx, cy]];
        let x = cx;
        let y = cy;
        let aa = a;
        for (let k = 0; k < 14; k++) {
          aa += (r() - 0.5) * 0.6;
          const step = 50 + r() * 70;
          x += Math.cos(aa) * step;
          y += Math.sin(aa) * step;
          pts.push([x, y]);
        }
        this.cracks.push(pts);
      }
    }
    ctx.save();
    ctx.lineCap = 'round';
    this.cracks.forEach((pts, i) => {
      const p = clamp(c * 1.3 - (i % 3) * 0.1);
      ink(ctx, pts, p, 3, '#120e18', 3000 + i);
      ctx.globalAlpha = 0.6;
      ink(ctx, pts.map(([x, y]) => [x + 2, y + 3] as Pt), p, 1.5, '#fffaf2', 3100 + i);
    });
    ctx.restore();
  }

  tangleShot(t: number, sh: (a: number, h: number[]) => number, hand: (a: number, s: number) => THREE.Vector3) {
    this.show('nbB');
    this.deskB.visible = true;
    this.nbB.mesh.visible = true;
    const g = this.sets.nbB;
    const lt = t - T.tangle;
    this.drawNotebookB(t);
    const tp = activeTip(this.strokesB.tangle1, t);
    if (tp) {
      this.pens.nbB.visible = true;
      this.tip(this.pens.nbB, this.nbB, tp.pt, tp.down ? 0 : 0.06, V(0.4, 0.45, 1));
    }
    const look = this.nbB.local(1000, 1300);
    const ang = lt * 0.35;
    const local = look.clone().add(V(Math.sin(ang) * 0.8, -0.6 + Math.cos(ang) * 0.1, 1.5 - lt * 0.3)).add(hand(0.02, 13));
    return {
      pose: {pos: g.localToWorld(local), look: g.localToWorld(look.clone()), fov: 32, roll: 0.05 + lt * 0.12, up: g.quaternion},
      post: {focus: 1.65 - lt * 0.3, aperture: 14, warm: 0.6, exposure: 1.0, ca: 0.02},
    };
  }

  wallShot(t: number, sh: (a: number, h: number[]) => number, hand: (a: number, s: number) => THREE.Vector3) {
    const lt = t - T.wall;
    const beats = [0, 0.85, 1.45, 1.95, 2.3, 2.6];
    const kick = sh(0.035, beats.map((b) => T.wall + b)) + (lt > 2.6 ? noise1(t * 40, 5) * 0.006 * (lt - 2.6) * 6 : 0);
    // screen shots
    if (lt < 1.45 || (lt >= 1.95 && lt < 2.3)) {
      this.show('screen');
      const g = this.sets.screen;
      const n = Math.floor(clamp(lt / 0.8) * wallCode.length);
      const noise = clamp((lt - 0.85) / 0.5);
      this.screen.draw(`S${n}${noise.toFixed(2)}${lt >= 1.95 ? 1 : 0}`, (ctx) => {
        ctx.save();
        ctx.font = `500 50px ${fontFamily}`;
        ctx.fillStyle = 'rgba(38,30,40,0.92)';
        ctx.filter = 'blur(1.2px)';
        for (let i = 0; i < Math.max(n, lt > 0.8 ? wallCode.length : 0); i++) ctx.fillText(wallCode[i], 140, 120 + i * 47);
        if (noise > 0) {
          // a second slide bleeding through: overlapping code noise
          ctx.globalAlpha = 0.35 * noise;
          for (let i = 0; i < wallCode.length; i++) ctx.fillText(wallCode[(i + 9) % wallCode.length], 1180, 90 + i * 47);
          ctx.globalAlpha = 0.25 * noise;
          for (let i = 0; i < wallCode.length; i++) ctx.fillText(wallCode[(i + 17) % wallCode.length], 520, 140 + i * 47);
        }
        ctx.restore();
      });
      let look: THREE.Vector3;
      let pos: THREE.Vector3;
      let roll = 0;
      if (lt < 0.85) {
        look = V(-1.0, 0.55, 0);
        pos = V(0.4 - lt * 0.3, -0.5, 3.3 - lt * 1.0);
      } else if (lt < 1.45) {
        look = V(-1.2 + (lt - 0.85) * 0.8, 0.6, 0);
        pos = look.clone().add(V(0.7, -0.4, 1.6));
        roll = 0.14;
      } else {
        look = V(0.4, -0.3, 0);
        pos = look.clone().add(V(-0.5, 0.2, 1.1));
        roll = -0.18;
      }
      pos.add(V(kick, kick, 0)).add(hand(0.02, 17));
      return {
        pose: {pos: pos.add(g.position), look: look.add(g.position), fov: 32, roll: roll + kick},
        post: {focus: pos.distanceTo(look), aperture: 8, warm: 0.5, exposure: 1.0, ca: 0.022 + lt * 0.008, motion: [kick * 0.3, 0]},
      };
    }
    // notebook B shots: frozen pen, question marks, tangles, the break page
    this.show('nbB');
    this.deskB.visible = true;
    this.nbB.mesh.visible = true;
    const g = this.sets.nbB;
    const crack = clamp((t - (T.shatter - 0.09)) / 0.09);
    this.drawNotebookB(t, crack);
    if (t < T.breakPage) {
      const tp = activeTip(this.strokesB.tangle2, t);
      this.pens.nbB.visible = true;
      this.tip(this.pens.nbB, this.nbB, tp && t > T.wall + 2.3 ? tp.pt : [1180, 1540], 0, V(0.4, 0.45, 1));
    }
    let look: THREE.Vector3;
    let local: THREE.Vector3;
    let roll = 0;
    if (t < T.breakPage) {
      look = lt < 2 ? this.nbB.local(1200, 1600) : this.nbB.local(1000, 1200);
      local = look.clone().add(lt < 2 ? V(0.3, -0.5, 0.9) : V(-0.5, -0.6, 1.2));
      roll = lt < 2 ? -0.1 : 0.16;
    } else {
      // the break page: frontal, exactly the world camera's first pose
      look = V(0, 0, 0);
      local = V(0, 0, 2.3);
    }
    local.add(V(kick * 0.5, kick * 0.5, 0));
    const isBreak = t >= T.breakPage;
    return {
      pose: {pos: g.localToWorld(local), look: g.localToWorld(look.clone()), fov: isBreak ? camAt(T.shatter).fov : 32, roll: isBreak ? kick * 0.3 : roll + kick, up: g.quaternion},
      post: {focus: isBreak ? 2.3 : 1.2, aperture: isBreak ? 0 : 14, warm: 0.55, exposure: 1.0 + crack * 0.6, ca: 0.03, motion: [kick * 0.3, kick * 0.2]},
    };
  }

  lightsFor(set: 'nbA' | 'easy', k: number) {
    const [d, h] = this.lights.nbA as [THREE.DirectionalLight, THREE.HemisphereLight];
    const [p, a] = this.lights.easy as [THREE.PointLight, THREE.HemisphereLight];
    if (set === 'nbA') {
      d.intensity = 2.6;
      h.intensity = 0.32;
      p.intensity = 0;
      a.intensity = 0;
    } else {
      d.intensity = 2.6 * (1 - k) + 0.35 * k;
      d.color.set('#ffdcbc');
      h.intensity = 0.32 * (1 - k);
      p.intensity = 9 * k;
      a.intensity = 2.2 * k;
    }
  }

  easyShot(t: number, hand: (a: number, s: number) => THREE.Vector3) {
    this.show('nbA');
    const g = this.sets.nbA;
    const lt = t - T.easy;
    const k = easeInOut(inv(0, 0.6, lt));
    this.lightsFor('easy', k);
    const lift = easeInOut(inv(0.2, 0.9, lt));
    this.drawNotebookA(T.oldWay, Math.max(0.0001, lift), t);
    const tp = activeTip(this.cleanStrokes, t);
    if (tp && lt < 2.1) {
      this.pens.nbA.visible = true;
      this.tip(this.pens.nbA, this.nbA, tp.pt, tp.down ? 0 : 0.05, V(0.4, 0.45, 1));
    }
    const look = this.nbA.local(1000, 2050 - lt * 30);
    const dist = 1.7 - lt * 0.18;
    const pos = look.clone().add(V(-0.25, -0.55, 1).normalize().multiplyScalar(dist)).add(hand(0.008, 21));
    return {
      pose: {pos: pos.add(g.position), look: look.add(g.position), fov: 30, roll: 0.02},
      post: {focus: dist, aperture: 12, warm: 0.15 * (1 - k), exposure: 1.0, ca: 0.015, bloom: 0.5, threshold: 1.0},
    };
  }
}
