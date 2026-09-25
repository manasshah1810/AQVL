/**
 * Geometry AQIR types (LAYOUT / CAMERA / POSITION) — runtime side.
 *
 * This package intentionally does not depend on @aqvl/compiler (see
 * packages/runtime/src/types.ts's header comment for the established
 * pattern), so the 6 geometry instruction shapes are redeclared here
 * rather than imported — the two are kept in sync by convention with
 * packages/compiler/src/aqir/InstructionSet.ts. Both extend the existing
 * action-based `AQIRInstruction` from `@aqvl/shared`.
 *
 * `CameraFrameState` is the runtime-frame counterpart of `SetCameraInstruction`
 * (SceneState.camera — see docs/design/aqir-geometry-spec.md §2), consumed
 * by SceneState/AQVECanvas independent of the AQIR instruction stream
 * itself.
 */

import type { AQIRInstruction } from '@aqvl/shared';

export type LayoutStrategyName = 'LINE' | 'HIERARCHY' | 'CIRCULAR' | 'FORCE_DIRECTED' | 'GRID' | 'CUSTOM';

export type GeometryParamValue = number | string | [number, number, number];

export interface SetLayoutStrategyInstruction extends AQIRInstruction {
  action: 'SET_LAYOUT_STRATEGY';
  targetId: string;
  strategy: LayoutStrategyName;
  params: Record<string, GeometryParamValue>;
}

export interface SetPositionInstruction extends AQIRInstruction {
  action: 'SET_POSITION';
  elementId: string;
  x: number | null;
  y: number | null;
  z: number | null;
}

export interface ComputeLayoutInstruction extends AQIRInstruction {
  action: 'COMPUTE_LAYOUT';
  targetId: string;
}

export type CameraMode = 'FOCUS' | 'AUTO_FIT' | 'ORBIT' | 'POSITION';

export interface SetCameraInstruction extends AQIRInstruction {
  action: 'SET_CAMERA';
  mode: CameraMode;
  params: {
    targetId?: string;
    speed?: number;
    x?: number;
    y?: number;
    z?: number;
  };
}

export interface SetRotationInstruction extends AQIRInstruction {
  action: 'SET_ROTATION';
  elementId: string;
  x: number;
  y: number;
  z: number;
}

export interface SetScaleInstruction extends AQIRInstruction {
  action: 'SET_SCALE';
  elementId: string;
  x: number;
  y: number;
  z: number;
}

export type GeometryInstruction =
  | SetLayoutStrategyInstruction
  | SetPositionInstruction
  | ComputeLayoutInstruction
  | SetCameraInstruction
  | SetRotationInstruction
  | SetScaleInstruction;

/**
 * `SceneState.camera`'s shape — the resolved, current-frame counterpart of
 * the most recently executed SET_CAMERA instruction. Absent means AUTO_FIT
 * (today's always-on CameraRig behavior).
 */
export interface CameraFrameState {
  mode: CameraMode;
  targetId?: string;
  speed?: number;
  position?: { x: number; y: number; z: number };
}
