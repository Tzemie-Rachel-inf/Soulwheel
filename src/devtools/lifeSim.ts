/**
 * Life simulation: many heroes, each lived from creation to the end of their story, the way the
 * game plays them. Worlds persist between lives, so later heroes meet earlier ones (their graves,
 * their thrones, their relics), and the world takes its own turn after every adventure.
 *
 *   per world ─▶ roll a soul (a Demon Lord or a sworn champion enters the world; roll again)
 *             ─▶ adventures until their story ends (choice wheels picked by their weights, like an autoplayer)
 *             ─▶ the next soul
 *
 * Each life is summed up as a `LifeRecord`: what happened that a player would remember. The
 * summary counts how many lives had something very interesting going on, and why.
 * Pure over the engine: nothing is saved anywhere.
 */
import { canAdventure, completeAdventure, isWhoStep, rollFullAdventure } from '../engine/adventure';
import { isBattleStep } from '../engine/battle';
import { fameStanding } from '../engine/fame';
import { rollFullCharacter } from '../engine/generation';
import { calculatePowerRating } from '../engine/power';
import { createSeededRng, type Rng } from '../engine/rng';
import { RARITIES, STAT_KEYS, type Character, type GameConfig, type Rarity, type RollRecord, type SpellMode, type WheelOption, type World } from '../engine/types';
import { commitCharacter, createWorld, findCharacter, playerHero } from '../engine/world';
import { chronicleAdventure } from '../state/chronicle';
import { worldTurn } from '../state/worldTurn';

/** One moment worth remembering. */
export interface Highlight {
  /** Which adventure (1-based). */
  adventure: number;
  kind: 'hype' | 'identity' | 'ending' | 'callback' | 'event';
  text: string;
  rarity?: Rarity;
}

export interface LifeRecord {
  world: number;
  name: string;
  startRace: string | null;
  endRace: string | null;
  /** How fate treats them (their archetype's id), if they have one. */
  archetype: string | null;
  startCp: number;
  endCp: number;
  adventures: number;
  spins: number;
  /** Adventures that left only ±1–2 stat points (or nothing at all) behind. */
  flavorOnly: number;
  /** Adventures that were exactly two spins long. */
  twoSpin: number;
  /** Adventures of 4–10 spins. */
  midLength: number;
  /** Decisions the player made (choice wheels). */
  decisions: number;
  /** Epic-or-rarer results landed on adventures (not counting stat-ladder rungs). */
  hype: number;
  /** Race changes and new roles during their adventures. */
  identityChanges: number;
  /** Something from the world or their own past came back: a cast character, a quest rival, a hook, a place, a meter. */
  callbacks: number;
  /** Meters that filled, and the wheel that came of it. */
  meterEvents: number;
  /** Places they put on the map, and times they went back to one. */
  placesFound: number;
  placeReturns: number;
  ending: string;
  remarkableEnding: boolean;
  /** Boss battles fought, and won; their rounds; how deep each Crit Cascade chained (1–4). */
  battles: number;
  battlesWon: number;
  battleRounds: number;
  cascades: number[];
  fame: number;
  fameTier: string;
  highlights: Highlight[];
}

export interface SimOptions {
  worlds: number;
  heroesPerWorld: number;
  seed: number;
  /** A safety cap on one life. */
  maxAdventures?: number;
  /** How boss battles cast spells (default: the config's). */
  spellMode?: SpellMode;
}

const HYPE: readonly Rarity[] = ['epic', 'legendary', 'mythical'];
const rarityRank = (r: Rarity) => RARITIES.indexOf(r);

/** Live `heroesPerWorld` heroes in each of `worlds` fresh worlds. */
export function simulateLives(config: GameConfig, { worlds, heroesPerWorld, seed, maxAdventures = 60, spellMode }: SimOptions): LifeRecord[] {
  const lives: LifeRecord[] = [];
  for (let w = 0; w < worlds; w++) {
    const rng = createSeededRng(seed + w * 7919);
    let world = createWorld({ rng, now: 0 });
    for (let h = 0; h < heroesPerWorld; h++) {
      const lived = liveOneLife(config, world, rng, w, maxAdventures, spellMode);
      if (!lived) break;
      world = lived.world;
      lives.push(lived.record);
    }
  }
  return lives;
}

