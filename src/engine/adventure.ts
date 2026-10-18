/**
 * Adventures: a living hero spins the adventure wheels until the road ends. Same rules as
 * creation: every winner is decided before any animation, and the World is read-only until
 * `completeAdventure` writes the result.
 *
 *   adventure wheels ──(next step null)──────────────────────────▶ home again
 *          ├──(an option sets an exit status: fallen, retired, sealed...)──▶ over, out of play
 *          └──(an option gives a new role: outlaw, minion, a new life)─────▶ over, still in the world
 *
 * There is no retirement wheel. Every roll earns fame (`GameConfig.fame`): more for harder
 * foes and grander wins. Fame bends the odds toward riskier roads (`fameScaling`) and unlocks
 * whatever the config gates on it; endings (a throne, a sacrifice, a seat in the Hall of
 * Fame) are ordinary options that set a status or a role, and an option's `fate` writes how
 * the story ended.
 *
 * Cast: a wheel with `cast` features a character already in the world (a retired legend,
 * an outlaw, a grave, a ruler). As the adventure arrives at that wheel, a "who is it?" wheel
 * decides who, if there are two or more to choose from (up to MAX_CAST_CHOICES of them,
 * picked at random); a lone candidate simply appears. As a foe, their Combat Power is the
 * power to beat. Options can be dealt only for some kinds of cast character
 * (`castCondition`), take from them (`spoils`), and change them (`castEffect`); changes to
 * them are written with the adventure.
 *
 * Titles: an adventure roll with an `epithet` that outranks every title the hero has earned
 * becomes their title on the spot ("Champion of the Realm").
 *
 * The road home (`AdventureConfig.roadHome`): an adventure that would end after a spin or two
 * meets one more wheel on the way back, once.
 *
 * Meters (`GameConfig.meters`): pressure that builds across a life. Options move them; some rise
 * on their own each adventure (a vampire's hunger). When the road would end with a meter full,
 * its trigger wheel comes up instead (the wounds fester, the hunger takes over), and it empties.
 *
 * Places: an option can find a place (`place.discover`), which this adventure then explores
 * (`Character.expedition`, like a quest's story) and `completeAdventure` puts on the world's
 * map. A wheel that `visitsPlace` takes a hero back to one, the deeper the richer and deadlier.
 *
 * Spoils: every fight won (bar those that take nothing: `noSpoils`) is followed by a Spoils
 * wheel, drawn from the fallen foe's loot table (`Foe.loot`) and, for a foe from the world, what
 * they carried. Gear: an item for a slot already filled is never swapped in by itself. A
 * Keep / Take choice comes up first (`GEAR_STEP_ID`), and the road goes on once it is decided.
 */
import { settleStake, spinSalt, stakeOf, substituteStep } from './archetypes';
import { BATTLE_STEP_PREFIX, applyClash, autoCast, castSpell, createClashStep, heroUnits, isBattleFight, isBattleStep, isBossFight, poolsOf, startBattle, BATTLE_POOL, type BattleState } from './battle';
import { REST_BETWEEN, WOUNDS_MAX, WOUNDS_METER, maxHp, regenPerRoll, regenerate, withHpFraction } from './hp';
import { defenseMult, foeStrikes } from './matchup';
import { addMeters, applyEffects, applySpoils, earnedTitle } from './character';
import { chooseGear, lootShift, offerIsBetter, pendingOffer, rollLoot, uniquesInWorld, type LootRoll } from './gear';
import { EngineError } from './errors';
import { fameEarned } from './fame';
import { GEAR_STEP_ID, createGearStep, describeGear, isGearStep } from './gearStep';
export { GEAR_STEP_ID, createGearStep, describeGear, isGearStep };
import { DECIDED_DRAW, MAX_GENERATION_STEPS, autoPick, decided, getStep, resolveNextStep, type Decision } from './generation';
import { dealOptions } from './odds';
import { calculatePowerRating } from './power';
import { createId, defaultRng, type Rng } from './rng';
import { resolveSlices, rollWeightedOption } from './roll';
import { applyStory, markSeen, storyText } from './story';
import {
  STAT_KEYS,
  type AdventureRecord,
  type CastEffect,
  type Character,
  type ExitStatus,
  type Expedition,
  type Foe,
  type GameConfig,
  type MeterDef,
  type Place,
  type QuestRecord,
  type RollRecord,
  type RollResult,
  type SpellMode,
  type WheelOption,
  type WheelStep,
  type World,
} from './types';
import { findCharacter, placeCharacter } from './world';

/** "Who is it?" wheels are addressed as `who:<the cast wheel's id>`. They are built on the spot. */
export const WHO_STEP_PREFIX = 'who:';
/** The most candidates a "who is it?" wheel shows. */
export const MAX_CAST_CHOICES = 8;

/** Spoils wheels are addressed as `spoils:<the fight's id>`. They are built on the spot, from `AdventureState.spoils`. */
export const SPOILS_STEP_PREFIX = 'spoils:';

/** What a Spoils wheel offers: the items made from the foe's loot table, and nothing worth taking. */
export interface SpoilsState {
  /** The fight it follows. */
  stepId: string;
  /** Who fell: 'the Bridge Troll'. */
  foe: string;
  items: (LootRoll & { fromCast?: boolean })[];
  /** Weight of the nothing slice. */
  nothing: number;
  /** The world character beaten, whose own gear may be among the items. */
  castId?: string;
  /** Where the road goes once it has been spun. */
  then: string | null;
}

/** A world character featured on one wheel of this adventure. A snapshot, taken when the wheel came up. */
export interface CastMember {
  stepId: string;
  character: Character;
}

export interface AdventureState {
  /** The hero with every effect so far applied. The world's copy is untouched until `completeAdventure`. */
  character: Character;
  /** The wheel to spin next, or null when the adventure is over. */
  currentStepId: string | null;
  stepsTaken: number;
  /** This adventure's spins so far. */
  rolls: RollRecord[];
  /** Fame earned on this adventure so far (losses included). */
  fameEarned: number;
  /** How the story ended, if an option wrote it (`WheelOption.fate`). */
  fate: string | null;
  /** Who the current wheel features, when it casts someone. */
  cast: CastMember | null;
  /** On a "who is it?" wheel, the candidates it offers. Empty otherwise. */
  castChoices: Character[];
  /** Changes to cast characters, written to the world by `completeAdventure`. */
  castEffects: { characterId: string; effect: CastEffect }[];
  /** How far this adventure moves the world's threat dial (legendary events, a quest's end). */
  worldThreat: number;
  /** On the evade wheels: the fight the hero stands before, and whoever it cast (`AdventureConfig.evade`). */
  evading?: { stepId: string; cast: CastMember | null } | null;
  /** On a Spoils wheel: what it offers, and where the road goes after. */
  spoils?: SpoilsState | null;
  /** On the Keep / Take choice: where the road goes once every offer is decided. */
  gearChoice?: { then: string | null } | null;
  /** A boss battle under way (its Clash wheels), or just decided (its fight's wheel, one side of it). */
  battle?: BattleState | null;
  /** How this adventure's battles cast spells. Default: `AdventureConfig.battleSpells`, else 'auto'. */
  spellMode?: SpellMode;
  /** Clash wheels spun so far: they don't count toward the step limit. */
  clashRounds?: number;
}

