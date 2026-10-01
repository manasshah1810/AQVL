/// <reference path="./troika-three-text.d.ts" />
import React, { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Group, Mesh, MeshPhysicalMaterial, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Text } from 'troika-three-text';
import type { StageModel } from '../model/StageModel';
import type { LabelOut, StageSample } from '../model/sampler';
import type { StageDriver } from './driver';

export interface StageFonts {
  mono: string;
  monoItalic: string;
}

interface Entry {
  text: Text;
  slab: Mesh | null;
  shown: string;
  size: number;
  anchor: string;
  font: string;
  color: string;
}

const Z_AXIS = new Vector3(0, 0, 1);

/**
 * Every piece of text in the scene (values, indices, tags, name plates,
 * cursors, weights, call frames): troika SDF text, billboarded to the
 * camera, positioned from the same sample as the bodies they label.
 */
export function LabelLayer({ model, driver, fonts }: { model: StageModel; driver: StageDriver; fonts: StageFonts }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const group = useMemo(() => new Group(), []);
  const slabGeometry = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 3, 0.08), []);
  const slabMaterial = useMemo(
    () => new MeshPhysicalMaterial({ color: model.palette.frame, roughness: 0.5, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
    [model],
  );

  useEffect(() => {
    const entries = new Map<string, Entry>();
    let keysVersion = -1;

    const create = (label: LabelOut): Entry => {
      const text = new Text();
      text.font = label.font === 'serif' ? fonts.monoItalic : fonts.mono;
      text.anchorY = 'middle';
      text.sdfGlyphSize = 64;
      text.renderOrder = 10;
      text.material.depthWrite = false;
      group.add(text);
      let slab: Mesh | null = null;
      if (/^frame:\d+$/.test(label.key)) {
        slab = new Mesh(slabGeometry, slabMaterial);
        slab.castShadow = true;
        slab.receiveShadow = true;
        group.add(slab);
      }
      return { text, slab, shown: '', size: 0, anchor: '', font: '', color: '' };
    };

    const syncKeys = (sample: StageSample) => {
      const alive = new Set(sample.labelKeys);
      for (const [key, entry] of entries) {
        if (alive.has(key)) continue;
        group.remove(entry.text);
        entry.text.dispose();
        if (entry.slab) group.remove(entry.slab);
        entries.delete(key);
      }
      for (const key of sample.labelKeys) {
        if (!entries.has(key)) {
          const label = sample.labels.get(key);
          if (label) entries.set(key, create(label));
        }
      }
    };

    const unregister = driver.register((sample) => {
      if (sample.labelVersion !== keysVersion) {
        keysVersion = sample.labelVersion;
        syncKeys(sample);
      }
      for (const key of sample.labelKeys) {
        const label = sample.labels.get(key);
        const entry = entries.get(key);
        if (!label || !entry) continue;
        const { text } = entry;
        if (label.opacity <= 0.01 || label.text === '') {
          text.visible = false;
          if (entry.slab) entry.slab.visible = false;
          continue;
        }
        text.visible = true;
        let x = label.x;
        let y = label.y;
        let z = label.z;
        let orient = label.orient;
        let tilt = 0;
        if (label.follow >= 0) {
          const s = label.follow;
          const presence = sample.presence[s];
          x = sample.pos[s * 3];
          z = sample.pos[s * 3 + 2];
          const halfDepth = sample.dims[s * 3 + 2] * 0.5 * presence;
          if (orient === 'face') {
            // Printed on the front face; leans with the node.
            tilt = sample.tilt[s];
            y = sample.pos[s * 3 + 1] + label.y * presence + label.slide;
            x -= Math.sin(tilt) * (y - sample.pos[s * 3 + 1]);
            z += halfDepth + 0.012;
          } else if (orient === 'floor') {
            y = model.floorY + 0.2;
            z += halfDepth + label.y;
          } else {
            y = sample.pos[s * 3 + 1] + label.y * Math.max(0.3, presence) + label.slide;
          }
        } else if (label.follow === -2) {
          orient = 'billboard';
        }
        if (entry.slab) {
          // A call-stack frame: a slab with its call printed on the front.
          const width = Math.max(2.2, label.text.length * label.size * 0.62 + 0.7);
          const grow = Math.min(1, label.opacity);
          entry.slab.visible = true;
          entry.slab.position.set(x, y, z);
          entry.slab.scale.set(width * grow, 0.48 * grow, 0.7 * grow);
          z += 0.35 * grow + 0.012;
          orient = 'face';
        }
        text.position.set(x, y, z);
        if (orient === 'billboard' || orient === 'floor') {
          text.quaternion.copy(camera.quaternion);
        } else {
          text.quaternion.setFromAxisAngle(Z_AXIS, tilt);
        }
        let dirty = false;
        if (entry.shown !== label.text) {
          text.text = label.text;
          entry.shown = label.text;
          dirty = true;
        }
        if (entry.size !== label.size) {
          text.fontSize = label.size;
          entry.size = label.size;
          dirty = true;
        }
        if (entry.anchor !== label.anchorX) {
          text.anchorX = label.anchorX;
          entry.anchor = label.anchorX;
          dirty = true;
        }
        const font = label.font === 'serif' ? fonts.monoItalic : fonts.mono;
        if (entry.font !== font) {
          text.font = font;
          entry.font = font;
          dirty = true;
        }
        if (entry.color !== label.color) {
          text.color = label.color;
          entry.color = label.color;
        }
        text.fillOpacity = Math.min(1, label.opacity);
        if (dirty) text.sync(invalidate);
      }
    });
    return () => {
      unregister();
      for (const entry of entries.values()) {
        group.remove(entry.text);
        entry.text.dispose();
        if (entry.slab) group.remove(entry.slab);
      }
      entries.clear();
    };
  }, [driver, camera, group, fonts, slabGeometry, slabMaterial, invalidate]);

  useEffect(
    () => () => {
      for (const child of [...group.children]) {
        if (child instanceof Text) child.dispose();
      }
      group.clear();
      slabGeometry.dispose();
      slabMaterial.dispose();
    },
    [group, slabGeometry, slabMaterial],
  );

  return <primitive object={group} />;
}
