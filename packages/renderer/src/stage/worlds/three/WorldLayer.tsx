import React, { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { StageModel } from '../../model/StageModel';
import type { StageDriver } from '../../three/driver';
import type { SceneBounds } from '../../three/StageEnvironment';
import { CastLayer } from './CastLayer';
import type { Playhead } from '../../timeline/Playhead';
import { PolarWorld } from './PolarWorld';
import { BambooWorld } from './BambooWorld';
import { ReefWorld } from '../ocean/three/ReefWorld';
import { PodLayer } from '../ocean/three/PodLayer';
import { ColonyLayer } from './ColonyLayer';
import { Colony } from '../idle';
import { advanceDay, blankDay, dayAt, dayTime, type DayState } from '../daycycle';

/**
 * A world in place of the studio environment: its surroundings and its
 * crew. Worlds are alive (snow falls, bamboo sways, animals breathe), so
 * the canvas keeps drawing while one is shown, except in calm mode, where
 * the ambient clock stops and only the algorithm moves.
 */
/** Ambient time shared by the world and its crew, and the moments the crew set things off in the world. */
export interface WorldClock {
  /** Seconds of ambient time (stops in calm mode). */
  now: number;
  /** Wall-clock second at which an animal last pulled a fish from the fishing hole (the world makes the splash). */
  fishAt: number;
  /** Where each crew member is and how fast it moves (the grove rustles as they pass), and which snack stalk it is chewing (-1: none). */
  crew: { x: number; y: number; z: number; speed: number }[];
  chew: number[];
  /** The time of day (the grove has a day and a night; the other worlds ignore it). */
  day: DayState;
  /** Every panda that goes about its own business in the grove (the crew when free, and the rest of the colony). */
  colony: Colony;
}

export function WorldLayer({ model, bounds, driver, calm, playhead }: { model: StageModel; bounds: SceneBounds; driver: StageDriver; calm: boolean; playhead: Playhead }) {
  const invalidate = useThree((s) => s.invalidate);
  const clock = useMemo<WorldClock>(
    () => ({ now: 0, fishAt: -100, crew: Array.from({ length: 10 }, () => ({ x: 0, y: 0, z: 0, speed: 0 })), chew: Array.from({ length: 10 }, () => -1), day: dayAt(dayTime(), blankDay()), colony: new Colony() }),
    [],
  );
  useFrame((_, delta) => {
    if (calm) return;
    const dt = Math.min(delta, 0.1);
    clock.now += dt;
    if (model.world === 'panda') {
      advanceDay(dt);
      dayAt(dayTime(), clock.day);
    }
    invalidate();
  });
  if (model.world === 'studio') return null;
  if (model.world === 'ocean') {
    return (
      <>
        <ReefWorld model={model} bounds={bounds} driver={driver} calm={calm} clock={clock} />
        <PodLayer model={model} driver={driver} calm={calm} clock={clock} playhead={playhead} />
      </>
    );
  }
  const World = model.world === 'penguin' ? PolarWorld : BambooWorld;
  return (
    <>
      <World model={model} bounds={bounds} driver={driver} calm={calm} clock={clock} />
      <CastLayer model={model} driver={driver} style={model.world} calm={calm} clock={clock} playhead={playhead} />
      {model.world === 'panda' && <ColonyLayer model={model} driver={driver} calm={calm} clock={clock} playhead={playhead} />}
    </>
  );
}