export interface AdventureSpinOutcome {
  step: WheelStep;
  roll: RollResult;
  state: AdventureState;
  /** A Wise hero's second roll of the same wheel, resolved from the same state. The player keeps one. */
  alt?: AdventureSpinOutcome;
}

/** Only living heroes adventure. The Demon Lord waits for them to come; outlaws and minions lie in wait. */
export function canAdventure(char: Character): boolean {
  return char.status === 'alive' && char.role === 'hero';
}

/** True for a "who is it?" wheel id. */
export function isWhoStep(stepId: string): boolean {
  return stepId.startsWith(WHO_STEP_PREFIX);
}

/**
 * The "who is it?" wheel for a cast wheel: one equal slice per candidate. Each slice leads
 * to the cast wheel itself, where the chosen character then appears.
 */
export function createWhoStep(config: GameConfig, castStepId: string, choices: readonly Character[]): WheelStep {
  const { title, subtitle, slice } = config.adventure.castWheel;
  const target = config.steps[castStepId];
  return {
    id: `${WHO_STEP_PREFIX}${castStepId}`,
    title,
    subtitle: subtitle ?? target?.title,
    options: choices.map((c) => ({ ...slice(c), id: c.id, label: c.name || 'Someone', baseWeight: 1, nextStepId: castStepId })),
  };
}

/** True for a Spoils wheel id. */
export function isSpoilsStep(stepId: string): boolean {
  return stepId.startsWith(SPOILS_STEP_PREFIX);
}



/**
 * The Spoils wheel: one slice per item, weighted by its loot-table entry and drawn in its
 * rarity, and one for nothing worth taking. Fixed: no archetype reshapes it.
 */
export function createSpoilsStep(config: GameConfig, spoils: SpoilsState | null | undefined, stepId = `${SPOILS_STEP_PREFIX}${spoils?.stepId ?? ''}`): WheelStep {
  const text = config.gear?.spoilsWheel ?? { title: 'Spoils of Victory', nothing: 'Nothing Worth Taking', nothingDescription: 'Nothing better than what they carry.' };
  return {
    id: stepId,
    title: text.title,
    ...(spoils && { subtitle: `What ${spoils.foe} left behind` }),
    fixed: true,
    options: [
      ...(spoils?.items ?? []).map(({ item, weight, fromCast }): WheelOption => ({
        id: item.id,
        label: item.name,
        description: `${describeGear(item)}.${fromCast ? ' Theirs, until a moment ago.' : ''}${item.lore ? ` ${item.lore}` : ''}`,
        baseWeight: weight,
        rarity: item.rarity,
        gear: { [item.kind]: { item } },
        nextStepId: null,
        color: config.gear?.damageColors[(item.damage ?? item.resists)!] ?? '#8a7a5a',
        icon: config.gear?.bases[item.base]?.icon ?? (item.kind === 'weapon' ? 'Sword' : 'Shield'),
      })),
      { id: 'nothing', label: text.nothing, description: text.nothingDescription, baseWeight: spoils?.nothing ?? 1, rarity: 'common', nextStepId: null, color: '#5b5b66', icon: 'Package' },
    ],
  };
}


/**
 * The wheel an adventure is on, as the hero faces it: a "who is it?" wheel, or a config
 * wheel with whoever it cast in place. Options that don't fit this cast character and this
 * hero (`castCondition`) are left out, and a cast foe stands in for the wheel's `foe`.
 */
export function getAdventureStep(
  config: GameConfig,
  stepId: string,
  state: Pick<AdventureState, 'cast' | 'character'> & Partial<Pick<AdventureState, 'castChoices' | 'evading' | 'spoils' | 'battle' | 'spellMode'>>,
): WheelStep {
  if (isWhoStep(stepId)) return createWhoStep(config, stepId.slice(WHO_STEP_PREFIX.length), state.castChoices ?? []);
  if (isSpoilsStep(stepId)) return createSpoilsStep(config, state.spoils, stepId);
  if (isGearStep(stepId)) return createGearStep(config, state.character);
  if (isBattleStep(stepId)) return clashStep(config, stepId, state);
  // As the hero's archetype has it (a Martial hero's spell wheels are training).
  const step = substituteStep(config, getStep(config, stepId), state.character);
  if (state.evading && !step.foe) return withFoeText(config, step, state.evading, state.character);
  const cast = state.cast?.stepId === stepId ? state.cast.character : null;
  const options = step.options.some((o) => o.castCondition)
    ? step.options.filter((o) => !o.castCondition || (cast !== null && o.castCondition(cast, state.character)))
    : step.options;
  let faced = options === step.options ? step : { ...step, options };
  if (step.foeOf) faced = { ...faced, foe: step.foeOf(state.character) };
  // Someone from the world, as the foe: their name and power, with what the wheel's own foe is weak to and strikes with.
  if (cast && step.cast?.asFoe) faced = { ...faced, foe: { ...foeProfile(step.foe), name: cast.name, power: calculatePowerRating(cast), ...(step.battle && { battle: true }) } };
  // A battle decided: its fight's wheel, with only the side that happened on it.
  const verdict = state.battle?.stepId === stepId ? state.battle.verdict : undefined;
  if (verdict) faced = verdictStep(faced, verdict);
  return state.character.story || state.character.expedition ? withStoryText(faced, state.character) : faced;
}

/**
 * A fight's wheel once its battle is decided: only its winning slices, or only its losing
 * ones, still at their own odds against each other. A defeat's wound is already in the
 * battle's health, so a losing slice adds none.
 */
function verdictStep(step: WheelStep, verdict: 'win' | 'lose'): WheelStep {
  const options = step.options
    .filter((o) => o.fight === verdict)
    .map((o) => {
      if (verdict === 'win' || !o.meters?.[WOUNDS_METER]) return o;
      const { [WOUNDS_METER]: _wound, ...meters } = o.meters;
      return { ...o, meters };
    });
  return { ...step, subtitle: verdict === 'win' ? `${step.foe?.name ?? 'The foe'} is down. How did it end?` : 'They are down. How does it end?', options };
}

/** The Clash wheel the battle is on. Without a battle (looking back at history), an empty one. */
function clashStep(config: GameConfig, stepId: string, state: Pick<AdventureState, 'character' | 'battle' | 'spellMode'>): WheelStep {
  const battle = state.battle;
  if (!config.battle || !battle || `${BATTLE_STEP_PREFIX}${battle.stepId}` !== stepId) return { id: stepId, title: 'Battle', fixed: true, options: [] };
  return createClashStep(config.battle, battle, state.character, spellModeOf(config, state), maxHp(state.character));
}

