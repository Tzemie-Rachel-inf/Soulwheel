import { EngineError } from './errors';
import { equip, mintGear, offerGear, temper } from './gear';
import { createId, defaultRng, type Rng } from './rng';
import {
  STAT_KEYS,
  type CastSpoils,
  type Character,
  type GameConfig,
  type GearGrant,
  type ResolvedSlice,
  type RollRecord,
  type StatBlock,
  type WheelOption,
} from './types';

/** The tag a hybrid carries for the race they were before their second ancestry: `blood:wood_elf`. */
export const BLOOD_TAG = 'blood:';

/** Every race a character is: their own first, plus any a hybrid carries in their blood. */
export function racesOf(char: Pick<Character, 'race' | 'tags'>): string[] {
  const blood = char.tags.filter((tag) => tag.startsWith(BLOOD_TAG)).map((tag) => tag.slice(BLOOD_TAG.length));
  return char.race === null ? blood : [char.race, ...blood.filter((r) => r !== char.race)];
}

/** The most power a weapon can have. Power 10 is worth 250 CP. */
export const MAX_WEAPON_TIER = 10;
/** The most power armour can have. Power 10 is worth 200 CP. */
export const MAX_ARMOR_TIER = 10;

export interface CreateCharacterOptions {
  name?: string;
  /** Used for the id. Pass the run's seeded RNG to make ids reproducible. */
  rng?: Rng;
  /** Timestamp override, for deterministic tests. */
  now?: number;
}

/**
 * A fresh, uncommitted character with the config's base stats and nothing else.
 * Without a `name` they stay unnamed ('') until `nameCharacter` runs at the end of creation.
 */
export function createCharacter(
  config: GameConfig,
  { name = '', rng = defaultRng, now = Date.now() }: CreateCharacterOptions = {},
): Character {
  return {
    id: createId('chr', rng),
    name,
    createdAt: now,
    role: 'hero',
    status: 'rolling',
    race: null,
    personality: null,
    archetype: null,
    title: null,
    stats: { ...config.baseStats },
    statBonus: { might: 0, agility: 0, intellect: 0, arcana: 0, vitality: 0 },
    luck: 0,
    weapon: null,
    armor: null,
    fame: 0,
    traits: [],
    tags: [],
    singletonClaims: [],
    history: [],
    adventures: [],
    spinQueue: [],
  };
}

/**
 * Apply a rolled creation slice to a character: its effects, plus a `history` entry
 * with the probability it had. Pure: returns a new Character, never mutates.
 *
 * @throws EngineError('UNKNOWN_TRAIT' | 'UNKNOWN_RACE') if the option names something missing from config.
 */
export function applyOption(
  char: Character,
  slice: ResolvedSlice,
  stepId: string,
  config: GameConfig,
  /** Overrides for the history entry, e.g. a ladder bump's landing and its odds. */
  record?: Partial<RollRecord>,
): Character {
  const next = applyEffects(char, slice.option, stepId, config);
  return {
    ...next,
    history: [...char.history, { stepId, optionId: slice.option.id, probability: slice.probability, ...record }],
  };
}

/**
 * An option's effects on a character, without logging the roll anywhere. Adventures use
 * this directly, since their rolls go into an AdventureRecord rather than `history`.
 *
 * - Stats change by `statModifiers` and floor at 0; a gain stops at `statCap` (a teacher's own level).
 * - `statBonus` is banked for the stat wheels; `setStats` sets a stat to its rolled value
 *   and spends that stat's bank (the bank has already moved the roll: see ladder.ts).
 * - Luck changes by `luckDelta`.
 * - A `weaponTierDelta` gain finds a better weapon, offered like `gear`; an `upgrade` or a loss
 *   tempers the one in hand (engine/gear.ts `temper`). Armour likewise.
 *   `gear` is a whole item: an empty slot takes it, a filled one has it offered (`gearOffers`).
 * - Traits are copied from config (snapshots); a trait already owned is skipped.
 * - `honeLastTrait` then multiplies the newest trait's power and gives it a rank;
 *   `honeTrait` sets a named trait's rank, its power measured from its base in config.
 * - Tags and singleton claims are set-unions; `removeTags` then takes tags away.
 * - Meters move by `meters`, within 0 and each meter's max.
 * - `setRole`, `setRace`, `setPersonality`, `setArchetype` and `setStatus` overwrite. A new archetype
 *   brings a frozen copy of its rules (`Character.rules`); stats they hold fixed stay fixed, and a
 *   soul whose rules forbid a weapon holds none.
 * - Spinning a wheel that is in the spin queue uses up one of its spins; `queueSpins` adds more.
 *
 * @throws EngineError('UNKNOWN_TRAIT' | 'UNKNOWN_RACE' | 'UNKNOWN_PERSONALITY') if the option
 *         names something missing from config.
 */
