import { STAT_KEYS, type ActiveSingletons, type Character, type ChronicleEntry, type Omen, type Place, type StatBlock, type World } from './types';

export const WORLD_STORAGE_KEY = 'roguelite.world';

/** The slice of the Web Storage API we use. `localStorage` satisfies it; so does a Map-backed fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function saveWorld(world: World, storage: StorageLike = localStorage): void {
  storage.setItem(WORLD_STORAGE_KEY, JSON.stringify(world));
}

/**
 * Load the saved world, or `null` if there is none or it can't be trusted
 * (corrupt JSON, wrong shape, a schema version other than 2–9). Never throws.
 *
 * Older saves are upgraded in place: characters gain whatever fields they predate
 * (`race: null`, `personality: null`, `archetype: null`, `title: null`, an empty adventure log, no luck, an empty stat bank,
 * no queued spins, no armour, and fame for the adventures already behind them), so a world
 * rolled under an earlier version keeps going.
 *
 * Singleton entries whose value isn't a character id are dropped, so a damaged
 * save can never lock a role forever.
 *
 * Saves from before one-hero-at-a-time (v8 and older) could have several heroes alive at
 * once. The newest becomes the player's hero; the rest stay in the world as its own heroes,
 * met on the road as rivals.
 */
export function loadWorld(storage: StorageLike = localStorage): World | null {
  const raw = storage.getItem(WORLD_STORAGE_KEY);
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isWorldShape(parsed)) return null;

  const roster = parsed.roster.map(upgradeCharacter);
  return {
    ...parsed,
    schemaVersion: 9,
    activeSingletons: sanitizeSingletons(parsed.activeSingletons),
    // A v9 world between lives has no hero, and its other living heroes are the world's own.
    heroId: parsed.schemaVersion >= 9 ? (typeof parsed.heroId === 'string' ? parsed.heroId : null) : newestHero(roster),
    roster,
    graveyard: parsed.graveyard.map(upgradeCharacter),
    hallOfFame: parsed.hallOfFame.map(upgradeCharacter),
    // A world from before the chronicle starts with none; the state layer writes it from history.
    season: finiteOr(parsed.season, 0),
    chronicle: Array.isArray(parsed.chronicle) ? parsed.chronicle.filter(isChronicleEntry) : [],
    omens: Array.isArray(parsed.omens) ? parsed.omens.filter((o): o is Omen => typeof o?.id === 'string' && typeof o?.until === 'number') : [],
    // A world from before places has none on its map.
    places: Array.isArray(parsed.places) ? parsed.places.filter(isPlace) : [],
  };
}

function isPlace(value: unknown): value is Place {
  const p = value as Partial<Place> | null;
  return typeof p === 'object' && p !== null && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.kind === 'string' && typeof p.depth === 'number';
}

function isChronicleEntry(value: unknown): value is ChronicleEntry {
  const e = value as Partial<ChronicleEntry> | null;
  return typeof e === 'object' && e !== null && typeof e.season === 'number' && typeof e.text === 'string' && typeof e.kind === 'string';
}

/** The most recently created living hero, for a save from before `heroId`. */
function newestHero(roster: readonly Character[]): string | null {
  const heroes = roster.filter((c) => c.role === 'hero' && c.status === 'alive');
  return heroes.reduce<Character | null>((newest, c) => (!newest || c.createdAt >= newest.createdAt ? c : newest), null)?.id ?? null;
}

export function clearWorld(storage: StorageLike = localStorage): void {
  storage.removeItem(WORLD_STORAGE_KEY);
}

/** Fill in fields added after v2. A no-op for characters that already have them. */
function upgradeCharacter(raw: Character): Character {
  // A quest's memory and an expedition live only while an adventure runs; one in a save is stale.
  const { story: _story, expedition: _expedition, ...char } = raw;
  const loose = char as Partial<Character>;
  return {
    ...char,
    race: typeof loose.race === 'string' ? loose.race : null,
    personality: typeof loose.personality === 'string' ? loose.personality : null,
    archetype: typeof loose.archetype === 'string' ? loose.archetype : null,
    title: typeof loose.title === 'string' ? loose.title : null,
    adventures: Array.isArray(loose.adventures) ? loose.adventures : [],
    luck: typeof loose.luck === 'number' && Number.isFinite(loose.luck) ? loose.luck : 0,
    statBonus: upgradeStatBlock(loose.statBonus),
    spinQueue: Array.isArray(loose.spinQueue) ? loose.spinQueue.filter((id) => typeof id === 'string') : [],
    armorTier: finiteOr(loose.armorTier, 0),
    // Before fame, heroes still had a reputation: call it a few points per adventure survived.
    fame: finiteOr(loose.fame, (Array.isArray(loose.adventures) ? loose.adventures.length : 0) * LEGACY_FAME_PER_ADVENTURE),
    ...(loose.meters !== undefined && { meters: upgradeMeters(loose.meters) }),
  };
}

/** Fame credited to a character from before fame, per adventure behind them. */
export const LEGACY_FAME_PER_ADVENTURE = 6;

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Meters as numbers: anything else in a damaged save is dropped. */
function upgradeMeters(value: unknown): Record<string, number> {
  if (typeof value !== 'object' || value === null) return {};
  return Object.fromEntries(Object.entries(value).filter((e): e is [string, number] => typeof e[1] === 'number' && Number.isFinite(e[1])));
}

function upgradeStatBlock(value: unknown): StatBlock {
  const loose = (typeof value === 'object' && value !== null ? value : {}) as Partial<Record<string, unknown>>;
  const block = {} as StatBlock;
  for (const key of STAT_KEYS) {
    const n = loose[key];
    block[key] = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  }
  return block;
}

function sanitizeSingletons(value: unknown): ActiveSingletons {
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0,
    ),
  );
}

/** A structural check of the top-level shape, not a full schema validation. */
function isWorldShape(
  value: unknown,
): value is Omit<World, 'schemaVersion' | 'heroId' | 'season' | 'chronicle' | 'omens' | 'places'> & {
  schemaVersion: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  heroId?: unknown;
  season?: unknown;
  chronicle?: unknown;
  omens?: Array<Partial<Omen> | null>;
  places?: unknown[];
} {
  if (typeof value !== 'object' || value === null) return false;
  const w = value as Record<string, unknown>;
  return (
    typeof w.schemaVersion === 'number' && [2, 3, 4, 5, 6, 7, 8, 9].includes(w.schemaVersion) &&
    typeof w.id === 'string' &&
    typeof w.threatLevel === 'number' &&
    typeof w.activeSingletons === 'object' &&
    w.activeSingletons !== null &&
    !Array.isArray(w.activeSingletons) &&
    Array.isArray(w.roster) &&
    Array.isArray(w.graveyard) &&
    Array.isArray(w.hallOfFame)
  );
}