/** How this adventure's battles cast spells. */
export function spellModeOf(config: GameConfig, state: Pick<AdventureState, 'spellMode'>): SpellMode {
  return state.spellMode ?? config.adventure.battleSpells ?? 'auto';
}

/** What a foe is weak to, resists and strikes with: everything but who it is. */
function foeProfile(foe: Foe | undefined): Partial<Foe> {
  if (!foe) return {};
  const { name: _name, power: _power, loot: _loot, battle: _battle, ...profile } = foe;
  return profile;
}

/** A wheel's words with the quest's names filled in: `{rival}`, `{quest}`, `{hero}`. */
function withStoryText(step: WheelStep, char: Character): WheelStep {
  const say = (text: string) => storyText(text, char);
  return {
    ...step,
    title: say(step.title),
    ...(step.subtitle !== undefined && { subtitle: say(step.subtitle) }),
    ...(step.foe && { foe: { ...step.foe, name: say(step.foe.name) } }),
    options: step.options.map((o) => ({ ...o, label: say(o.label), ...(o.description !== undefined && { description: say(o.description) }) })),
  };
}

/** An evade wheel's words with the fight it stands before filled in: `{foe}`, `{power}`. */
function withFoeText(config: GameConfig, step: WheelStep, evading: NonNullable<AdventureState['evading']>, character: Character): WheelStep {
  const foe = getAdventureStep(config, evading.stepId, { cast: evading.cast, character }).foe;
  const say = (text: string) => text.replaceAll('{foe}', foe?.name ?? 'the enemy').replaceAll('{power}', String(foe?.power ?? '?'));
  return {
    ...step,
    title: say(step.title),
    ...(step.subtitle !== undefined && { subtitle: say(step.subtitle) }),
    options: step.options.map((o) => ({ ...o, label: say(o.label), ...(o.description !== undefined && { description: say(o.description) }) })),
  };
}

/**
 * Arriving at a fight, for a hero who can slip past it (`AdventureConfig.evade`): the evade
 * wheel comes first, holding the fight (and whoever it cast) until an `evade` option decides.
 */
function beforeFight(
  config: GameConfig,
  stepId: string | null,
  cast: CastMember | null,
  character: Character,
): { stepId: string | null; cast: CastMember | null; evading: AdventureState['evading'] } {
  // A Trickster's gambit comes before every fight, holding it like an evade wheel; its options all go on to the fight.
  const gambit = character.rules?.beforeFight;
  if (gambit && config.steps[gambit] && stepId !== null && !isWhoStep(stepId) && getAdventureStep(config, stepId, { cast, character }).foe) {
    return { stepId: gambit, cast: null, evading: { stepId, cast } };
  }
  const evade = config.adventure.evade;
  if (!evade || stepId === null || isWhoStep(stepId) || !character.traits.some((t) => evade.traits.includes(t.id))) {
    return { stepId, cast, evading: null };
  }
  if (!getAdventureStep(config, stepId, { cast, character }).foe) return { stepId, cast, evading: null };
  return { stepId: evade.stepId, cast: null, evading: { stepId, cast } };
}

/** Any wheel a RollRecord can point at, for showing history. Undefined for unknown ids. */
export function findStep(config: GameConfig, stepId: string): WheelStep | undefined {
  if (isWhoStep(stepId)) return createWhoStep(config, stepId.slice(WHO_STEP_PREFIX.length), []);
  if (isSpoilsStep(stepId)) return createSpoilsStep(config, null, stepId);
  if (isGearStep(stepId)) return { id: GEAR_STEP_ID, title: 'Keep or Take', choice: true, options: [] };
  if (isBattleStep(stepId)) return { id: stepId, title: 'Battle', fixed: true, options: [] };
  return config.steps[stepId];
}

/** Begin an adventure. `spellMode` picks how its battles cast spells (default: the config's). */
export function startAdventure(config: GameConfig, char: Character, opts: { spellMode?: SpellMode } = {}): AdventureState {
  if (!canAdventure(char)) {
    throw new EngineError('INVALID_STATUS', `${char.name} cannot adventure (${char.role}, ${char.status}).`);
  }
  return {
    // The days between adventures close some wounds before the meters that rise do.
    character: risingMeters(config, regenerate(char, REST_BETWEEN)),
    currentStepId: config.adventure.entryStepId,
    stepsTaken: 0,
    rolls: [],
    fameEarned: 0,
    fate: null,
    cast: null,
    castChoices: [],
    castEffects: [],
    worldThreat: 0,
    evading: null,
    ...(opts.spellMode && { spellMode: opts.spellMode }),
  };
}

/** Every stat at least 1: what a spared Hero is left with. */
function atLeastOne(stats: Character['stats']): Character['stats'] {
  return { might: Math.max(1, stats.might), agility: Math.max(1, stats.agility), intellect: Math.max(1, stats.intellect), arcana: Math.max(1, stats.arcana), vitality: Math.max(1, stats.vitality) };
}

/** The hero once a Trickster's boost has been spent on its fight. */
function withoutBoost({ fightBoost: _spent, ...char }: Character): Character {
  return char;
}

/** Meters that rise on their own with every adventure (a vampire's hunger, the moon). */
function risingMeters(config: GameConfig, char: Character): Character {
  const rising = (config.meters ?? []).filter((m) => m.perAdventure && appliesTo(m, char));
  if (rising.length === 0) return char;
  return { ...char, meters: addMeters(char.meters, Object.fromEntries(rising.map((m) => [m.id, m.perAdventure!])), config) };
}

const appliesTo = (meter: MeterDef, char: Character) => !meter.appliesTo || meter.appliesTo(char);

/** The first meter that is full, for those it applies to. */
export function fullMeter(config: GameConfig, char: Character): MeterDef | undefined {
  return (config.meters ?? []).find((m) => appliesTo(m, char) && (char.meters?.[m.id] ?? 0) >= m.max);
}

/** The meter a wheel is the trigger of, if it is one. */
export function meterTriggeredBy(config: GameConfig, stepId: string): MeterDef | undefined {
  return config.meters?.find((m) => m.trigger === stepId);
}

/** The meters a character has: the ones that apply to them, at their current value. */
export function metersOf(config: GameConfig, char: Character): { meter: MeterDef; value: number }[] {
  return (config.meters ?? []).filter((m) => appliesTo(m, char)).map((meter) => ({ meter, value: char.meters?.[meter.id] ?? 0 }));
}

export function isAdventureOver(state: AdventureState): boolean {
  return state.currentStepId === null;
}

/**
 * Spin the adventure's current wheel once. Pure: the input state is left untouched. On a choice
 * wheel this picks for the hero, by the options' weights: an autoplay, for tests and simulations.
 */
