/**
 * Dev "pick" mode: while it is on, clicking a slice on any wheel spins it and lands there
 * (see `forceNextRoll`). Only offered when the dev tools are enabled.
 */
import { useSyncExternalStore } from 'react';

let enabled = false;
const listeners = new Set<() => void>();

export function setDevPick(on: boolean): void {
  enabled = on;
  listeners.forEach((l) => l());
}

export function useDevPick(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => enabled,
  );
}
