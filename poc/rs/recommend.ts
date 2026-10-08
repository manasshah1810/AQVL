import { SkillDimension } from "./score";

export interface Recommendation {
  dimension: SkillDimension;
  topic: string;
  exampleId: string;
}

export interface RemedialRecommendation {
  ruleId: string;
  remedialTopic: string;
  exampleId?: string;
}

const DIMENSION_RECOMMENDATIONS: Record<SkillDimension, Recommendation> = {
  arrays: {
    dimension: "arrays",
    topic: "Array Foundation",
    exampleId: "arrays-foundation"
  },
  recursion: {
    dimension: "recursion",
    topic: "Factorial (Recursive)",
    exampleId: "recursion-factorial"
  },
  trees: {
    dimension: "trees",
    topic: "Binary Tree Basics",
    exampleId: "tree-basics"
  },
  graphs: {
    dimension: "graphs",
    topic: "Graph Basics: Friends Network",
    exampleId: "graphs-basics"
  },
  hashing: {
    dimension: "hashing",
    topic: "Hash Function by Hand",
    exampleId: "hashmaps-hash-function"
  }
};

// Phase 3.5 logical-error catalogue is not yet created.
// These are clearly marked placeholder rule IDs.
const ERROR_RECOMMENDATIONS: Record<string, RemedialRecommendation> = {
  "PLACEHOLDER_RULE_1_OUT_OF_BOUNDS": {
    ruleId: "PLACEHOLDER_RULE_1_OUT_OF_BOUNDS",
    remedialTopic: "Array Indexing Rules",
    exampleId: "arrays-foundation"
  },
  "PLACEHOLDER_RULE_2_MISSING_BASE_CASE": {
    ruleId: "PLACEHOLDER_RULE_2_MISSING_BASE_CASE",
    remedialTopic: "Recursive Base Cases",
    exampleId: "recursion-factorial"
  },
  "PLACEHOLDER_RULE_3_INFINITE_LOOP": {
    ruleId: "PLACEHOLDER_RULE_3_INFINITE_LOOP",
    remedialTopic: "Loop Termination Conditions",
    exampleId: "loops-for-basics"
  }
};

/**
 * Returns a recommendation mapping for a given skill dimension.
 * Will return undefined if the dimension is not known.
 */
export function recommendForDimension(dimension: SkillDimension): Recommendation | undefined {
  return DIMENSION_RECOMMENDATIONS[dimension];
}

/**
 * Returns a remedial recommendation for a given logical-error rule ID.
 * Will return undefined if the rule is not known.
 */
export function recommendForError(ruleId: string): RemedialRecommendation | undefined {
  return ERROR_RECOMMENDATIONS[ruleId];
}