export function applyEffects(
  char: Character,
  option: WheelOption,
  stepId: string,
  config: GameConfig,
): Character {
  if (option.setRace !== undefined && !config.races[option.setRace]) {
    throw new EngineError(
      'UNKNOWN_RACE',
      `Option "${option.id}" on step "${stepId}" sets unknown race "${option.setRace}".`,
    );
  }

  if (option.setPersonality !== undefined && !config.personalities[option.setPersonality]) {
    throw new EngineError(
      'UNKNOWN_PERSONALITY',
      `Option "${option.id}" on step "${stepId}" sets unknown personality "${option.setPersonality}".`,
    );
  }

  if (option.setArchetype !== undefined && !config.archetypes[option.setArchetype]) {
    throw new EngineError(
      'UNKNOWN_ARCHETYPE',
      `Option "${option.id}" on step "${stepId}" sets unknown archetype "${option.setArchetype}".`,
    );
  }

  const stats: StatBlock = { ...char.stats };
  const statBonus: StatBlock = { ...char.statBonus };
  for (const key of STAT_KEYS) {
    const rolled = option.setStats?.[key];
    if (rolled !== undefined) {
      stats[key] = rolled;
      statBonus[key] = 0;
    }
    const before = stats[key];
    stats[key] = Math.max(0, stats[key] + (option.statModifiers?.[key] ?? 0));
    const cap = option.statCap?.[key];
    if (cap !== undefined && stats[key] > before) stats[key] = Math.max(before, Math.min(stats[key], cap));
    statBonus[key] += option.statBonus?.[key] ?? 0;
  }

  const traits = [...char.traits];
  for (const traitId of option.grantTraits ?? []) {
    if (traits.some((t) => t.id === traitId)) continue;
    const def = config.traits[traitId];
    if (!def) {
      throw new EngineError(
        'UNKNOWN_TRAIT',
        `Option "${option.id}" on step "${stepId}" grants unknown trait "${traitId}".`,
      );
    }
    traits.push({ ...def });
  }
  if (option.removeTraits?.length) {
    const removed = new Set(option.removeTraits);
    for (let i = traits.length - 1; i >= 0; i--) if (removed.has(traits[i]!.id)) traits.splice(i, 1);
  }
  const hone = option.honeLastTrait;
  const honed = traits.at(-1);
  if (hone && honed) traits[traits.length - 1] = { ...honed, power: Math.round(honed.power * hone.factor), rank: hone.rank };
  const master = option.honeTrait;
  if (master) {
    const def = config.traits[master.trait];
    if (!def) {
      throw new EngineError(
        'UNKNOWN_TRAIT',
        `Option "${option.id}" on step "${stepId}" masters unknown trait "${master.trait}".`,
      );
    }
    const at = traits.findIndex((t) => t.id === master.trait);
    if (at >= 0) traits[at] = { ...traits[at]!, power: Math.round(def.power * master.factor), rank: master.rank };
  }

  // A new archetype brings its rules, frozen like a trait; whatever they hold fixed stays fixed.
  const archetype = option.setArchetype === undefined ? undefined : config.archetypes[option.setArchetype];
  const rules = archetype ? (archetype.rules && structuredClone(archetype.rules)) : char.rules;
  for (const [key, value] of Object.entries(rules?.fixedStats ?? {}) as [keyof StatBlock, number][]) {
    stats[key] = value;
    statBonus[key] = 0;
  }

  const { rules: _oldRules, decrees: _oldDecrees, ...kept } = char;
  const applied: Character = {
    ...(archetype ? kept : char),
    ...(rules && { rules }),
    ...(archetype?.rules?.decrees && { decrees: archetype.rules.decrees }),
    ...(option.fightBoost !== undefined && { fightBoost: option.fightBoost }),
    role: option.setRole ?? char.role,
    race: option.setRace ?? char.race,
    personality: option.setPersonality ?? char.personality,
    archetype: option.setArchetype ?? char.archetype,
    status: option.setStatus ?? char.status,
    stats,
    statBonus,
    luck: char.luck + (option.luckDelta ?? 0),
    traits,
    tags: union(char.tags, option.grantTags).filter((tag) => !option.removeTags?.includes(tag)),
    ...(option.meters && { meters: addMeters(char.meters, option.meters, config) }),
    singletonClaims: union(char.singletonClaims, option.claimSingleton ? [option.claimSingleton] : []),
    spinQueue: [...withoutFirst(char.spinQueue, stepId), ...queued(option.queueSpins)],
  };
  return applyGear(applied, option, config);
}

/**
 * An option's gear: tempering first (`weaponTierDelta`), then the items it hands over, each
 * taken at once into an empty slot or offered for a filled one. A soul whose rules forbid a
 * weapon puts theirs down. Abilities are kept in step with what is equipped.
 */
