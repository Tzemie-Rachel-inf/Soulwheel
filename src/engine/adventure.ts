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
 * Meters (`GameConfig.meters`): pressure that builds across a life. Options move them; some rise
 * on their own each adventure (a vampire's hunger). When the road would end with a meter full,
 * its trigger wheel comes up instead (the wounds fester, the hunger takes over), and it empties.
 *
 * Places: an option can find a place (`place.discover`), which this adventure then explores
 * (`Character.expedition`, like a quest's story) and `completeAdventure` puts on the world's
 * map. A wheel that `visitsPlace` takes a hero back to one, the deeper the richer and deadlier.
 */
import { addMeters, applyEffects, applySpoils, earnedTitle } from './character';
import { EngineError } from './errors';
import { fameEarned } from './fame';
import { MAX_GENERATION_STEPS, getStep, resolveNextStep } from './generation';
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
  type GameConfig,
  type MeterDef,
  type Place,
  type QuestRecord,
  type RollRecord,
  type RollResult,
  type WheelOption,
  type WheelStep,
  type World,
} from './types';
import { findCharacter, placeCharacter } from './world';

/** "Who is it?" wheels are addressed as `who:<the cast wheel's id>`. They are built on the spot. */
export const WHO_STEP_PREFIX = 'who:';
/** The most candidates a "who is it?" wheel shows. */
export const MAX_CAST_CHOICES = 8;

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
}