export function spinAdventure(
  given: AdventureState,
  config: GameConfig,
  world: World,
  rng: Rng = defaultRng,
  opts: { autoCast?: boolean } = {},
): AdventureSpinOutcome {
  // In a choose-mode battle, a hero left to themselves casts what they would before the spin.
  const state = opts.autoCast ? withAutoCast(given, config, rng) : given;
  const step = currentStep(state, config);
  // Left to themselves, they keep whichever is better.
  if (isGearStep(step.id)) {
    const offer = pendingOffer(state.character);
    return chooseAdventure(state, config, world, offer && offerIsBetter(state.character, offer, config) ? 'take' : 'keep', rng);
  }
  const options = dealOptions(step, state.character, config, { world, salt: spinSalt(state.character, state.stepsTaken) });
  const roll = rollWeightedOption(options, world, state.character, rng);
  const outcome = resolveRoll(state, config, world, rng, step, roll);
  // A Wise hero spins it twice and keeps one (`pickOutcome`).
  if (!state.character.rules?.rollTwice || step.fixed || step.choice) return outcome;
  const second = rollWeightedOption(options, world, state.character, rng);
  return { ...outcome, alt: resolveRoll(state, config, world, rng, step, second, 'wise') };
}

/**
 * A roll decided rather than spun: a Brute's Smash or an Ancient's decree (see `decideCurrentStep`). Pure.
 *
 * @throws EngineError('INVALID_CHOICE') for a decree with none left, or on a slice that can't be rolled.
 */
export function decideAdventure(
  state: AdventureState,
  config: GameConfig,
  world: World,
  index: number,
  how: Decision,
  rng: Rng = defaultRng,
): AdventureSpinOutcome {
  const step = currentStep(state, config);
  const slices = resolveSlices(dealOptions(step, state.character, config, { world, salt: spinSalt(state.character, state.stepsTaken) }), world, state.character);
  const { character, winner } = decided(state.character, slices, index, how);
  return resolveRoll({ ...state, character }, config, world, rng, step, { slices, winner, draw: DECIDED_DRAW[how] }, how);
}

/**
 * The player's decision on a choice wheel: the option they picked, applied exactly as a spin
 * that landed on it would be. Pure.
 *
 * @throws EngineError('INVALID_CHOICE') if the wheel is spun rather than chosen, or the option
 *         isn't on it or is locked.
 */
export function chooseAdventure(
  state: AdventureState,
  config: GameConfig,
  world: World,
  optionId: string,
  rng: Rng = defaultRng,
): AdventureSpinOutcome {
  const step = currentStep(state, config);
  if (!step.choice) throw new EngineError('INVALID_CHOICE', `"${step.title}" is spun, not chosen.`);
  const slices = resolveSlices(dealOptions(step, state.character, config, { world, salt: spinSalt(state.character, state.stepsTaken) }), world, state.character);
  const winner = slices.find((s) => s.option.id === optionId);
  if (!winner || winner.locked || winner.effectiveWeight <= 0) {
    throw new EngineError('INVALID_CHOICE', `"${optionId}" can't be chosen on "${step.title}".`);
  }
  // A draw of -1 marks a decision rather than a spin.
  return resolveRoll(state, config, world, rng, step, { slices, winner, draw: -1 });
}

/** The wheel the adventure is on, after the checks every spin or choice needs. */
function currentStep(state: AdventureState, config: GameConfig): WheelStep {
  if (state.currentStepId === null) {
    throw new EngineError('GENERATION_COMPLETE', 'This adventure is already over.');
  }
  if (state.stepsTaken - (state.clashRounds ?? 0) >= MAX_GENERATION_STEPS) {
    throw new EngineError(
      'STEP_LIMIT',
      `An adventure exceeded ${MAX_GENERATION_STEPS} spins. Check the adventure wheels for an unintended loop.`,
    );
  }
  return getAdventureStep(config, state.currentStepId, state);
}

/**
 * Apply a decided roll, spun or chosen: the adventure moves on. Arriving at a battle fight, the
 * battle begins (its Clash wheels come first); leaving one decided, it is cleared.
 */
function resolveRoll(
  state: AdventureState,
  config: GameConfig,
  world: World,
  rng: Rng,
  step: WheelStep,
  roll: RollResult,
  how?: RollRecord['how'],
): AdventureSpinOutcome {
  // Every roll off the battlefield closes a little of their wounds.
  const healed = isBattleStep(step.id) ? state : { ...state, character: regenerate(state.character, regenPerRoll(state.character)) };
  const outcome = settleRoll(healed, config, world, rng, step, roll, how);
  // The fight's own wheel just landed: the record says how long the battle went.
  const decided = state.battle?.verdict && state.battle.stepId === step.id ? state.battle : null;
  if (decided && outcome.state.rolls.length > state.rolls.length) {
    const rolls = [...outcome.state.rolls];
    const last = rolls.at(-1)!;
    const fought = `A ${decided.round - 1}-round battle${decided.stats.bestHit > 0 ? `, best hit ${Math.round(decided.stats.bestHit * decided.scale.foe)}` : ''}`;
    rolls[rolls.length - 1] = { ...last, note: last.note ? `${fought}. ${last.note}` : fought };
    return { ...outcome, state: routeBattle(config, { ...outcome.state, rolls }) };
  }
  return { ...outcome, state: routeBattle(config, outcome.state) };
}

/** Arriving at a battle fight: its battle begins. A decided battle, left behind, is cleared. */
function routeBattle(config: GameConfig, state: AdventureState): AdventureState {
  let next = state;
  const id = next.currentStepId;
  if (next.battle?.verdict && id !== next.battle.stepId) next = { ...next, battle: null };
  if (!config.battle || id === null || isBattleStep(id) || isWhoStep(id) || isSpoilsStep(id) || isGearStep(id)) return next;
  if (next.battle?.stepId === id || !canAdventure(next.character) || !config.steps[id]) return next;
  const step = getAdventureStep(config, id, next);
  if (!isBattleFight(step)) return next;
  return {
    ...next,
    currentStepId: `${BATTLE_STEP_PREFIX}${id}`,
    battle: startBattle(config.battle, id, step.foe!, next.character, spellModeOf(config, next), isBossFight(step)),
  };
}

/** The longest a battle goes: past this, whoever has more of their health left carries it. */
const MAX_BATTLE_ROUNDS = 40;

/** A Clash wheel lands: the blow is struck, and either the battle goes on or its fight's wheel comes up. */
function resolveClash(state: AdventureState, config: GameConfig, step: WheelStep, roll: RollResult, rng: Rng): AdventureSpinOutcome {
  const battle = state.battle!;
  const { option } = roll.winner;
  let after = applyClash(config.battle!, battle, state.character, { ...option.clash!, label: option.label }, rng);
  const pools = poolsOf(after);
  if (!after.verdict && after.round > MAX_BATTLE_ROUNDS) after = { ...after, verdict: after.heroHp / pools.hero >= after.foeHp / pools.foe ? 'win' : 'lose' };
  return {
    step,
    roll,
    state: concludeBattle({ ...state, battle: after, stepsTaken: state.stepsTaken + 1, clashRounds: (state.clashRounds ?? 0) + 1 }),
  };
}

