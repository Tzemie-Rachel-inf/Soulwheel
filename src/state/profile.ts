/**
 * The player's profile: what outlives any one world. Feats earned (achievements.ts) and Daily
 * Soul results are kept here, in localStorage under their own key, so resetting the world
 * never takes them away. Like sound, it is a per-viewer thing: missing storage just means
 * it lasts until the page closes.
 */
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'soulwheel.profile';

/** How a Daily Soul's story went. */
export interface DailyResult {
  /** YYYY-MM-DD */
  date: string;
  characterId: string;
  name: string;
  adventures: number;
  fame: number;
  /** Their fame tier's name. */
  tier: string;
  /** How it ended, in a sentence. */
  end: string;
}

export interface Unlock {
  at: number;
  /** Who earned it, if a character did. */
  by?: string;
}

export interface Profile {
  version: 1;
  dailies: DailyResult[];
  achievements: Record<string, Unlock>;
  /** Ancestries ever rolled, across every world: for the collection feats. */
  ancestries: string[];
}

const EMPTY: Profile = { version: 1, dailies: [], achievements: {}, ancestries: [] };

function read(): Profile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const p = JSON.parse(raw) as Partial<Profile>;
    return {
      version: 1,
      dailies: Array.isArray(p.dailies) ? p.dailies : [],
      achievements: typeof p.achievements === 'object' && p.achievements !== null ? p.achievements : {},
      ancestries: Array.isArray(p.ancestries) ? p.ancestries.filter((a) => typeof a === 'string') : [],
    };
  } catch {
    return EMPTY;
  }
}

let current: Profile = read();
const listeners = new Set<() => void>();

export function getProfile(): Profile {
  return current;
}

/** Change the profile; listeners hear of it, and it is saved if storage allows. */
export function updateProfile(change: (p: Profile) => Profile): void {
  const next = change(current);
  if (next === current) return;
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // No storage: the profile lives until the page closes.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useProfile(): Profile {
  return useSyncExternalStore(subscribe, getProfile, getProfile);
}

/** Today, as the Daily Soul counts days: the viewer's own calendar date. */
export function today(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The seed every player rolls on a given day. */
export const dailySeed = (date: string) => `daily-${date}`;

/** A daily run, as a line to paste to a friend. */
export function dailyShareText(r: DailyResult): string {
  return `Soulwheel Daily Soul, ${r.date}: ${r.name}, ${r.adventures} adventure${r.adventures === 1 ? '' : 's'}, ${r.tier} (${r.fame} fame). ${r.end}.`;
}
