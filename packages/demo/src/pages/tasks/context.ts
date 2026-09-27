import { createContext, useContext } from 'react';
import type { Action } from './model';
import type { Session, Task } from './types';

export interface TasksContextValue {
  tasks: Task[];
  index: Map<string, Task>;
  sessions: Session[];
  today: string;
  dispatch: (a: Action) => void;
}

export const TasksCtx = createContext<TasksContextValue | null>(null);

export function useTasks(): TasksContextValue {
  const ctx = useContext(TasksCtx);
  if (!ctx) throw new Error('useTasks must be used inside TasksCtx');
  return ctx;
}
