import { STAT_KEYS, type Character, type StatKey, type Trait } from './types';

/** Combat Power per weapon tier, before the wielder's Might or Agility scales it. */
export const WEAPON_TIER_CP = 25;
/** Combat Power per armour tier, before the wearer's Vitality scales it. */
export const ARMOR_TIER_CP = 20;
/** The stat value everything scales from: Average. */
export const STAT_BASELINE = 10;
/** Each point of a stat above (or below) Average scales what depends on it by this much: 5%. */
export const SCALING_PER_POINT = 0.05;

/** What a stat multiplies: ×1 at Average (10), 5% more per point above, 5% less per point below, never under ×0.5. */
export function statScale(value: number): number {
  return Math.max(0.5, 1 + SCALING_PER_POINT * (value - STAT_BASELINE));
}

/** The stat a weapon is wielded with: whichever of Might and Agility is better. */
export function weaponStat(char: Character): StatKey {
  return char.stats.agility > char.stats.might ? 'agility' : 'might';
}

/** The stat armour is worn with: Vitality, the strength to carry it and keep standing in it. */
export const ARMOR_STAT: StatKey = 'vitality';

/** A trait's Combat Power for this character: scaled by the best of its `scalesWith` stats, if it has any. */
export function traitPower(trait: Trait, char: Character): number {
  if (!trait.scalesWith?.length) return trait.power;
  return Math.round(trait.power * statScale(Math.max(...trait.scalesWith.map((key) => char.stats[key]))));
}

/** CP split into its terms, so the Character Card can show where power comes from. */
export interface PowerBreakdown {
  /** Sum of all stats. */
  stats: number;
  /** weaponTier × WEAPON_TIER_CP × the scale of the better of Might and Agility. */
  weapon: number;
  /** That scale, for showing. */
  weaponScale: number;
  /** armorTier × ARMOR_TIER_CP × the scale of Vitality. */
  armor: number;
  /** That scale, for showing. */
  armorScale: number;
  /** Sum of every trait's power, spells scaled by Arcana and so on (`traitPower`). */
  traits: number;
  /** Product of every trait's `multiplier` (1 when none has one). */
  multiplier: number;
  /** (stats + weapon + armor + traits) × multiplier, rounded and floored at 0. */
  total: number;
}

export function getPowerBreakdown(char: Character): PowerBreakdown {
  const stats = STAT_KEYS.reduce((sum, key) => sum + char.stats[key], 0);
  const weaponScale = statScale(char.stats[weaponStat(char)]);
  const weapon = Math.round(char.weaponTier * WEAPON_TIER_CP * weaponScale);
  const armorScale = statScale(char.stats[ARMOR_STAT]);
  // Older saves may predate armour.
  const armor = Math.round((char.armorTier ?? 0) * ARMOR_TIER_CP * armorScale);
  const traits = char.traits.reduce((sum, trait) => sum + traitPower(trait, char), 0);
  const multiplier = char.traits.reduce((product, trait) => product * (trait.multiplier ?? 1), 1);
  return {
    stats,
    weapon,
    weaponScale,
    armor,
    armorScale,
    traits,
    multiplier,
    total: Math.max(0, Math.round((stats + weapon + armor + traits) * multiplier)),
  };
}

/**
 * Combat Power: `(stats + weapon + armour + traits) × trait multipliers`, where the weapon is
 * `weaponTier × 25`, scaled by the better of Might and Agility, armour is `armorTier × 20`,
 * scaled by Vitality, and each trait's power is scaled by its own stat (spells by Arcana).
 * See `statScale`: ×1 at Average.
 *
 * Derived on demand from what the character rolled, never stored, so it can't go stale.
 */
export function calculatePowerRating(char: Character): number {
  return getPowerBreakdown(char).total;
}

/**
 * The hero's chance to win a fight: `heroCP / (heroCP + bossCP)`.
 *
 * A 100 CP hero against a 300 CP boss wins 25% of the time. Never a flat coin flip.
 * Negative inputs are treated as 0; two 0 CP fighters get an even 50%.
 */
export function calculateWinProbability(heroCP: number, bossCP: number): number {
  const hero = Math.max(0, heroCP);
  const boss = Math.max(0, bossCP);
  return hero + boss === 0 ? 0.5 : hero / (hero + boss);
}
