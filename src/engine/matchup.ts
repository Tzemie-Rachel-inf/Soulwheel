/**
 * Damage against what it hits. Every weapon deals a kind of damage and every suit of armour
 * turns one (`GearItem.damage`, `.resists`); every foe has kinds it is weak to, resists or
 * barely feels (`Foe.weak`, `.resists`, `.immune`), and a kind its own blows deal (`Foe.strikes`).
 *
 *   a hit       weak ×1.3 · neutral ×1 · resisted ×0.75 · immune ×0.5
 *   a blow      ×0.7 when the hero's armour turns its kind
 *
 * A one-spin fight folds both into the hero's odds (`fightMatchup`); a battle applies them to
 * each hit (engine/battle.ts).
 */
import type { Character, DamageType, Foe } from './types';

export type Matchup = 'weak' | 'resisted' | 'immune' | 'neutral';

export const MATCHUP_MULT: Record<Matchup, number> = { weak: 1.3, neutral: 1, resisted: 0.75, immune: 0.5 };
/** What armour that turns a blow's kind leaves of it. */
export const TURNED_MULT = 0.7;
/** What turning the foe's blows is worth to a one-spin fight's odds. */
const TURNED_ODDS = 1.15;

/** How a kind of damage meets this foe. Immunity outranks resistance, which outranks weakness. */
export function matchupOf(damage: DamageType | undefined, foe: Foe): Matchup {
  if (!damage) return 'neutral';
  if (foe.immune?.includes(damage)) return 'immune';
  if (foe.resists?.includes(damage)) return 'resisted';
  if (foe.weak?.includes(damage)) return 'weak';
  return 'neutral';
}

/** What the hero hits with: their weapon's kind, raw arcana for those who carry none by choice, else their fists. */
export function heroDamage(char: Character): DamageType {
  if (char.weapon?.damage) return char.weapon.damage;
  return char.rules?.noWeapon ? 'arcane' : 'bludgeoning';
}

/** The multiplier on the hero's hits against this foe. */
export function attackMult(char: Character, foe: Foe): number {
  return MATCHUP_MULT[matchupOf(heroDamage(char), foe)];
}

/** True when the hero's armour turns this kind of blow. */
export function turns(char: Character, damage: DamageType | undefined): boolean {
  return damage !== undefined && char.armor?.resists === damage;
}

/** What the foe's ordinary blows deal. */
export function foeStrikes(foe: Foe): DamageType {
  return foe.strikes ?? 'bludgeoning';
}

/** The multiplier on a blow of this kind against the hero. */
export function defenseMult(char: Character, damage: DamageType | undefined): number {
  return turns(char, damage) ? TURNED_MULT : 1;
}

/**
 * The matchup as a one-spin fight feels it: the hero's Combat Power is multiplied by this.
 * A weakness hit ×1.3; armour that turns the foe's blows ×1.15. 1 when nothing applies.
 */
export function fightMatchup(char: Character, foe: Foe): number {
  return attackMult(char, foe) * (turns(char, foeStrikes(foe)) ? TURNED_ODDS : 1);
}

/** For showing: how the hero's weapon meets the foe, and whether their armour turns its blows. */
export function describeMatchup(char: Character, foe: Foe): { damage: DamageType; matchup: Matchup; turned: boolean; strikes: DamageType; mult: number } {
  const damage = heroDamage(char);
  const strikes = foeStrikes(foe);
  return { damage, matchup: matchupOf(damage, foe), turned: turns(char, strikes), strikes, mult: fightMatchup(char, foe) };
}
