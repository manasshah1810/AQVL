import React, { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { StageModel } from '../../model/StageModel';
import type { StageDriver } from '../../three/driver';
import type { SceneBounds } from '../../three/StageEnvironment';
import { CastLayer } from './CastLayer';
import { PolarWorld } from './PolarWorld';
import { BambooWorld } from './BambooWorld';

/**
 * A world in place of the studio environment: its surroundings and its
 * crew. Worlds are alive (snow falls, bamboo sways, animals breathe), so
 * the canvas keeps drawing while one is shown, except in calm mode, where
 * the ambient clock stops and only the algorithm moves.
 */
export function WorldLayer({ model, bounds, driver, calm }: { model: StageModel; bounds: SceneBounds; driver: StageDriver; calm: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  const clock = useMemo(() => ({ now: 0 }), []);
  useFrame((_, delta) => {
    if (calm) return;
    clock.now += Math.min(delta, 0.1);
    invalidate();
  });
  if (model.world === 'studio') return null;
  const World = model.world === 'penguin' ? PolarWorld : BambooWorld;
  return (
    <>
      <World model={model} bounds={bounds} driver={driver} calm={calm} clock={clock} />
      <CastLayer model={model} driver={driver} style={model.world} calm={calm} clock={clock} />
    </>
  );
}
