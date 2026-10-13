/**
 * How each rarity tier looks. Presentation only: the engine never reads this, and a
 * tier never changes an option's odds.
 *
 * Text colours clear 4.5:1 against the slab panels (#232a3e), so they double as
 * readable labels, not just decoration.
 */
import { RARITIES, type Rarity, type WheelOption } from '../engine/types';

export interface RarityStyle {
  label: string;
  /** Chips, labels, the gem band on the wheel's rim, and the reveal's accents. */
  color: string;
  /** Twinkling stars set into the rim over this slice. 0 = none. */
  sparkles: number;
  /** Peak opacity of the light pulsing behind the glass. 0 = none. */
  glow: number;
}

export const RARITY_STYLES: Record<Rarity, RarityStyle> = {
  common: { label: 'Common', color: '#a3a9bb', sparkles: 0, glow: 0 },
  uncommon: { label: 'Uncommon', color: '#5fcf8f', sparkles: 0, glow: 0 },
  rare: { label: 'Rare', color: '#5aa9ff', sparkles: 2, glow: 0 },
  epic: { label: 'Epic', color: '#bd85ff', sparkles: 3, glow: 0.2 },
  legendary: { label: 'Legendary', color: '#ffb84d', sparkles: 4, glow: 0.34 },
  mythical: { label: 'Mythical', color: '#ff7ad1', sparkles: 6, glow: 0.48 },
};

export function rarityOf(option: Pick<WheelOption, 'rarity'> | undefined): Rarity {
  return option?.rarity ?? 'common';
}

export function rarityStyle(option: Pick<WheelOption, 'rarity'> | undefined): RarityStyle {
  return RARITY_STYLES[rarityOf(option)];
}

/**
 * A stat's standing as a tier, for the Character Card's decorations: up to Average is common,
 * Strong (13) uncommon, Mighty (16) rare, Herculean (20) epic, the top of the ladder (25) and
 * Ascension legendary, and 80 or more mythical.
 */
export function statRarity(value: number): Rarity {
  if (value >= 80) return 'mythical';
  if (value >= 25) return 'legendary';
  if (value >= 20) return 'epic';
  if (value >= 16) return 'rare';
  if (value >= 13) return 'uncommon';
  return 'common';
}

/** Rare and above get the full treatment: sparkles on the wheel and a flourish when rolled. */
export function isSpecialRarity(rarity: Rarity): boolean {
  return RARITIES.indexOf(rarity) >= RARITIES.indexOf('rare');
}