/** Roll souls until one is a hero, then live their whole story. */
function liveOneLife(config: GameConfig, start: World, rng: Rng, worldIndex: number, maxAdventures: number, spellMode?: SpellMode): { world: World; record: LifeRecord } | null {
  let world = start;
  let hero: Character | undefined;
  for (let tries = 0; tries < 20 && !hero; tries++) {
    const { character } = rollFullCharacter(config, world, rng, { now: 0 });
    try {
      world = commitCharacter(world, character);
    } catch {
      continue; // a one-of-a-kind role taken meanwhile: roll again
    }
    hero = playerHero(world);
  }
  if (!hero) return null;

  const id = hero.id;
  const startRace = hero.race;
  const startCp = calculatePowerRating(hero);
  const record: LifeRecord = {
    world: worldIndex,
    name: hero.name,
    startRace,
    endRace: startRace,
    archetype: hero.archetype,
    startCp,
    endCp: startCp,
    adventures: 0,
    spins: 0,
    flavorOnly: 0,
    twoSpin: 0,
    midLength: 0,
    decisions: 0,
    hype: 0,
    identityChanges: 0,
    callbacks: 0,
    meterEvents: 0,
    placesFound: 0,
    placeReturns: 0,
    ending: 'still adventuring',
    battles: 0,
    battlesWon: 0,
    battleRounds: 0,
    cascades: [],
    remarkableEnding: false,
    fame: 0,
    fameTier: '',
    highlights: [],
  };

  let current: Character | undefined = hero;
  while (current && canAdventure(current) && record.adventures < maxAdventures) {
    const before: Character = current;
    const { state, spins } = rollFullAdventure(config, world, before, rng, spellMode ? { spellMode } : {});
    for (const spin of spins) {
      const battle = spin.state.battle;
      if (!isBattleStep(spin.step.id) || !battle) continue;
      record.battleRounds += 1;
      if (battle.last?.kind === 'crit' && battle.last.cascade) record.cascades.push(battle.last.cascade.length);
      if (battle.verdict) {
        record.battles += 1;
        if (battle.verdict === 'win') record.battlesWon += 1;
      }
    }
    const n = record.adventures + 1;
    record.adventures = n;
    record.spins += spins.length;
    if (spins.length === 2) record.twoSpin += 1;
    if (spins.length >= 4 && spins.length <= 10) record.midLength += 1;
    if (isFlavorOnly(before, state.character)) record.flavorOnly += 1;
    const expedition = state.character.expedition;
    if (expedition?.isNew) record.placesFound += 1;
    else if (expedition) record.placeReturns += 1;

    const rolls = state.rolls.filter((r) => !isWhoStep(r.stepId));
    record.decisions += rolls.filter((r) => r.chosen || config.steps[r.stepId]?.choice).length;
    for (const roll of rolls) noteRoll(config, roll, n, record);
    if (state.character.story?.rival) {
      record.callbacks += 1;
      record.highlights.push({ adventure: n, kind: 'callback', text: `Made a rival on a quest: ${state.character.story.rival.name}, ${state.character.story.rival.title}` });
    }
    if (state.character.race !== before.race) {
      record.identityChanges += 1;
      record.highlights.push({ adventure: n, kind: 'identity', text: `Became ${raceLabel(config, state.character.race)}` });
    }
    if (state.character.role !== before.role) {
      record.identityChanges += 1;
      record.highlights.push({ adventure: n, kind: 'identity', text: `Became ${state.character.role === 'npc' ? (state.character.title ?? 'someone new') : state.character.role}` });
    }

    const after = completeAdventure(world, state, 0);
    world = worldTurn(chronicleAdventure(world, after, id, config), config, before, rng);
    current = findCharacter(world, id);
  }

  const final = current ?? hero;
  record.endRace = final.race;
  record.endCp = calculatePowerRating(final);
  record.fame = final.fame;
  record.fameTier = fameStanding(config.fame.tiers, final.fame).tier.name;
  record.ending = endingOf(final);
  record.remarkableEnding = isRemarkable(final);
  if (record.remarkableEnding) record.highlights.push({ adventure: record.adventures, kind: 'ending', text: record.ending });
  return { world, record };
}