function applyGear(char: Character, option: WheelOption, config: GameConfig): Character {
  let next = char;
  // A loss wears down what they carry, and so does a smith's work; any other gain is something new, found.
  const found: { weapon?: GearGrant; armor?: GearGrant } = {};
  for (const [kind, delta] of [['weapon', option.weaponTierDelta], ['armor', option.armorTierDelta]] as const) {
    if (!delta) continue;
    if (delta < 0 || option.upgrade) next = temper(next, kind, delta, config);
    else found[kind] = { better: delta };
  }
  for (const kind of ['weapon', 'armor'] as const) {
    const grant = option.gear?.[kind] ?? found[kind];
    if (grant === undefined) continue;
    const minted = mintGear(config, next, kind, grant);
    next = offerGear(minted.char, minted.item, config);
  }
  return equip(next, 'weapon', next.rules?.noWeapon ? null : next.weapon, config);
}

/**
 * What a hero takes from a cast character (see `WheelOption.spoils`): their gear, offered (an
 * empty slot takes it at once), what they trained into them, and every trait handed over that
 * the hero doesn't already own.
 * Pure: returns a new Character.
 */
export function applySpoils(char: Character, spoils: CastSpoils, config: GameConfig): Character {
  const traits = [...char.traits];
  for (const trait of spoils.traits ?? []) {
    if (!traits.some((t) => t.id === trait.id)) traits.push({ ...trait });
  }
  const stats = { ...char.stats };
  for (const key of STAT_KEYS) stats[key] = Math.max(0, stats[key] + (spoils.stats?.[key] ?? 0));
  let next: Character = { ...char, stats, traits };
  if (spoils.weapon) next = offerGear(next, spoils.weapon, config);
  if (spoils.armor) next = offerGear(next, spoils.armor, config);
  return next;
}

/** Meters after a change, each kept within 0 and its max (meters the config doesn't know are left out). */
export function addMeters(meters: Character['meters'], delta: Record<string, number>, config: GameConfig): Record<string, number> {
  const next = { ...meters };
  for (const [id, n] of Object.entries(delta)) {
    const def = config.meters?.find((m) => m.id === id);
    if (!def) continue;
    next[id] = clamp((next[id] ?? 0) + n, 0, def.max);
  }
  return next;
}

/** The list with its first `item` removed, if there is one. */
function withoutFirst(list: readonly string[], item: string): string[] {
  const at = list.indexOf(item);
  return at < 0 ? [...list] : [...list.slice(0, at), ...list.slice(at + 1)];
}

/** { blessed_powers: 2, arcane_powers: 1 } → ['blessed_powers', 'blessed_powers', 'arcane_powers']. */
function queued(spins: WheelOption['queueSpins']): string[] {
  return Object.entries(spins ?? {}).flatMap(([stepId, n]) => Array.from({ length: Math.max(0, Math.floor(n)) }, () => stepId));
}

/**
 * The best title a character has earned: the highest-priority epithet among every option
 * they rolled, in creation, on finished adventures and in `extra` rolls (later wins ties).
 */
export function earnedTitle(config: GameConfig, char: Character, extra: readonly RollRecord[] = []): string | null {
  const rolls = [...char.history, ...char.adventures.flatMap((a) => a.rolls), ...extra];
  const best = rolls.reduce<WheelOption['epithet']>((top, roll) => {
    const epithet = config.steps[roll.stepId]?.options.find((o) => o.id === roll.optionId)?.epithet;
    return epithet && (!top || epithet.priority >= top.priority) ? epithet : top;
  }, undefined);
  return best?.text ?? null;
}

/**
 * Name a character from what they rolled. Runs once, as creation ends.
 *
 *  - Name: kept if they already have one; otherwise a given name from their race's pool
 *    (or its family's, or the config's fallback), plus the last surname rolled.
 *  - Title: the highest-priority epithet among every option rolled (later wins ties).
 */
export function nameCharacter(config: GameConfig, char: Character, rng: Rng = defaultRng): Character {
  const rolled = char.history.flatMap((roll) => {
    const option = config.steps[roll.stepId]?.options.find((o) => o.id === roll.optionId);
    return option ? [option] : [];
  });
  // An heir carries their house's name, whatever the wheels would have called them.
  const surname = char.lineage?.house ?? rolled.findLast((o) => o.surname !== undefined)?.surname;

  let name = char.name;
  if (!name) {
    const race = char.race === null ? undefined : config.races[char.race];
    const family = race?.family === undefined ? undefined : config.races[race.family];
    const pool = [race?.names, family?.names, config.fallbackNames].find((p) => p && p.length > 0) ?? ['Nameless'];
    const given = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))]!;
    name = surname ? `${given} ${surname}` : given;
  }
  return { ...char, name, title: earnedTitle(config, char) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function union<T>(base: readonly T[], extra: readonly T[] = []): T[] {
  return [...new Set([...base, ...extra])];
}
