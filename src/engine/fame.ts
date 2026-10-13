/**
 * Fame: renown earned on adventures. It replaces counting adventures toward retirement.
 *
 *   every adventure roll ──▶ fame earned (its own `fame`, else `GameConfig.fame.earn`)
 *   fame ──▶ a tier (Unknown … Mythic) ──▶ bends options with `fameScaling`, and unlocks
 *            whatever a config gates on it (the greatest challenges, a destiny)
 *
 * The engine never names a tier. The config lists them, lowest first.
 */
import type { Character, FameTier, GameConfig, WheelOption, WheelStep } from './types';

export interface FameStanding {
  /** Position in `FameConfig.tiers`: 0 for the first. */
  index: number;
  tier: FameTier;
  /** The tier above, or null at the top. */
  next: FameTier | null;
}

/** Where `value` stands among a config's tiers (lowest first): the last tier whose `min` it reaches. */
export function fameStanding(tiers: readonly FameTier[], value: number): FameStanding {
  let index = 0;
  for (let i = 1; i < tiers.length; i++) if (value >= tiers[i]!.min) index = i;
  return { index, tier: tiers[index]!, next: tiers[index + 1] ?? null };
}

/** The character's fame tier, as an index (0 for the first). Fame from older saves may be missing: 0. */
export function fameTier(config: GameConfig, char: Character): number {
  return fameStanding(config.fame.tiers, char.fame ?? 0).index;
}

/**
 * Fame one adventure roll earns: the option's own `fame` if it has one, else the config's
 * `earn` rule, for the wheel as the hero faced it. Rounded; non-finite collapses to 0.
 */
export function fameEarned(config: GameConfig, option: WheelOption, step: WheelStep, char: Character): number {
  const earned = option.fame ?? config.fame.earn(option, step, char);
  return Number.isFinite(earned) ? Math.round(earned) : 0;
}

/** Renown's multiplier for one option: max(0, 1 + fameScaling × tier). Never negative. */
export function fameFactor(option: WheelOption, char: Character, config: GameConfig): number {
  if (!option.fameScaling) return 1;
  const factor = 1 + option.fameScaling * fameTier(config, char);
  return Number.isFinite(factor) ? Math.max(0, factor) : 0;
}
