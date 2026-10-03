export { AQVECanvas } from './components/AQVECanvas';
export { GenericSceneRenderer } from './components/generic/GenericSceneRenderer';
export type { GenericSceneRendererProps } from './components/generic/GenericSceneRenderer';
export { registerDecorationProvider, getDecorationProviders } from './components/generic/decorationProviders';
export type { DecorationProvider, DecorationContext, SceneMetadata, TreatedNode } from './components/generic/decorationProviders';
export { ITERATION_OVERLAY_KEY, LINEAR_OVERLAY_KEY } from './components/decorations/builtinProviders';
export { PrimitiveNode } from './components/generic/PrimitiveNode';
export { PrimitiveEdge } from './components/generic/PrimitiveEdge';
export type {
  RenderableElement,
  RenderableConnection,
  PrimitiveShape,
  EdgeStyle,
  HighlightState,
  Vec3,
} from './components/generic/types';
export { CameraController } from './components/camera/CameraController';
export type { CameraControllerProps, CameraControllerHandle, Vec3Like } from './components/camera/CameraController';
export { ArrayCameraChoreographer, requiredVisibilityDistance, EMPHASIS_LEVELS } from './components/array/ArrayCameraChoreographer';
export type {
  ArrayCameraInstruction,
  ArrayBounds,
  CameraFrame,
  OperationSignificance,
} from './components/array/ArrayCameraChoreographer';
export { isArrayDominantScene, computeArrayLightingProfile, DEFAULT_LIGHTING_PROFILE } from './components/array/arraySceneLighting';
export type { ArraySceneLightingProfile } from './components/array/arraySceneLighting';
export { swapEasing, shiftEasing, fadeEasing, comparisonPulseEasing } from './components/array/arrayEasing';
export type { EasingFunction } from './components/array/arrayEasing';
export { ArrayAnimationInterpolator, selectEasingForOperation } from './components/array/ArrayAnimationInterpolator';
export type { ArrayOperationType, ArrayOperationDescriptor } from './components/array/ArrayAnimationInterpolator';
export { computeSwapArcPosition, assignSwapArcSides, SWAP_ARC_LIFT, SWAP_ARC_DEPTH } from './components/array/swapMotionPath';
export type { SwapArcSide } from './components/array/swapMotionPath';
export { interpolateFrame, lerpVec3 } from './core/AnimationInterpolator';
export type { InterpolatableElement, InterpolatedElement } from './core/AnimationInterpolator';

export {
  BaseCameraChoreographer,
  requiredVisibilityDistance as baseRequiredVisibilityDistance,
  DEFAULT_FOV_DEG as BASE_DEFAULT_FOV_DEG,
  DEFAULT_HOLD_MS as BASE_DEFAULT_HOLD_MS,
  SETTLE_MS as BASE_SETTLE_MS,
  MAX_PAN_FRACTION as BASE_MAX_PAN_FRACTION,
  MAX_ZOOM_IN_FRACTION as BASE_MAX_ZOOM_IN_FRACTION,
} from './components/camera/BaseCameraChoreographer';
export type {
  BaseCameraInstruction,
  StructureBounds,
} from './components/camera/BaseCameraChoreographer';

export { CodePanel, useActiveLine } from './components/code/CodePanel';
export type { CodePanelProps, ActiveLineSource } from './components/code/CodePanel';

export { Character } from './components/character/Character';
export type { CharacterProps, ScreenAnchor } from './components/character/Character';
export { CharacterController } from './components/character/CharacterController';
export type { CharacterLine, CharacterEmotion, NarrativeCueSource } from './components/character/CharacterController';

export { IterationDirector } from './components/iteration/IterationDirector';
export type {
  IterationTopic,
  IterationOverlayState,
  IterationCursorState,
  IterationWindowState,
  IterationEngineSource,
} from './components/iteration/IterationDirector';
export { useIterationOverlay } from './components/iteration/useIterationOverlay';
export { IterationCursor } from './components/iteration/IterationCursor';
export { ITERATION_ELEMENT_STATES, iterationStateFor, getIterationTreatment } from './components/iteration/iterationStates';
export type { IterationElementState } from './components/iteration/iterationStates';
export { parseSourceStructure } from './components/iteration/sourceStructure';
export type { SourceStructure, EnclosingLoop } from './components/iteration/sourceStructure';
export type { RegionIndicatorVariant } from './components/array/SortedRegionIndicator';

// Linear pointer structures (Stacks, Queues, Linked Lists)
export { LinearDirector } from './components/linear/LinearDirector';
export type {
  LinearOverlayState,
  LinearActiveEnd,
  LinearKind,
  LinearEngineSource,
  ElementPointAt,
} from './components/linear/LinearDirector';
export { useLinearOverlay } from './components/linear/useLinearOverlay';
export { LinearCameraChoreographer, LINEAR_EMPHASIS_LEVELS } from './components/linear/LinearCameraChoreographer';
export type { LinearSignificance, LinearCameraInstruction } from './components/linear/LinearCameraChoreographer';
export { LINEAR_ROLE_TREATMENTS, getLinearTreatment } from './components/linear/linearStates';
export type { LinearRole } from './components/linear/linearStates';
export { PointerArrow } from './components/linear/PointerArrow';
export { LinearPointerLayer, diffPointers } from './components/linear/LinearPointerLayer';
export { CharacterAnchorBridge, CharacterAnchorTracker } from './components/character/CharacterAnchor';
export type { CameraChoreographer } from './components/camera/BaseCameraChoreographer';

// --- Visualizer v2: the trace-driven stage (see docs/design/visualizer-v2/README.md) ---
export * from './stage';
