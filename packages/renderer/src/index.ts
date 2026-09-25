export { AQVECanvas } from './components/AQVECanvas';
export { GenericSceneRenderer } from './components/generic/GenericSceneRenderer';
export type { GenericSceneRendererProps } from './components/generic/GenericSceneRenderer';
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
