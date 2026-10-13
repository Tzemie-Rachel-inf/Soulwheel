/**
 * The character's own odds. Before a wheel is resolved or rolled, its options are
 * "dealt" to the character spinning it: the same wheel, as this particular soul faces it.
 *
 *   vary    the option's own per-character twist (`WheelOption.vary`), first of all
 *   race    × the race's odds for this option (`Race.odds`, the family's table underneath)
 *   archetype × the archetype's odds for this option (`Archetype.odds`)
 *   personality × the personality's odds for this option (`Personality.odds`)
 *   luck    baseWeight × max(0, 1 + luckScaling × char.luck)
 *   stats   × max(0, 1 + Σ statScaling[stat] × (char.stats[stat] − 10)): the best outcomes favour the sharp, the strong...
 *   fame    × max(0, 1 + fameScaling × the character's fame tier): the famous take riskier roads
 *   traits  options with `requiresTrait` are dealt only to characters who own one of those traits
 *   fights  on a wheel with a foe, 'win' options × P(win), 'lose' options × (1 − P(win)),
 *           where P(win) = heroCP / (heroCP + foe.power)
 *
 * Dealt weights are still "base" weights: they size the slices on the wheel (these are
 * this character's real chances), while world threat and locks are applied afterwards by
 * the RNG in roll.ts, which is unchanged, and never resize a slice.
 *
 * Stat values are dealt as written: banked bonuses move a stat roll after it lands (ladder.ts).
 */
import { fameFactor } from './fame';
import { STAT_BASELINE, calculatePowerRating, calculateWinProbability } from './power';
import { STAT_KEYS, type Character, type GameConfig, type WheelOption, type WheelStep } from './types';

/** The chance `char` beats the wheel's foe, from Combat Power. Null when the wheel is not a fight. */
export function fightOdds(step: WheelStep, char: Character): number | null {
  if (!step.foe) return null;
  return calculateWinProbability(calculatePowerRating(char), step.foe.power);
}

/** Luck's multiplier for one option. Never negative; non-finite collapses to 0. */
export function luckFactor(option: WheelOption, char: Character): number {
  const factor = 1 + (option.luckScaling ?? 0) * char.luck;
  return Number.isFinite(factor) ? Math.max(0, factor) : 0;
}

/**
 * How the character's race bends one option: its own `odds` entry, else its family's, else 1.
 * Never negative; non-finite collapses to 0.
 */
export function raceFactor(stepId: string, optionId: string, char: Character, config: GameConfig): number {
  const race = char.race === null ? undefined : config.races[char.race];
  const family = race?.family === undefined ? undefined : config.races[race.family];
  const factor = race?.odds?.[stepId]?.[optionId] ?? family?.odds?.[stepId]?.[optionId] ?? 1;
  return Number.isFinite(factor) ? Math.max(0, factor) : 0;
}

/** How the character's stats bend one option (`statScaling`). Never negative; non-finite collapses to 0. */
export function statFactor(option: WheelOption, char: Character): number {
  let factor = 1;
  for (const key of STAT_KEYS) factor += (option.statScaling?.[key] ?? 0) * (char.stats[key] - STAT_BASELINE);
  return Number.isFinite(factor) ? Math.max(0, factor) : 0;
}

/**
 * False for a trait-specific outcome the character has none of the traits for. (Outcomes for
 * one kind of cast character, `castCondition`, are sorted out earlier, by `getAdventureStep`.)
 */
export function canBeDealt(option: WheelOption, char: Character, config?: GameConfig): boolean {
  if (option.requiresTrait && !option.requiresTrait.some((id) => char.traits.some((t) => t.id === id))) return false;
  if (option.requiresTag && !option.requiresTag.some((tag) => char.tags.includes(tag))) return false;
  if (option.requiresRace) {
    const family = char.race === null ? undefined : config?.races[char.race]?.family;
    if (!option.requiresRace.some((race) => race === char.race || race === family)) return false;
  }
  return true;
}

/** How the character's archetype bends one option: its `odds` entry, else 1. Never negative. */
export function archetypeFactor(stepId: string, optionId: string, char: Character, config: GameConfig): number {
  const archetype = char.archetype === null ? undefined : config.archetypes[char.archetype];
  const factor = archetype?.odds?.[stepId]?.[optionId] ?? 1;
  return Number.isFinite(factor) ? Math.max(0, factor) : 0;
}

/** How the character's personality bends one option: its `odds` entry, else 1. Never negative. */
export function personalityFactor(stepId: string, optionId: string, char: Character, config: GameConfig): number {
  const personality = char.personality === null ? undefined : config.personalities[char.personality];
  const factor = personality?.odds?.[stepId]?.[optionId] ?? 1;
  return Number.isFinite(factor) ? Math.max(0, factor) : 0;
}

/**
 * A wheel's options as `char` is dealt them. Pure: the config's options are never
 * mutated; options with nothing to adjust are returned as they are. Trait outcomes the
 * character can't get are left out, so the dealt list can be shorter than the wheel's.
 */
export function dealOptions(step: WheelStep, char: Character, config: GameConfig): WheelOption[] {
  const win = fightOdds(step, char);
  return step.options.filter((written) => canBeDealt(written, char, config)).map((written) => {
    const option = written.vary ? { ...written, ...written.vary(char) } : written;
    const fight = win === null || !option.fight ? 1 : option.fight === 'win' ? win : 1 - win;
    const scale =
      raceFactor(step.id, option.id, char, config) *
      archetypeFactor(step.id, option.id, char, config) *
      personalityFactor(step.id, option.id, char, config) *
      luckFactor(option, char) *
      statFactor(option, char) *
      fameFactor(option, char, config) *
      fight;
    if (scale === 1) return option;
    return { ...option, baseWeight: option.baseWeight * scale };
  });
}
