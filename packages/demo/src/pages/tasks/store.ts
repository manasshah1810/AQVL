import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SEEDS, STORAGE_KEY, emptyState, isPersistedState, mergeTasks, reducer, toDateKey } from './model';
import type { Action } from './model';
import type { PersistedState } from './types';

export function loadState(): PersistedState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return isPersistedState(parsed) ? parsed : emptyState();
  } catch {
    return emptyState();
  }
}

function persist(state: PersistedState): string | null {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return null;
  } catch {
    return 'Changes could not be saved in this browser (storage blocked or full). Export a backup.';
  }
}

export function useTaskStore() {
  const [state, setState] = useState<PersistedState>(loadState);
  const [saveError, setSaveError] = useState<string | null>(null);
  const stateRef = useRef(state);

  const dispatch = useCallback((action: Action) => {
    const next = reducer(stateRef.current, action);
    stateRef.current = next;
    setState(next);
    setSaveError(persist(next));
  }, []);

  // Keep several open tabs in sync (the other tab already wrote storage).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const next = JSON.parse(e.newValue);
        if (isPersistedState(next)) {
          stateRef.current = next;
          setState(next);
        }
      } catch {
        /* ignore malformed writes from elsewhere */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const tasks = useMemo(() => mergeTasks(SEEDS, state), [state]);
  return { state, tasks, dispatch, saveError };
}

/** Today's date key; rolls over at midnight so overdue flags stay correct in a tab left open. */
export function useToday(): string {
  const [today, setToday] = useState(() => toDateKey(new Date()));
  useEffect(() => {
    const id = window.setInterval(() => {
      const k = toDateKey(new Date());
      setToday((prev) => (prev === k ? prev : k));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return today;
}

export function exportState(state: PersistedState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aqvl-tasks-${toDateKey(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = legacyCopy();
    document.body.removeChild(ta);
    return ok;
  }
}

function legacyCopy(): boolean {
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  }
}