/** A roll's contribution: an epic-or-rarer result, someone from the world, a hook, a place, a meter. */
function noteRoll(config: GameConfig, roll: RollRecord, adventure: number, record: LifeRecord): void {
  const step = config.steps[roll.stepId];
  const option = step?.options.find((o) => o.id === roll.optionId);
  const rarity = option?.rarity ?? 'common';
  if (step && option && !step.ladder && HYPE.includes(rarity) && !option.setStatus && !isDoorway(option)) {
    record.hype += 1;
    record.highlights.push({ adventure, kind: 'hype', rarity, text: `${option?.label ?? roll.optionId} (${step.title})` });
  }
  if (roll.cast) {
    record.callbacks += 1;
    record.highlights.push({ adventure, kind: 'callback', text: `Met ${roll.cast} (${step?.title ?? roll.stepId})` });
  }
  const extra = roll as RollRecord & { callback?: string; event?: string };
  if (extra.callback) {
    record.callbacks += 1;
    record.highlights.push({ adventure, kind: 'callback', text: extra.callback });
  }
  if (extra.event) {
    record.meterEvents += 1;
    record.highlights.push({ adventure, kind: 'event', text: `${extra.event}: ${option?.label ?? roll.optionId}` });
  }
}

/** What an option can do besides lead somewhere. An option with none of these is only a door to the next wheel. */
const EFFECT_KEYS = [
  'statModifiers', 'setStats', 'luckDelta', 'weaponTierDelta', 'armorTierDelta', 'gear', 'fame', 'grantTraits', 'removeTraits',
  'story', 'grantTags', 'setRole', 'setRace', 'honeLastTrait', 'honeTrait', 'queueSpins', 'epithet', 'setStatus', 'castEffect', 'spoils',
  'meters', 'hooks', 'place',
] as const;

/** A slice that only opens the way to another wheel ("Transform", "Dragon's Den"): the hype is in what comes after. */
function isDoorway(option: WheelOption): boolean {
  const fields = option as unknown as Record<string, unknown>;
  // Counting an encounter (`story.beat`) is bookkeeping, not an effect.
  const effective = (key: string) => fields[key] !== undefined && !(key === 'story' && Object.keys(option.story ?? {}).every((k) => k === 'beat'));
  return option.nextStepId !== null && !EFFECT_KEYS.some(effective);
}

/**
 * Only a stat point or two moved (or nothing): no gear, no trait, no new self, no ending, no place on
 * the map. A meter ticking on its own still counts as nothing.
 */
function isFlavorOnly(before: Character, after: Character): boolean {
  if (after.status !== 'alive' || after.role !== before.role || after.race !== before.race) return false;
  if (after.expedition) return false;
  if (after.traits.length !== before.traits.length || after.weapon?.id !== before.weapon?.id || after.armor?.id !== before.armor?.id || after.weapon?.power !== before.weapon?.power || after.armor?.power !== before.armor?.power) return false;
  if (after.tags.length !== before.tags.length) return false;
  const moved = STAT_KEYS.reduce((sum, key) => sum + Math.abs(after.stats[key] - before.stats[key]), 0);
  return moved <= 2;
}

function endingOf(char: Character): string {
  if (char.status === 'alive' && char.role === 'hero') return 'still adventuring';
  const summary = char.fate?.summary;
  if (char.status === 'fallen') return char.tags.includes('martyr') ? `Martyr: ${summary ?? 'gave their life'}` : `Fell: ${summary ?? ''}`.trim();
  if (char.status === 'sealed') return `Sealed in a relic`;
  if (char.status === 'victorious') return `Victorious: ${summary ?? ''}`.trim();
  if (char.status === 'retired') return `Retired: ${summary ?? ''}`.trim();
  return `New life: ${char.role === 'npc' ? (char.title ?? 'npc') : char.role}`;
}

/** An ending that is a story in itself: not just a death in a fight, or hanging up the sword. */
function isRemarkable(char: Character): boolean {
  if (char.status === 'sealed' || char.status === 'victorious') return true;
  if (char.tags.includes('martyr')) return true;
  if (char.role === 'minion' || char.role === 'outlaw') return true;
  if (char.role === 'npc') return ['ruler', 'general', 'mentor'].some((t) => char.tags.includes(t)) || char.singletonClaims.length > 0;
  return false;
}

function raceLabel(config: GameConfig, race: string | null): string {
  const name = race === null ? 'someone else' : (config.races[race]?.name ?? race);
  return /^[AEIOU]/.test(name) ? `an ${name}` : `a ${name}`;
}

// ─── Summary ────────────────────────────────────────────────────────────────

