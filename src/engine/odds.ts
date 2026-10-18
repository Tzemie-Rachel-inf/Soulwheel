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
 *   common  × COMMON_FACTOR for common options, so the rarer ones come up a little more often
 *           (not on ladders, fights, choices or `exactOdds` wheels, whose odds are exact by design)
 *   fights  on a wheel with a foe, 'win' options × P(win), 'lose' options × (1 − P(win)),
 *           where P(win) = heroCP' / (heroCP' + foe.power), heroCP' being CP × the damage matchup
 *           (engine/matchup.ts: the right weapon against the foe, armour that turns its blows)
 *
 * Dealt weights are still "base" weights: they size the slices on the wheel (these are
 * this character's real chances), while world threat and locks are applied afterwards by
 * the RNG in roll.ts, which is unchanged, and never resize a slice.
 *
 * Stat values are dealt as written: banked bonuses move a stat roll after it lands (ladder.ts).
 */
import { shapeOptions, type DealContext } from './archetypes';
import { racesOf } from './character';
import { fameFactor } from './fame';
import { fightMatchup } from './matchup';
import { STAT_BASELINE, calculatePowerRating, calculateWinProbability } from './power';
import { STAT_KEYS, type Character, type GameConfig, type WheelOption, type WheelStep } from './types';

/** The chance `char` beats the wheel's foe, from Combat Power. Null when the wheel is not a fight. */
export function fightOdds(step: WheelStep, char: Character): number | null {
  if (!step.foe) return null;
  // A Trickster's pre-battle wheel bends their power for this fight only; the right weapon (and armour) bend it too.
  return calculateWinProbability(calculatePowerRating(char) * (char.fightBoost ?? 1) * fightMatchup(char, step.foe), step.foe.power);
}

/** Luck's multiplier for one option. Never negative; non-finite collapses to 0. */
export function luckFactor(option: WheelOption, char: Character): number {
  const factor = 1 + (option.luckScaling ?? 0) * char.luck;
  return Number.isFinite(factor) ? Math.max(0, factor) : 0;
}

/**
 * How the character's race bends one option: its own `odds` entry, else its family's, else 1.
 * A hybrid's races stack: each one's factor multiplies in. Never negative; non-finite collapses to 0.
 */
export function raceFactor(stepId: string, optionId: string, char: Character, config: GameConfig): number {
  let factor = 1;
  for (const id of racesOf(char)) {
    const race = config.races[id];
    const family = race?.family === undefined ? undefined : config.races[race.family];
    factor *= race?.odds?.[stepId]?.[optionId] ?? family?.odds?.[stepId]?.[optionId] ?? 1;
  }
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
    const mine = racesOf(char).flatMap((id) => [id, config?.races[id]?.family]);
    if (!option.requiresRace.some((race) => mine.includes(race))) return false;
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

/** How much common options are trimmed on an ordinary wheel. */
export const COMMON_FACTOR = 0.85;

export function commonFactor(step: WheelStep, option: WheelOption): number {
  if (step.ladder || step.foe || step.foeOf || step.choice || step.exactOdds) return 1;
  return (option.rarity ?? 'common') === 'common' ? COMMON_FACTOR : 1;
}

/**
 * A wheel's options as `char` is dealt them. Pure: the config's options are never
 * mutated; options with nothing to adjust are returned as they are. Trait outcomes the
 * character can't get are left out, so the dealt list can be shorter than the wheel's.
 * Last of all, the character's archetype has its say (archetypes.ts: `shapeOptions`): slices
 * trimmed, dreamt up, broken or reweighed. Pass `ctx.world` so locked slices are left out of that.
 */
export function dealOptions(step: WheelStep, char: Character, config: GameConfig, ctx: DealContext = {}): WheelOption[] {
  const win = fightOdds(step, char);
  const dealt = step.options.filter((written) => canBeDealt(written, char, config)).map((written) => {
    const option = written.vary ? { ...written, ...written.vary(char) } : written;
    const fight = win === null || !option.fight ? 1 : option.fight === 'win' ? win : 1 - win;
    const scale =
      raceFactor(step.id, option.id, char, config) *
      archetypeFactor(step.id, option.id, char, config) *
      personalityFactor(step.id, option.id, char, config) *
      luckFactor(option, char) *
      statFactor(option, char) *
      fameFactor(option, char, config) *
      commonFactor(step, option) *
      fight;
    if (scale === 1) return option;
    return { ...option, baseWeight: option.baseWeight * scale };
  });
  return shapeOptions(step, dealt, char, config, ctx);
}
