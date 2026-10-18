import { STAT_KEYS, type Character, type StatKey, type Trait } from './types';

/** Combat Power per point of weapon power, before the stat it is wielded with scales it. */
export const WEAPON_TIER_CP = 25;
/** Combat Power per point of armour power, before the stat it is worn with scales it. */
export const ARMOR_TIER_CP = 20;
/** The stat value everything scales from: Average. */
export const STAT_BASELINE = 10;
/** Each point of a stat above Average scales what depends on it by this much: 5%. */
export const SCALING_PER_POINT = 0.05;
/** Each point below Average costs more than a point above gains: 8%. A weak arm is a real handicap. */
export const LOW_SCALING_PER_POINT = 0.08;
/** The least a stat can leave of what depends on it. */
export const MIN_STAT_SCALE = 0.2;

/**
 * What a stat multiplies (gear's Combat Power, a trait's, a weapon's damage): ×1 at Average
 * (10), 5% more per point above, 8% less per point below, never under ×0.2.
 *
 *   stat   1     3     5     7     10   15     20   25
 *   ×      0.28  0.44  0.6   0.76  1    1.25   1.5  1.75
 */
export function statScale(value: number): number {
  if (value >= STAT_BASELINE) return 1 + SCALING_PER_POINT * (value - STAT_BASELINE);
  return Math.max(MIN_STAT_SCALE, 1 - LOW_SCALING_PER_POINT * (STAT_BASELINE - value));
}

/**
 * The stat their weapon is wielded with: the weapon's own (an Assassin: Agility, whatever it is).
 * Bare hands: whichever of Might and Agility is better.
 */
export function weaponStat(char: Pick<Character, 'rules' | 'weapon' | 'stats'>): StatKey {
  if (char.rules?.weaponStat) return char.rules.weaponStat;
  if (char.weapon) return char.weapon.stat;
  return char.stats.agility > char.stats.might ? 'agility' : 'might';
}

/** The stat armour is worn with when it names none: Vitality, the strength to carry it and keep standing in it. */
export const ARMOR_STAT: StatKey = 'vitality';

/**
 * The stat their armour is worn with: the armour's own (Vitality, without any), or a better one
 * their archetype allows (an Assassin's Agility).
 */
export function armorStat(char: Character): StatKey {
  const options = [char.armor?.stat ?? ARMOR_STAT, ...(char.rules?.armorStats ?? [])];
  return options.reduce((best, key) => (char.stats[key] > char.stats[best] ? key : best));
}

/** A spell: a trait whose power grows with Arcana. An Archmage's are worth more. */
export function isSpell(trait: Trait): boolean {
  return trait.scalesWith?.includes('arcana') ?? false;
}

/**
 * A trait's Combat Power for this character: scaled by the best of its `scalesWith` stats, if it
 * has any. An Archmage's spells are multiplied, and a weapon they cannot hold is worth nothing.
 */
export function traitPower(trait: Trait, char: Character): number {
  if (char.rules?.noWeapon && trait.item === 'weapon') return 0;
  const spell = isSpell(trait) && trait.item !== 'weapon' && trait.item !== 'armor' ? (char.rules?.spellMultiplier ?? 1) : 1;
  if (!trait.scalesWith?.length) return Math.round(trait.power * spell);
  return Math.round(trait.power * spell * statScale(Math.max(...trait.scalesWith.map((key) => char.stats[key]))));
}

/** CP split into its terms, so the Character Card can show where power comes from. */
export interface PowerBreakdown {
  /** Sum of all stats. */
  stats: number;
  /** Weapon power × WEAPON_TIER_CP × the scale of the stat it is wielded with. */
  weapon: number;
  /** That scale, for showing. */
  weaponScale: number;
  /** Armour power × ARMOR_TIER_CP × the scale of the stat it is worn with. */
  armor: number;
  /** That scale, for showing. */
  armorScale: number;
  /** Sum of every trait's power, spells scaled by Arcana and so on (`traitPower`). Gear abilities included. */
  traits: number;
  /** Product of every trait's `multiplier` (1 when none has one). */
  multiplier: number;
  /** (stats + weapon + armor + traits) × multiplier, rounded and floored at 0. */
  total: number;
}

export function getPowerBreakdown(char: Character): PowerBreakdown {
  const stats = STAT_KEYS.reduce((sum, key) => sum + char.stats[key], 0);
  const weaponScale = statScale(char.stats[weaponStat(char)]);
  const weapon = char.rules?.noWeapon ? 0 : Math.round((char.weapon?.power ?? 0) * WEAPON_TIER_CP * weaponScale);
  const armorScale = statScale(char.stats[armorStat(char)]);
  const armor = Math.round((char.armor?.power ?? 0) * ARMOR_TIER_CP * armorScale);
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
 * its power × 25, scaled by the stat it is wielded with, armour is its power × 20, scaled by the
 * stat it is worn with, and each trait's power is scaled by its own stat (spells by Arcana).
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