/**
 * A battle that is over: the hero's health is what it left them (a lost boss battle leaves them
 * a sliver, crawling away; a lost ordinary fight, the third it could take gone, at least that
 * sliver), and the fight's own wheel comes up to say how it ended.
 */
function concludeBattle(state: AdventureState): AdventureState {
  const battle = state.battle;
  if (!battle?.verdict) return state;
  const sliver = 1 / (2 * WOUNDS_MAX);
  const left = battle.verdict === 'lose' ? Math.max(sliver, battle.boss === false ? heroUnits(battle) / BATTLE_POOL : 0) : heroUnits(battle) / BATTLE_POOL;
  return { ...state, character: withHpFraction(state.character, left), currentStepId: battle.stepId };
}

/**
 * A battle in choose mode: the player casts a spell before the spin. No wheel turns; if it
 * finishes the foe, the fight's wheel comes up. Pure.
 *
 * @throws EngineError('INVALID_CHOICE') off a Clash wheel, or for a spell spent or unknown.
 */
export function castInBattle(state: AdventureState, config: GameConfig, spellId: string, rng: Rng = defaultRng): AdventureState {
  const battle = state.battle;
  if (!config.battle || !battle || battle.verdict || state.currentStepId !== `${BATTLE_STEP_PREFIX}${battle.stepId}`) {
    throw new EngineError('INVALID_CHOICE', 'There is no battle to cast in.');
  }
  try {
    return concludeBattle({ ...state, battle: castSpell(config.battle, battle, state.character, spellId, rng) });
  } catch (err) {
    throw new EngineError('INVALID_CHOICE', err instanceof Error ? err.message : String(err));
  }
}

/** Choose mode, left to themselves: whatever they would cast before this spin, cast. */
function withAutoCast(state: AdventureState, config: GameConfig, rng: Rng): AdventureState {
  const battle = state.battle;
  if (!config.battle || !battle || battle.verdict || spellModeOf(config, state) !== 'choose' || !state.currentStepId || !isBattleStep(state.currentStepId)) return state;
  const spell = autoCast(config.battle, battle, state.character);
  return spell ? castInBattle(state, config, spell, rng) : state;
}

/**
 * A lost one-spin fight's wound, as hard as the foe hit: more from a foe far stronger than the
 * hero, less from a weaker one, and less again when their armour turns its blows.
 */
function foughtWound(option: WheelOption, step: WheelStep, char: Character): WheelOption {
  const wound = option.meters?.[WOUNDS_METER];
  if (!step.foe || option.fight !== 'lose' || !wound || wound <= 0) return option;
  const odds = Math.min(1.4, Math.max(0.6, step.foe.power / Math.max(1, calculatePowerRating(char))));
  const scaled = Math.round(wound * odds * defenseMult(char, foeStrikes(step.foe)) * 100) / 100;
  return { ...option, meters: { ...option.meters, [WOUNDS_METER]: scaled } };
}

