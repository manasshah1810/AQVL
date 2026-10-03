// Array-domain AQIR region instructions (docs/design/array-visual-language-spec.md
// §4.2-4.3). Domain-owned: the generic AQIR types in ../../aqir/types.ts stay
// domain-neutral, and these are re-exported from the package root unchanged.
import type { AQIRInstruction } from '../../aqir/types';

// Action: SET_PARTITION_BOUNDARY
export interface SetPartitionBoundaryInstruction extends AQIRInstruction {
  action: 'SET_PARTITION_BOUNDARY';
  structureId: string;
  startIndex: number;
  endIndex: number;
  label?: string;
}

// Action: CLEAR_PARTITION_BOUNDARY
export interface ClearPartitionBoundaryInstruction extends AQIRInstruction {
  action: 'CLEAR_PARTITION_BOUNDARY';
  structureId: string;
}

// Action: MARK_SORTED_REGION
export interface MarkSortedRegionInstruction extends AQIRInstruction {
  action: 'MARK_SORTED_REGION';
  structureId: string;
  startIndex: number;
  endIndex: number;
}