export interface AdventureSpinOutcome {
  step: WheelStep;
  roll: RollResult;
  state: AdventureState;
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

/**
 * The wheel an adventure is on, as the hero faces it: a "who is it?" wheel, or a config
 * wheel with whoever it cast in place. Options that don't fit this cast character and this
 * hero (`castCondition`) are left out, and a cast foe stands in for the wheel's `foe`.
 */
export function getAdventureStep(
  config: GameConfig,
  stepId: string,
  state: Pick<AdventureState, 'cast' | 'character'> & Partial<Pick<AdventureState, 'castChoices'>>,
): WheelStep {
  if (isWhoStep(stepId)) return createWhoStep(config, stepId.slice(WHO_STEP_PREFIX.length), state.castChoices ?? []);
  const step = getStep(config, stepId);
  const cast = state.cast?.stepId === stepId ? state.cast.character : null;
  const options = step.options.some((o) => o.castCondition)
    ? step.options.filter((o) => !o.castCondition || (cast !== null && o.castCondition(cast, state.character)))
    : step.options;
  let faced = options === step.options ? step : { ...step, options };
  if (step.foeOf) faced = { ...faced, foe: step.foeOf(state.character) };
  if (cast && step.cast?.asFoe) faced = { ...faced, foe: { name: cast.name, power: calculatePowerRating(cast) } };
  return state.character.story || state.character.expedition ? withStoryText(faced, state.character) : faced;
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

/** Any wheel a RollRecord can point at, for showing history. Undefined for unknown ids. */
export function findStep(config: GameConfig, stepId: string): WheelStep | undefined {
  if (isWhoStep(stepId)) return createWhoStep(config, stepId.slice(WHO_STEP_PREFIX.length), []);
  return config.steps[stepId];
}

/** Begin an adventure. */
export function startAdventure(config: GameConfig, char: Character): AdventureState {
  if (!canAdventure(char)) {
    throw new EngineError('INVALID_STATUS', `${char.name} cannot adventure (${char.role}, ${char.status}).`);
  }
  return {
    character: risingMeters(config, char),
    currentStepId: config.adventure.entryStepId,
    stepsTaken: 0,
    rolls: [],
    fameEarned: 0,
    fate: null,
    cast: null,
    castChoices: [],
    castEffects: [],
    worldThreat: 0,
  };
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
  state: AdventureState,
  config: GameConfig,
  world: World,
  rng: Rng = defaultRng,
): AdventureSpinOutcome {
  const step = currentStep(state, config);
  const roll = rollWeightedOption(dealOptions(step, state.character, config), world, state.character, rng);
  return resolveRoll(state, config, world, rng, step, roll);
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
  const slices = resolveSlices(dealOptions(step, state.character, config), world, state.character);
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
  if (state.stepsTaken >= MAX_GENERATION_STEPS) {
    throw new EngineError(
      'STEP_LIMIT',
      `An adventure exceeded ${MAX_GENERATION_STEPS} spins. Check the adventure wheels for an unintended loop.`,
    );
  }
  return getAdventureStep(config, state.currentStepId, state);
}

/** Apply a decided roll, spun or chosen: the adventure moves on. */
function resolveRoll(
  state: AdventureState,
  config: GameConfig,
  world: World,
  rng: Rng,
  step: WheelStep,
  roll: RollResult,
): AdventureSpinOutcome {
  const { option, probability } = roll.winner;

  // "Who is it?": the winner is who the next wheel features. Nothing else happens yet.
  if (isWhoStep(step.id)) {
    const chosen = state.castChoices.find((c) => c.id === option.id) ?? null;
    const target = step.id.slice(WHO_STEP_PREFIX.length);
    return {
      step,
      roll,
      state: {
        ...state,
        currentStepId: target,
        stepsTaken: state.stepsTaken + 1,
        cast: chosen && { stepId: target, character: chosen },
        castChoices: [],
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
      ...(roll.draw < 0 && { chosen: true }),
    },
  ];
  const applied = applyEffects(state.character, option, step.id, config);
  const titled = option.epithet ? { ...applied, title: earnedTitle(config, applied, rolls) } : applied;
  const looted = spoils ? applySpoils(titled, spoils) : titled;
  const famed = { ...looted, fame: Math.max(0, (looted.fame ?? 0) + fame) };
  // The quest remembers: this wheel is met, and the option's story effect is written down.
  const seen = markSeen(famed, step.id);
  const storied = option.story ? applyStory(seen, option.story, config, world, cast?.name) : seen;
  // A stat worn down to nothing is fatal: no strength, no breath, no mind left to go on with.
  const spent = storied.status === 'alive' ? STAT_KEYS.find((key) => storied.stats[key] <= 0) : undefined;
  const ended: Character = spent
    ? { ...storied, status: 'fallen', ...(storied.story && { story: { ...storied.story, log: [...storied.story.log, `Their ${spent} gave out entirely.`] } }) }
    : storied;
  let character = option.place ? explore(ended, option.place, world, config, rng) : ended;
  const fate = spent ? `Their ${spent} gave out entirely` : option.fate ? storyText(option.fate, character, cast?.name) : state.fate;

  let next = canAdventure(character) ? resolveNextStep(option.nextStepId, world, character) : null;
  // A full meter has the last word, as the road would end (but never straight after its own wheel).
  const filled = next === null && canAdventure(character) && !meterTriggeredBy(config, step.id) ? fullMeter(config, character) : undefined;
  if (filled) {
    next = filled.trigger;
    character = { ...character, meters: { ...character.meters, [filled.id]: 0 } };
  }
  const arrival = arrive(config, next, world, character, rng);
  if (arrival.expedition) character = { ...character, expedition: arrival.expedition };
  const effects = cast ? [option.castEffect, spoils?.effect].filter((e): e is CastEffect => e !== undefined) : [];
  rolls[rolls.length - 1] = { ...rolls.at(-1)!, ...rollExtras(config, step, option, character, cast?.name) };

  return {
    step,
    roll,
    state: {
      ...state,
      character,
      currentStepId: arrival.stepId,
      stepsTaken: state.stepsTaken + 1,
      rolls,
      fameEarned: state.fameEarned + fame,
      fate,
      worldThreat: state.worldThreat + (option.story?.worldThreat ?? 0),
      cast: arrival.cast,
      castChoices: arrival.choices,
      castEffects: [...state.castEffects, ...effects.map((effect) => ({ characterId: cast!.id, effect }))],
    },
  };
}

/**
 * Arriving at the next wheel. A cast wheel with two or more candidates is preceded by a
 * "who is it?" wheel (up to MAX_CAST_CHOICES of them, picked at random); with one, they
 * appear at once; with none, the wheel plays without anyone.
 */
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
): { state: AdventureState; spins: AdventureSpinOutcome[] } {
  let state = startAdventure(config, char);
  const spins: AdventureSpinOutcome[] = [];
  while (!isAdventureOver(state)) {
    const outcome = spinAdventure(state, config, world, rng);
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
  const { story, expedition, ...character } = state.character;
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
    weaponTier: effect.weaponTier ?? target.weaponTier,
    armorTier: effect.armorTier ?? target.armorTier,
    traits,
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