function settleRoll(
  state: AdventureState,
  config: GameConfig,
  world: World,
  rng: Rng,
  step: WheelStep,
  roll: RollResult,
  how?: RollRecord['how'],
): AdventureSpinOutcome {
  const { option, probability } = roll.winner;

  // A Gambler's coin lands: the stake doubles or is lost, and the road goes where it was going.
  const stake = state.character.stake;
  if (option.gamble && stake) {
    const { stake: _spent, ...settled } = settleStake(applyEffects(state.character, option, step.id, config), stake.gains, option.gamble, config);
    return {
      step,
      roll,
      state: {
        ...state,
        character: settled,
        currentStepId: stake.then,
        stepsTaken: state.stepsTaken + 1,
        rolls: [...state.rolls, { stepId: step.id, optionId: option.id, probability, ...(how && { how }) }],
      },
    };
  }

  if (isBattleStep(step.id)) return resolveClash(state, config, step, roll, rng);
  if (isSpoilsStep(step.id)) return resolveSpoils(state, config, step, roll, how);
  if (isGearStep(step.id)) return resolveGearChoice(state, config, step, roll);

  // "Who is it?": the winner is who the next wheel features. Nothing else happens yet.
  if (isWhoStep(step.id)) {
    const chosen = state.castChoices.find((c) => c.id === option.id) ?? null;
    const target = step.id.slice(WHO_STEP_PREFIX.length);
    const faced = beforeFight(config, target, chosen && { stepId: target, character: chosen }, state.character);
    return {
      step,
      roll,
      state: {
        ...state,
        currentStepId: faced.stepId,
        stepsTaken: state.stepsTaken + 1,
        cast: faced.cast,
        castChoices: [],
        evading: faced.evading,
      },
    };
  }

  const cast = state.cast?.stepId === step.id ? state.cast.character : null;
  const spoils = cast && option.spoils ? option.spoils(cast, state.character) : null;
  const fame = fameEarned(config, option, step, state.character);
  const rolls: RollRecord[] = [
    ...state.rolls,
    {
      stepId: step.id,
      optionId: option.id,
      probability,
      ...(cast && { cast: cast.name }),
      ...(fame !== 0 && { fame }),
      ...(spoils?.summary && { note: spoils.summary }),
      ...(roll.draw < 0 && !how && { chosen: true }),
      ...(how && { how }),
    },
  ];
  const applied = applyEffects(state.character, foughtWound(option, step, state.character), step.id, config);
  const titled = option.epithet ? { ...applied, title: earnedTitle(config, applied, rolls) } : applied;
  const looted = spoils ? applySpoils(titled, spoils, config) : titled;
  const famed = { ...looted, fame: Math.max(0, (looted.fame ?? 0) + fame) };
  // The quest remembers: this wheel is met, and the option's story effect is written down.
  const seen = markSeen(famed, step.id);
  const storied = option.story ? applyStory(seen, option.story, config, world, cast?.name) : seen;
  // A stat worn down to nothing is fatal: no strength, no breath, no mind left to go on with.
  // (Not one the archetype holds there: a Martial hero lives without Arcana.)
  const spent = storied.status === 'alive' ? STAT_KEYS.find((key) => storied.stats[key] <= 0 && storied.rules?.fixedStats?.[key] === undefined) : undefined;
  const dead: Character = spent
    ? { ...storied, status: 'fallen', ...(storied.story && { story: { ...storied.story, log: [...storied.story.log, `Their ${spent} gave out entirely.`] } }) }
    : storied;
  // A Hero: now and then, death misses. They live on, with nothing worn down to nothing.
  const spared = dead.status === 'fallen' && state.character.status !== 'fallen' && rng() < (state.character.rules?.deathSave ?? 0);
  const ended: Character = spared ? { ...dead, status: 'alive', stats: atLeastOne(dead.stats) } : dead;
  // A Trickster's gambit lasts one fight.
  const fought = step.foe && ended.fightBoost !== undefined ? withoutBoost(ended) : ended;
  let character = option.place ? explore(fought, option.place, world, config, rng) : fought;
  const fate = spared ? state.fate : spent ? `Their ${spent} gave out entirely` : option.fate ? storyText(option.fate, character, cast?.name) : state.fate;
  if (spared) rolls[rolls.length - 1] = { ...rolls.at(-1)!, note: 'Death came for them, and missed.' };

  // On the evade wheels: on to the fight they stood before, or past it, to wherever it led.
  const evading = state.evading ?? null;
  const toFight = evading !== null && option.evade === 'fight' && canAdventure(character);
  const route = evading && option.evade === 'escape' ? (getStep(config, evading.stepId).afterFight ?? null) : option.nextStepId;
  let next = toFight ? evading.stepId : canAdventure(character) ? resolveNextStep(route, world, character) : null;
  // A full meter has the last word, as the road would end (but never straight after its own wheel).
  const filled = next === null && canAdventure(character) && !meterTriggeredBy(config, step.id) ? fullMeter(config, character) : undefined;
  if (filled) {
    next = filled.trigger;
    character = { ...character, meters: { ...character.meters, [filled.id]: 0 } };
  }
  // Too short to be an adventure: the way home has something on it first.
  const home = config.adventure.roadHome;
  if (home && next === null && !filled && canAdventure(character) && !rolls.some((r) => r.stepId === home.stepId)) {
    const spun = rolls.filter((r) => !isWhoStep(r.stepId)).length;
    if (spun < home.minSpins) next = home.stepId;
  }
  // Home again with nothing to show for it: the floor tops the road's fame up, on its last roll.
  const total = state.fameEarned + fame;
  const topUp = next === null && canAdventure(character) && total >= 0 ? Math.max(0, (config.fame.floor ?? 0) - total) : 0;
  if (topUp > 0) {
    character = { ...character, fame: (character.fame ?? 0) + topUp };
    rolls[rolls.length - 1] = { ...rolls.at(-1)!, fame: fame + topUp };
  }
  const arrival = toFight ? { stepId: evading.stepId, cast: evading.cast, choices: [] } : arrive(config, next, world, character, rng);
  if ('expedition' in arrival && arrival.expedition) character = { ...character, expedition: arrival.expedition };
  // Still deciding on the evade wheels, back to the fight, or arriving somewhere new (another fight?).
  const faced =
    evading && !option.evade
      ? { stepId: arrival.stepId, cast: arrival.cast, evading }
      : toFight
        ? { stepId: arrival.stepId, cast: arrival.cast, evading: null }
        : beforeFight(config, arrival.stepId, arrival.cast, character);
  const effects = cast ? [option.castEffect, spoils?.effect].filter((e): e is CastEffect => e !== undefined) : [];
  rolls[rolls.length - 1] = { ...rolls.at(-1)!, ...rollExtras(config, step, option, character, cast?.name) };
  // A Gambler bets what this roll gained (loot taken included) before the road goes on.
  const gamble = state.character.rules?.gamble;
  const gains = gamble && config.steps[gamble] && !step.fixed && canAdventure(character) ? stakeOf(state.character, character, option) : null;
  // A fight won: a Spoils wheel, before the road goes on (and after the Gambler's coin).
  const loot = spoilsFor(config, world, rng, step, option, character, cast, spoils !== null, faced.stepId);
  let onward: string | null = loot ? `${SPOILS_STEP_PREFIX}${step.id}` : faced.stepId;
  if (gains) {
    character = { ...character, stake: { gains, then: onward } };
    onward = gamble!;
  }
  // An item for a filled slot: Keep or Take, before anything else.
  const choosing = pendingOffer(character) !== undefined && character.status === 'alive';
  const gearChoice = choosing ? { then: onward } : null;
  if (choosing) onward = GEAR_STEP_ID;

  return {
    step,
    roll,
    state: {
      ...state,
      character,
      currentStepId: onward,
      stepsTaken: state.stepsTaken + 1,
      spoils: loot,
      gearChoice,
      rolls,
      fameEarned: state.fameEarned + fame + topUp,
      fate,
      worldThreat: state.worldThreat + (option.story?.worldThreat ?? 0),
      cast: faced.cast,
      castChoices: arrival.choices,
      evading: faced.evading,
      castEffects: [...state.castEffects, ...effects.map((effect) => ({ characterId: cast!.id, effect }))],
    },
  };
}

/**
 * Arriving at the next wheel. A cast wheel with two or more candidates is preceded by a
 * "who is it?" wheel (up to MAX_CAST_CHOICES of them, picked at random); with one, they
 * appear at once; with none, the wheel plays without anyone.
 */
/** The share of a Spoils wheel a cast foe's own weapon (or armour) takes, beside a loot table's entries. */
const CAST_GEAR_WEIGHT = 30;

/**
 * The Spoils wheel a won fight leads to, or null: none for a win that takes nothing
 * (`noSpoils`), a hero no longer on the road, or a config without gear. Items are made now, so
 * every spin of the wheel (a Wise hero's two) offers the same ones. A glorious win, and gear
 * with `lootLuck`, lean the drop rarer and thin out "nothing". A foe from the world drops what
 * they carried too, unless the win already took it (`spoils`), or it will not be taken.
 */
function spoilsFor(
  config: GameConfig,
  world: World,
  rng: Rng,
  step: WheelStep,
  option: WheelOption,
  hero: Character,
  cast: Character | null,
  alreadyTaken: boolean,
  then: string | null,
): SpoilsState | null {
  const gear = config.gear;
  const foe = step.foe;
  if (!gear || !foe || option.fight !== 'win' || option.noSpoils || !canAdventure(hero) || isSpoilsStep(step.id)) return null;
  const glorious = option.id === 'glory' || option.id === 'legend';
  const shift = lootShift(hero, glorious);
  const table = foe.loot ?? gear.lootFor(foe.power);
  const items: SpoilsState['items'] = rollLoot(gear, table, rng, hero, { shift, claimed: uniquesInWorld(world), foundFrom: `Taken from ${foe.name}` });
  if (cast && !alreadyTaken) {
    for (const carried of [cast.weapon, cast.armor]) {
      if (!carried || (carried.kind === 'weapon' && hero.rules?.noWeapon)) continue;
      if (carried.uniqueId && gear.uniques[carried.uniqueId]?.untakeable) continue;
      items.unshift({ item: { ...carried, foundFrom: `Taken from ${cast.name}` }, weight: CAST_GEAR_WEIGHT, fromCast: true });
    }
  }
  if (items.length === 0) return null;
  return {
    stepId: step.id,
    foe: foe.name,
    items,
    nothing: table.nothing * (shift > 0 ? 0.5 : 1),
    ...(cast && { castId: cast.id }),
    then,
  };
}

