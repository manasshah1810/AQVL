/**
 * The DSA decorations, attached to GenericSceneRenderer through the generic
 * decoration-provider seam (generic/decorationProviders.ts) rather than
 * imported by it. Registration order is draw order, and matches the order the
 * renderer drew these in before the seam existed.
 *
 * A new decoration (another domain's, or a test's) registers the same way from
 * its own module; GenericSceneRenderer does not change.
 */
import React from 'react';
import { getArrayRegions, type SceneState } from '@aqvl/runtime';
import { registerDecorationProvider } from '../generic/decorationProviders';
import { ArrayRegionDecorations, type ArrayRegionAnnotations } from '../array/ArrayRegionDecorations';
import { LinkedListDecorations } from '../linear/LinkedListDecorations';
import { TreeDecorations } from '../tree/TreeDecorations';
import { IterationDecorations, applyIterationTreatment } from '../iteration/IterationDecorations';
import type { IterationOverlayState } from '../iteration/IterationDirector';
import { LinearDecorations, applyLinearTreatment } from '../linear/LinearDecorations';
import { LinearPointerLayer } from '../linear/LinearPointerLayer';
import type { LinearOverlayState } from '../linear/LinearDirector';

/** `sceneMetadata` key for an IterationDirector's overlay (Loops / Searching): cursors, search window, state treatments. */
export const ITERATION_OVERLAY_KEY = 'iteration';
/** `sceneMetadata` key for a LinearDirector's overlay (Stacks / Queues / Linked Lists): roles, active ends, drawn pointers. */
export const LINEAR_OVERLAY_KEY = 'linear';

/** ANNOTATE boundary / region: partition boundaries and sorted regions, read straight from the scene. */
registerDecorationProvider<ArrayRegionAnnotations>({
  key: 'arrayRegions',
  select: (scene: SceneState) => {
    const { partitionBoundaries, sortedRegions } = getArrayRegions(scene);
    return partitionBoundaries.length > 0 || sortedRegions.length > 0 ? { partitionBoundaries, sortedRegions } : null;
  },
  renderUnderlay: ({ elements, data }) => <ArrayRegionDecorations elements={elements} annotations={data} />,
});

/** Linked-list names and heap boxes; draws nothing when the scene has no list. */
registerDecorationProvider<true>({
  key: 'linkedList',
  select: () => true,
  renderOverlay: ({ elements }) => <LinkedListDecorations elements={elements} />,
});

/** Tree names, call stack and heap boxes; draws nothing when the scene has no tree. */
registerDecorationProvider<true>({
  key: 'tree',
  select: () => true,
  renderOverlay: ({ elements }) => <TreeDecorations elements={elements} />,
});

registerDecorationProvider<IterationOverlayState>({
  key: ITERATION_OVERLAY_KEY,
  treatNode: applyIterationTreatment,
  renderOverlay: ({ elements, data }) => <IterationDecorations elements={elements} overlay={data} />,
});

// List pointers are drawn by LinearPointerLayer (they draw / retract / re-aim visibly), not as plain edges.
registerDecorationProvider<LinearOverlayState>({
  key: LINEAR_OVERLAY_KEY,
  treatNode: applyLinearTreatment,
  claimsConnection: (c) => !!c.pointer,
  renderUnderlay: ({ connections }) => <LinearPointerLayer connections={connections} />,
  renderOverlay: ({ sceneState, data }) => <LinearDecorations elements={sceneState.elements} overlay={data} />,
});
