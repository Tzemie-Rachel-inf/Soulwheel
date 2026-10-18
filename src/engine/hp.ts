/**
 * Health. The Wounds meter (`meters.wounds`, 0–3) is what is stored: three wounds is no
 * health left, and the wounds fester. Health is that meter read the other way round, on a
 * scale the hero's body sets:
 *
 *   max health = 60 + 8 × Vitality + 6 × armour power
 *   health     = max × (1 − wounds / 3)
 *
 * So every `meters: { wounds: n }` in the config still means what it did (a wound is a third of
 * a hero's health), and a battle (engine/battle.ts) can take any fraction of it.
 */
import type { Character } from './types';

export const WOUNDS_METER = 'wounds';
/** Wounds at which there is no health left. Matches the Wounds meter's max. */
export const WOUNDS_MAX = 3;

export function maxHp(char: Character): number {
  return Math.round(60 + 8 * Math.max(0, char.stats.vitality) + 6 * (char.armor?.power ?? 0));
}

/** What is left of their health, 0–1. */
export function hpFraction(char: Character): number {
  const wounds = char.meters?.[WOUNDS_METER] ?? 0;
  return Math.min(1, Math.max(0, 1 - wounds / WOUNDS_MAX));
}

/** Health, on the hero's own scale. A hero alive with any health left shows at least 1. */
export function currentHp(char: Character): number {
  const left = maxHp(char) * hpFraction(char);
  return left > 0 ? Math.max(1, Math.round(left)) : 0;
}

/** The hero with this much of their health left (0–1), written back to the Wounds meter. */
export function withHpFraction(char: Character, fraction: number): Character {
  const wounds = Math.round(WOUNDS_MAX * (1 - Math.min(1, Math.max(0, fraction))) * 1000) / 1000;
  return { ...char, meters: { ...char.meters, [WOUNDS_METER]: wounds } };
}

/** Wounds that close on their own with every roll of an adventure: a little, more for the hardy. */
export function regenPerRoll(char: Character): number {
  return 0.03 + 0.004 * Math.max(0, char.stats.vitality);
}

/** Wounds that close between adventures, the days on the road home. */
export const REST_BETWEEN = 0.5;

/**
 * The hero with `wounds` of their wounds closed. Wounds already full are left alone: festering
 * is what comes of them, and a trickle of healing doesn't stop it.
 */
export function regenerate(char: Character, wounds: number): Character {
  const now = char.meters?.[WOUNDS_METER] ?? 0;
  if (now <= 0 || now >= WOUNDS_MAX || char.status !== 'alive') return char;
  return { ...char, meters: { ...char.meters, [WOUNDS_METER]: Math.max(0, Math.round((now - wounds) * 1000) / 1000) } };
}