/** A Spoils wheel lands: the item is the hero's (or offered, for a slot already filled), and the road goes on. */
function resolveSpoils(state: AdventureState, config: GameConfig, step: WheelStep, roll: RollResult, how?: RollRecord['how']): AdventureSpinOutcome {
  const spoils = state.spoils;
  const { option, probability } = roll.winner;
  const found = spoils?.items.find((i) => i.item.id === option.id);
  let character = found ? applyEffects(state.character, option, step.id, config) : state.character;
  if (found && !canAdventure(character)) character = state.character;
  const rolls: RollRecord[] = [
    ...state.rolls,
    {
      stepId: step.id,
      optionId: option.id,
      probability,
      ...(found && { note: `Found ${found.item.name}` }),
      ...(roll.draw < 0 && !how && { chosen: true }),
      ...(how && { how }),
    },
  ];
  // Their own gear, taken from them, is gone from them, whatever the hero does with it.
  const taken = found?.fromCast && spoils?.castId ? [{ characterId: spoils.castId, effect: { [found.item.kind]: null } as CastEffect }] : [];
  const then = spoils?.then ?? null;
  const choosing = pendingOffer(character) !== undefined;
  return {
    step,
    roll,
    state: {
      ...state,
      character,
      currentStepId: choosing ? GEAR_STEP_ID : then,
      stepsTaken: state.stepsTaken + 1,
      rolls,
      spoils: null,
      gearChoice: choosing ? { then } : null,
      castEffects: [...state.castEffects, ...taken],
    },
  };
}

/** Keep or Take is decided: the item is equipped or left behind; the next offer, or the road, comes next. */
function resolveGearChoice(state: AdventureState, config: GameConfig, step: WheelStep, roll: RollResult): AdventureSpinOutcome {
  const { option, probability } = roll.winner;
  const { character, note } = chooseGear(state.character, option.id === 'take', config);
  const then = state.gearChoice?.then ?? null;
  const more = pendingOffer(character) !== undefined;
  return {
    step,
    roll,
    state: {
      ...state,
      character,
      currentStepId: more ? GEAR_STEP_ID : then,
      stepsTaken: state.stepsTaken + 1,
      rolls: [...state.rolls, { stepId: step.id, optionId: option.id, probability, ...(note && { note }), chosen: true }],
      gearChoice: more ? state.gearChoice! : null,
    },
  };
}

function arrive(
  config: GameConfig,
  stepId: string | null,
  world: World,
  hero: Character,
  rng: Rng,
): { stepId: string | null; cast: CastMember | null; choices: Character[]; expedition?: Expedition } {
  if (stepId !== null && config.steps[stepId]?.visitsPlace && !hero.expedition) {
    const place = pickPlace(world, hero, rng);
    if (place) {
      const expedition: Expedition = { placeId: place.id, name: place.name, kind: place.kind, depth: place.depth, isNew: false, foundBy: place.foundBy };
      return { stepId, cast: null, choices: [], expedition };
    }
  }
  const spec = stepId === null ? undefined : config.steps[stepId]?.cast;
  if (stepId === null || !spec) return { stepId, cast: null, choices: [] };
  const pool = spec.from(world, hero).filter((c) => c.id !== hero.id);
  if (pool.length === 0) return { stepId, cast: null, choices: [] };
  if (pool.length === 1) return { stepId, cast: { stepId, character: pool[0]! }, choices: [] };
  return { stepId: `${WHO_STEP_PREFIX}${stepId}`, cast: null, choices: sample(pool, MAX_CAST_CHOICES, rng) };
}

/** Up to `n` items, picked at random without repeats, in their original order. */
function sample<T>(items: readonly T[], n: number, rng: Rng): T[] {
  if (items.length <= n) return [...items];
  const picked = new Set<number>();
  while (picked.size < n) picked.add(Math.min(items.length - 1, Math.floor(rng() * items.length)));
  return items.filter((_, i) => picked.has(i));
}

// ─── Places ─────────────────────────────────────────────────────────────────

/** The most places a world keeps on its map; past it, the oldest closed ones (then the oldest) are forgotten. */
export const MAX_PLACES = 16;

/** The places a hero could go back to: open ones, their own first. */
export function openPlaces(world: World, hero?: Character): Place[] {
  const open = (world.places ?? []).filter((p) => !p.closed);
  const own = hero ? open.filter((p) => p.foundById === hero.id) : [];
  return own.length > 0 ? own : open;
}

function pickPlace(world: World, hero: Character, rng: Rng): Place | undefined {
  const pool = openPlaces(world, hero);
  return pool.length === 0 ? undefined : pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

/** A name for a new place of `kind` that no place on the map already has. */
function placeName(config: GameConfig, kind: string, world: World, rng: Rng): string {
  const names = config.placeKinds?.[kind]?.names ?? [];
  const taken = new Set((world.places ?? []).map((p) => p.name));
  const free = names.filter((n) => !taken.has(n));
  const pool = free.length > 0 ? free : names;
  const base = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))] ?? 'A Nameless Place';
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/** An option's effect on the place being explored: find a new one, go deeper, or close it. */
function explore(char: Character, effect: NonNullable<WheelOption['place']>, world: World, config: GameConfig, rng: Rng): Character {
  let expedition = char.expedition;
  if (effect.discover) {
    expedition = {
      placeId: createId('plc', rng),
      name: placeName(config, effect.discover, world, rng),
      kind: effect.discover,
      depth: 1,
      isNew: true,
      foundBy: char.name || 'someone',
    };
  }
  if (expedition && effect.deepen) expedition = { ...expedition, depth: Math.max(1, expedition.depth + effect.deepen) };
  if (expedition && effect.close) expedition = { ...expedition, closed: storyText(effect.close, { ...char, expedition }) };
  return expedition ? { ...char, expedition } : char;
}

/** What a roll records beyond what it landed on: a callback, a meter's event, the place it happened in. */
function rollExtras(config: GameConfig, step: WheelStep, option: WheelOption, char: Character, cast?: string): Partial<RollRecord> {
  const triggered = meterTriggeredBy(config, step.id);
  const here = char.expedition && (step.visitsPlace || option.place) ? char.expedition : undefined;
  const returned = step.visitsPlace && here && !here.isNew ? `Went back to ${here.name}, found by ${here.foundBy}` : undefined;
  const callback = option.callback ? storyText(option.callback, char, cast) : returned;
  return {
    ...(callback && { callback }),
    ...(triggered && { event: triggered.fills }),
    ...(here && { place: here.name }),
  };
}

/** The world's map with an explored place written in: a new one added, a known one deeper. */
function chartPlace(world: World, expedition: Expedition, hero: Character): World {
  const places = [...(world.places ?? [])];
  const at = places.findIndex((p) => p.id === expedition.placeId);
  if (at < 0) {
    places.push({
      id: expedition.placeId,
      name: expedition.name,
      kind: expedition.kind,
      depth: expedition.depth,
      foundBy: expedition.foundBy,
      foundById: hero.id,
      foundSeason: world.season,
      visits: 1,
      ...(expedition.closed && { closed: expedition.closed }),
    });
  } else {
    const known = places[at]!;
    places[at] = { ...known, depth: Math.max(known.depth, expedition.depth), visits: known.visits + 1, ...(expedition.closed && { closed: expedition.closed }) };
  }
  while (places.length > MAX_PLACES) {
    const drop = places.findIndex((p) => p.closed);
    places.splice(drop >= 0 ? drop : 0, 1);
  }
  return { ...world, places };
}

