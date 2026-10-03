import React from 'react';
import type { SceneElement, PartitionBoundaryRegion, SortedRegion } from '@aqvl/runtime';
import { PartitionBoundary } from './PartitionBoundary';
import { SortedRegionIndicator } from './SortedRegionIndicator';
import { findElementPosition } from '../generic/scenePositions';
import type { Vec3 } from '../generic/types';

/** The scene's ANNOTATE boundary / region ranges (SET_PARTITION_BOUNDARY, MARK_SORTED_REGION). */
export interface ArrayRegionAnnotations {
  partitionBoundaries: PartitionBoundaryRegion[];
  sortedRegions: SortedRegion[];
}

/** Partition boundaries and sorted-region floor strips, resolved against the live positions of their start/end elements. */
export const ArrayRegionDecorations: React.FC<{ elements: SceneElement[]; annotations: ArrayRegionAnnotations }> = ({
  elements,
  annotations,
}) => {
  const partitionBoundaries = annotations.partitionBoundaries
    .map((b) => ({
      boundary: b,
      startPosition: findElementPosition(elements, b.structureId, b.startIndex),
      endPosition: findElementPosition(elements, b.structureId, b.endIndex),
    }))
    .filter(
      (b): b is { boundary: PartitionBoundaryRegion; startPosition: Vec3; endPosition: Vec3 } =>
        b.startPosition !== null && b.endPosition !== null
    );

  const sortedRegions = annotations.sortedRegions
    .map((r) => ({
      region: r,
      startPosition: findElementPosition(elements, r.structureId, r.startIndex),
      endPosition: findElementPosition(elements, r.structureId, r.endIndex),
    }))
    .filter(
      (r): r is { region: SortedRegion; startPosition: Vec3; endPosition: Vec3 } =>
        r.startPosition !== null && r.endPosition !== null
    );

  return (
    <>
      {partitionBoundaries.map(({ boundary, startPosition, endPosition }) => (
        <PartitionBoundary
          key={`partition-${boundary.structureId}-${boundary.depth}`}
          startPosition={startPosition}
          endPosition={endPosition}
          depth={boundary.depth}
          label={boundary.label}
        />
      ))}
      {sortedRegions.map(({ region, startPosition, endPosition }) => (
        <SortedRegionIndicator
          key={`sorted-region-${region.structureId}`}
          startPosition={startPosition}
          endPosition={endPosition}
        />
      ))}
    </>
  );
};
