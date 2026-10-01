export type Status = 'planned' | 'in_progress' | 'blocked' | 'completed' | 'unverified';
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';
export type MemberId = 'manas' | 'yash' | 'tirrth' | 'pranav';
export type TaskKind = 'prereq' | 'subphase' | 'team';
export type ModelName =
  | 'Claude Sonnet 5 Low'
  | 'Claude Sonnet 5 Medium'
  | 'Claude Opus 5.5 Low'
  | 'Claude Opus 5.5 Medium'
  | 'Claude Opus 5.5 High';

export const STATUSES: Status[] = ['planned', 'in_progress', 'blocked', 'unverified', 'completed'];
export const PRIORITIES: Priority[] = ['P0', 'P1', 'P2', 'P3'];

export const STATUS_LABEL: Record<Status, string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  blocked: 'Blocked',
  completed: 'Completed',
  unverified: 'Unverified',
};

export interface TaskSeed {
  id: string;
  owner: MemberId;
  kind: TaskKind;
  /** Position in the owner's execution sequence. */
  order: number;
  phase?: number;
  area?: string;
  title: string;
  objective: string;
  scope: string;
  outOfScope?: string;
  priority: Priority;
  status: Status;
  /** YYYY-MM-DD, or null when the task has no committed date (post-IPD work). */
  deadline: string | null;
  dependencies: string[];
  expectedOutcome: string;
  definitionOfDone: string;
  verification: string;
  notes: string;
  prompt?: string;
  model?: ModelName;
}

export interface Task extends TaskSeed {
  blocker: string;
  completedAt: string | null;
  startedAt: string | null;
  /** Minutes from start to verified completion, as measured by the ledger CLI. */
  elapsedMin: number | null;
  doneBy: string | null;
  /** Refused completion attempts recorded against this task. */
  flags: number;
  lastFlag: string;
  updatedAt: string | null;
  /** Prompt as copied: the visible prompt plus its bookkeeping steps. */
  copyPrompt?: string;
}

export interface Session {
  id: string;
  /** ISO timestamp the session was recorded. */
  date: string;
  owner: MemberId;
  workedOn: string;
  completed: string;
  remaining: string;
  blockers: string;
  note: string;
  taskIds: string[];
  /** Minutes the task took, from the ledger. */
  durationMin?: number;
}

export interface Member {
  id: MemberId;
  name: string;
  role: string;
  area: string;
  tool: string;
}