export interface SimSummary {
  lives: number;
  adventures: number;
  medianAdventures: number;
  p90Adventures: number;
  /** Share of all adventures. */
  flavorOnlyShare: number;
  twoSpinShare: number;
  midLengthShare: number;
  decisionsPerAdventure: number;
  /** Lives with at least one epic-or-rarer result. */
  withHype: number;
  /** Lives that changed race or role. */
  withIdentity: number;
  withRemarkableEnding: number;
  /** Lives where something from the world or their past came back at least twice. */
  withThread: number;
  /** Strict: a hype result, a new identity, or a remarkable ending. */
  veryInteresting: number;
  /** Three or more highlights. */
  legendary: number;
  meterEvents: number;
  placesFound: number;
  placeReturns: number;
  /** Lives with at least one meter event. */
  withMeterEvent: number;
  /** Nothing strict, no thread, and most of their adventures were flavor. */
  forgettable: number;
  highlightsHistogram: Record<string, number>;
  hypePerLife: number;
  battles: number;
  battleWinRate: number;
  roundsPerBattle: number;
  /** Crit Cascades by how many wheels they stacked. */
  cascadeDepths: Record<string, number>;
  endings: Record<string, number>;
}

const isStrict = (r: LifeRecord) => r.hype > 0 || r.identityChanges > 0 || r.remarkableEnding;

export function summarize(lives: readonly LifeRecord[]): SimSummary {
  const adventures = lives.reduce((s, r) => s + r.adventures, 0);
  const sorted = lives.map((r) => r.adventures).sort((a, b) => a - b);
  const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
  const count = (f: (r: LifeRecord) => boolean) => lives.filter(f).length;
  const histogram: Record<string, number> = { '0': 0, '1': 0, '2': 0, '3+': 0 };
  for (const r of lives) {
    const n = r.highlights.length;
    histogram[n >= 3 ? '3+' : String(n)]! += 1;
  }
  const endings: Record<string, number> = {};
  for (const r of lives) {
    const key = r.ending.split(':')[0]!;
    endings[key] = (endings[key] ?? 0) + 1;
  }
  return {
    lives: lives.length,
    adventures,
    medianAdventures: pct(0.5),
    p90Adventures: pct(0.9),
    flavorOnlyShare: share(lives.reduce((s, r) => s + r.flavorOnly, 0), adventures),
    twoSpinShare: share(lives.reduce((s, r) => s + r.twoSpin, 0), adventures),
    midLengthShare: share(lives.reduce((s, r) => s + r.midLength, 0), adventures),
    decisionsPerAdventure: share(lives.reduce((s, r) => s + r.decisions, 0), adventures),
    withHype: count((r) => r.hype > 0),
    withIdentity: count((r) => r.identityChanges > 0),
    withRemarkableEnding: count((r) => r.remarkableEnding),
    withThread: count((r) => r.callbacks >= 2),
    veryInteresting: count(isStrict),
    legendary: count((r) => r.highlights.length >= 3),
    meterEvents: lives.reduce((s, r) => s + r.meterEvents, 0),
    placesFound: lives.reduce((s, r) => s + r.placesFound, 0),
    placeReturns: lives.reduce((s, r) => s + r.placeReturns, 0),
    withMeterEvent: count((r) => r.meterEvents > 0),
    forgettable: count((r) => !isStrict(r) && r.callbacks < 2 && r.flavorOnly * 2 >= r.adventures),
    highlightsHistogram: histogram,
    hypePerLife: share(lives.reduce((s, r) => s + r.hype, 0), lives.length),
    battles: lives.reduce((s, r) => s + r.battles, 0),
    battleWinRate: share(lives.reduce((s, r) => s + r.battlesWon, 0), lives.reduce((s, r) => s + r.battles, 0)),
    roundsPerBattle: share(lives.reduce((s, r) => s + r.battleRounds, 0), lives.reduce((s, r) => s + r.battles, 0)),
    cascadeDepths: lives.flatMap((r) => r.cascades).reduce<Record<string, number>>((h, d) => ({ ...h, [d]: (h[d] ?? 0) + 1 }), {}),
    endings,
  };
}

function share(n: number, of: number): number {
  return of === 0 ? 0 : Math.round((n / of) * 1000) / 1000;
}

/** The best highlight first: hype by rarity, then identity, then the ending, then callbacks. */
export function bestHighlights(record: LifeRecord, n = 4): Highlight[] {
  const weight = (h: Highlight) =>
    h.kind === 'hype' ? 10 + rarityRank(h.rarity ?? 'epic') : h.kind === 'identity' ? 9 : h.kind === 'ending' ? 8 : h.kind === 'event' ? 7 : 1;
  return [...record.highlights].sort((a, b) => weight(b) - weight(a) || a.adventure - b.adventure).slice(0, n);
}
