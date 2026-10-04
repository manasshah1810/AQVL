export type SkillDimension = "arrays" | "recursion" | "trees" | "graphs" | "hashing";

export type QuestionId = "Q1" | "Q2" | "Q3" | "Q4" | "Q5";

export type Option = "A" | "B" | "C" | "D";

export interface Answer {
  questionId: string;
  option?: string | null;
}

export type SkillProfile = {
  scores: Record<SkillDimension, number>;
  weakestRanking: SkillDimension[];
};

const DIMENSION_ORDER: SkillDimension[] = [
  "arrays",
  "recursion",
  "trees",
  "graphs",
  "hashing"
];

const SCORING_RUBRIC: Record<QuestionId, { dimension: SkillDimension; weights: Record<Option, number> }> = {
  "Q1": {
    dimension: "arrays",
    weights: { A: 0, B: 4, C: 1, D: 0 }
  },
  "Q2": {
    dimension: "recursion",
    weights: { A: 0, B: 4, C: 2, D: 0 }
  },
  "Q3": {
    dimension: "trees",
    weights: { A: 0, B: 1, C: 4, D: 0 }
  },
  "Q4": {
    dimension: "graphs",
    weights: { A: 1, B: 4, C: 2, D: 0 }
  },
  "Q5": {
    dimension: "hashing",
    weights: { A: 0, B: 4, C: 1, D: 0 }
  }
};

/**
 * Pure, deterministic scoring function that converts a set of MCQ answers 
 * into per-dimension skill scores and an overall weakest-dimension ranking.
 */
export function scoreDiagnostic(answers: Answer[]): SkillProfile {
  const scores: Record<SkillDimension, number> = {
    arrays: 0,
    recursion: 0,
    trees: 0,
    graphs: 0,
    hashing: 0
  };

  const processedQuestions = new Set<string>();

  for (const answer of answers) {
    if (processedQuestions.has(answer.questionId)) {
      throw new Error(`Duplicate answer for questionId: ${answer.questionId}`);
    }
    processedQuestions.add(answer.questionId);

    const questionDef = SCORING_RUBRIC[answer.questionId as QuestionId];
    if (!questionDef) {
      throw new Error(`Unknown questionId: ${answer.questionId}`);
    }

    if (answer.option !== undefined && answer.option !== null) {
      if (answer.option !== "A" && answer.option !== "B" && answer.option !== "C" && answer.option !== "D") {
         throw new Error(`Invalid option: ${answer.option} for questionId: ${answer.questionId}`);
      }
      
      const points = questionDef.weights[answer.option as Option];
      scores[questionDef.dimension] += points;
    }
  }

  // Generate weakest ranking (lowest score first)
  // Tie-breaker: use DIMENSION_ORDER
  const weakestRanking = [...DIMENSION_ORDER].sort((a, b) => {
    const scoreDiff = scores[a] - scores[b];
    if (scoreDiff !== 0) {
      return scoreDiff; // Lowest score comes first
    }
    // Tie breaker: fixed RS1 order (a - b based on index in DIMENSION_ORDER)
    return DIMENSION_ORDER.indexOf(a) - DIMENSION_ORDER.indexOf(b);
  });

  return {
    scores,
    weakestRanking
  };
}