/** Run a whole adventure headlessly. For tests and balance simulations. */
export function rollFullAdventure(
  config: GameConfig,
  world: World,
  char: Character,
  rng: Rng = defaultRng,
  opts: { spellMode?: SpellMode } = {},
): { state: AdventureState; spins: AdventureSpinOutcome[] } {
  let state = startAdventure(config, char, opts);
  const spins: AdventureSpinOutcome[] = [];
  while (!isAdventureOver(state)) {
    const outcome = autoPick(spinAdventure(state, config, world, rng, { autoCast: true }));
    spins.push(outcome);
    state = outcome.state;
  }
  return { state, spins };
}

/**
 * Write a finished adventure into the world. Pure: returns a new World.
 *
 *   returned → the hero's roster entry is replaced, loot, scars, fame and newly claimed roles included
 *   turned   → stays in the roster: an outlaw or minion (roles freed), or a new life such as a
 *              ruler or a mentor (roles kept: a throne claimed on the way is theirs)
 *   fallen   → moved to the graveyard
 *   retired, victorious, sealed → moved to the hall of fame
 *
 * Then every cast effect is applied to the cast character's current self (skipped if
 * they have since left the world): a legend comes out of retirement, an outlaw falls,
 * a grave is robbed, a sealed soul walks free. Leaving the roster frees a character's
 * one-of-a-kind roles.
 *
 * @throws EngineError('INVALID_STATUS') if the adventure isn't over.
 * @throws EngineError('UNKNOWN_CHARACTER') if the hero is no longer in the roster.
 */
export function completeAdventure(world: World, state: AdventureState, now = Date.now()): World {
  if (state.currentStepId !== null) {
    throw new EngineError('INVALID_STATUS', 'This adventure is not over yet.');
  }
  // An offer still waiting (a hero who fell, or turned, with it in front of them) is left behind.
  const { story, expedition, gearOffers: _offers, ...character } = state.character;
  if (!world.roster.some((c) => c.id === character.id)) {
    throw new EngineError('UNKNOWN_CHARACTER', `${character.name} is no longer in this world.`);
  }

  const outcome = outcomeOf(character);
  const record: AdventureRecord = {
    rolls: state.rolls,
    outcome,
    ...(outcome === 'turned' && { turnedTo: character.role }),
    ...(state.fate && { note: state.fate }),
    ...(story && { quest: questRecord(story, state.worldThreat) }),
    ...(expedition && { place: { name: expedition.name, depth: expedition.depth, discovered: expedition.isNew } }),
  };
  const adventures = [...character.adventures, record];
  const leftPlay = outcome !== 'returned' && outcome !== 'turned';
  const hero: Character = {
    ...character,
    adventures,
    ...(leftPlay && { fate: { at: now, summary: state.fate ?? fateSummary(outcome, adventures.length) } }),
  };

  // Roles claimed on the road (a crown, say) are written now, for a hero who stays in play.
  let next = claimNewRoles(placeCharacter(world, hero), hero);
  if (expedition) next = chartPlace(next, expedition, hero);
  if (state.worldThreat !== 0) next = { ...next, threatLevel: Math.min(10, Math.max(0, next.threatLevel + state.worldThreat)) };
  for (const { characterId, effect } of state.castEffects) {
    const target = findCharacter(next, characterId);
    if (target) next = placeCharacter(next, applyCastEffect(target, effect, hero.name, now));
  }
  return next;
}

/** A quest as the hero's history keeps it. A rival never concluded is still out there. */
function questRecord(story: NonNullable<Character['story']>, worldThreat: number): QuestRecord {
  const { rival } = story;
  return {
    title: story.title,
    objective: story.objective,
    log: story.log,
    ...(rival && { rival: { name: rival.name, title: rival.title, fate: rival.fate ?? 'Still out there, nursing the grudge' } }),
    worldThreat,
  };
}

/** Write the one-of-a-kind roles a hero claimed on an adventure, if they kept their place in the roster. */
function claimNewRoles(world: World, hero: Character): World {
  const placed = world.roster.find((c) => c.id === hero.id);
  if (!placed || placed.role === 'outlaw' || placed.role === 'minion') return world;
  const fresh = hero.singletonClaims.filter((key) => !(key in world.activeSingletons));
  if (fresh.length === 0) return world;
  return { ...world, activeSingletons: { ...world.activeSingletons, ...Object.fromEntries(fresh.map((key) => [key, hero.id])) } };
}

/**
 * A cast effect on its target: their gear, traits, tags and fame first, then their status.
 * Coming back into play wipes their fate; falling writes one.
 */
function applyCastEffect(target: Character, effect: CastEffect, by: string, now: number): Character {
  const lost = new Set(effect.loseTraits ?? []);
  const traits = target.traits.filter((t) => !lost.has(t.id));
  for (const trait of effect.gainTraits ?? []) if (!traits.some((t) => t.id === trait.id)) traits.push({ ...trait });
  const changed: Character = {
    ...target,
    role: effect.setRole ?? target.role,
    weapon: effect.weapon !== undefined ? effect.weapon : target.weapon,
    armor: effect.armor !== undefined ? effect.armor : target.armor,
    // Gear taken from them takes its abilities with it.
    traits: traits.filter((t) => !((t.item === 'weapon' && effect.weapon === null) || (t.item === 'armor' && effect.armor === null))),
    tags: [...new Set([...target.tags, ...(effect.addTags ?? [])])],
    fame: Math.max(0, (target.fame ?? 0) + (effect.fame ?? 0)),
  };
  if (effect.setStatus === 'alive') {
    const { fate: _fate, ...back } = changed;
    return { ...back, status: 'alive' };
  }
  if (effect.setStatus === 'fallen') {
    return { ...changed, status: 'fallen', fate: { at: now, summary: `${effect.fallenBy ?? 'Brought down by'} ${by}` } };
  }
  return changed;
}

function outcomeOf(char: Character): AdventureRecord['outcome'] {
  const { status } = char;
  if (status === 'fallen' || status === 'retired' || status === 'victorious' || status === 'sealed') return status;
  return char.role === 'hero' ? 'returned' : 'turned';
}

function fateSummary(outcome: ExitStatus, adventures: number): string {
  const plural = adventures === 1 ? 'adventure' : 'adventures';
  if (outcome === 'fallen') return `Fell on adventure ${adventures}`;
  if (outcome === 'victorious') return `Victorious after ${adventures} ${plural}`;
  if (outcome === 'sealed') return `Sealed away after ${adventures} ${plural}`;
  return `Retired after ${adventures} ${plural}`;
}
