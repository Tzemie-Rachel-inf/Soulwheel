/**
 * Player settings, remembered per browser. A tiny store: read anywhere with `useSettings`,
 * outside React with `getSettings`, changed with `setSetting`.
 *
 *   wheelSpeed   normal     as it has always been
 *                dramatic   normal, but a spin that will land on something great (epic or
 *                           better), or brush past it, slows to a long crawl at the end
 *                fast       about a third of the time
 *                instant    no spin: the result at once
 */
import { useSyncExternalStore } from 'react';

export type WheelSpeed = 'normal' | 'dramatic' | 'fast' | 'instant';

export interface Settings {
  wheelSpeed: WheelSpeed;
}

const KEY = 'soulwheel.settings';
const DEFAULTS: Settings = { wheelSpeed: 'normal' };

function load(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    const speed = saved.wheelSpeed;
    return { ...DEFAULTS, ...(speed && ['normal', 'dramatic', 'fast', 'instant'].includes(speed) && { wheelSpeed: speed }) };
  } catch {
    return DEFAULTS;
  }
}

let current: Settings = load();
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  return current;
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  current = { ...current, [key]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Private windows: the setting still holds for this visit.
  }
  listeners.forEach((l) => l());
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

/** How long a spin takes at this speed, from what it would take at normal speed. */
export function spinDuration(baseMs: number, speed: WheelSpeed): number {
  if (speed === 'instant') return 1;
  if (speed === 'fast') return Math.max(1, Math.round(baseMs * 0.35));
  return baseMs;
}

/** How long a pause between automatic steps (a battle's rounds) lasts at this speed. */
export function pauseDuration(baseMs: number, speed: WheelSpeed): number {
  return speed === 'instant' ? Math.min(baseMs, 350) : speed === 'fast' ? Math.round(baseMs * 0.6) : baseMs;
}
