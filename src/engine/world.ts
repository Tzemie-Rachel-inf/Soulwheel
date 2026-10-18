import { EngineError } from './errors';
import { createId, defaultRng, type Rng } from './rng';
import type { Character, SingletonKey, World } from './types';

export function createWorld({ rng = defaultRng, now = Date.now() }: { rng?: Rng; now?: number } = {}): World {
  return {
    schemaVersion: 10,
    id: createId('wld', rng),
    createdAt: now,
    activeSingletons: {},
    heroId: null,
    roster: [],
    graveyard: [],
    hallOfFame: [],
    threatLevel: 0,
    season: 0,
    chronicle: [],
    omens: [],
    places: [],
  };
}

// ─── Singletons: generic over any string key ───────────────────────────────

/** True when someone holds this one-of-a-kind role. Works for any key, known or not. */
export function isSingletonClaimed(world: World, key: SingletonKey): boolean {
  return Object.hasOwn(world.activeSingletons, key);
}

/** Id of the character holding this role, if any. */
export function getSingletonHolderId(world: World, key: SingletonKey): string | undefined {
  return isSingletonClaimed(world, key) ? world.activeSingletons[key] : undefined;
}

/** The living character holding this role, if any. */
export function getSingletonHolder(world: World, key: SingletonKey): Character | undefined {
  const id = getSingletonHolderId(world, key);
  return id === undefined ? undefined : world.roster.find((c) => c.id === id);
}

/**
 * Free every role a character holds (on death, retirement, victory...). Pure.
 * The matching wheel options unlock on the next roll.
 */
export function releaseSingletons(world: World, characterId: string): World {
  const activeSingletons = Object.fromEntries(
    Object.entries(world.activeSingletons).filter(([, holderId]) => holderId !== characterId),
  );
  return { ...world, activeSingletons };
}

/**
 * The hero the player is living through, while their story lasts: alive and still a hero.
 * Undefined between lives, which is when a new soul can be rolled.
 */
export function playerHero(world: World): Character | undefined {
  if (world.heroId === null) return undefined;
  const hero = world.roster.find((c) => c.id === world.heroId);
  return hero && hero.status === 'alive' && hero.role === 'hero' ? hero : undefined;
}

/** Anyone the world remembers, living or not: roster, graveyard, then hall of fame. */
export function findCharacter(world: World, id: string): Character | undefined {
  return (
    world.roster.find((c) => c.id === id) ??
    world.graveyard.find((c) => c.id === id) ??
    world.hallOfFame.find((c) => c.id === id)
  );
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

/**
 * File a character where their status says they belong, removing them from wherever
 * they were: alive → roster, fallen → graveyard, retired or victorious → hall of fame.
 * Someone already in the right list keeps their place in it. Pure: returns a new World.
 *
 * Leaving the roster frees every one-of-a-kind role they held, and so does turning
 * outlaw or minion: the Spire and the Sword serve heroes. Settling down as an NPC keeps
 * them (a Monarch is still the only Monarch).
 */
export function placeCharacter(world: World, char: Character): World {
  const listOf = (c: Character): 'roster' | 'graveyard' | 'hallOfFame' =>
    c.status === 'fallen' ? 'graveyard' : c.status === 'alive' || c.status === 'rolling' ? 'roster' : 'hallOfFame';
  const target = listOf(char);
  const keepsRoles = target === 'roster' && char.role !== 'outlaw' && char.role !== 'minion';
  const base = keepsRoles ? world : releaseSingletons(world, char.id);

  const place = (list: Character[], key: typeof target): Character[] => {
    const at = list.findIndex((c) => c.id === char.id);
    if (key !== target) return at < 0 ? list : list.filter((c) => c.id !== char.id);
    return at < 0 ? [...list, char] : list.map((c) => (c.id === char.id ? char : c));
  };
  return {
    ...base,
    roster: place(base.roster, 'roster'),
    graveyard: place(base.graveyard, 'graveyard'),
    hallOfFame: place(base.hallOfFame, 'hallOfFame'),
  };
}

/**
 * Place a freshly rolled character into the world. Pure: returns a new World.
 *
 * The character becomes `alive`, joins the roster, and only now are its
 * `singletonClaims` written into `activeSingletons`, whatever their keys.
 * Abandoning a half-rolled character therefore never leaves a phantom holder behind.
 *
 * A hero becomes the player's hero (`world.heroId`), lived through until their story ends.
 * Anyone else (a Demon Lord) takes their place in the world, and the player rolls again.
 *
 * @throws EngineError('INVALID_STATUS') if the character isn't `rolling`.
 * @throws EngineError('HERO_ALIVE') if the player's last hero is still alive.
 * @throws EngineError('SINGLETON_CONFLICT') if a claimed role was taken in the meantime.
 */
export function commitCharacter(world: World, char: Character): World {
  const living = playerHero(world);
  if (char.status === 'rolling' && living) {
    throw new EngineError('HERO_ALIVE', `${living.name} is still alive; their story has to end before another begins.`);
  }
  const placed = welcomeCharacter(world, char);
  return { ...placed, heroId: char.role === 'hero' ? char.id : null };
}

/**
 * Place a freshly rolled character of the world's own (a rival hero, a Demon Lord risen
 * between seasons): alive, in the roster, their one-of-a-kind roles claimed. The player's
 * hero is untouched.
 *
 * @throws EngineError('INVALID_STATUS') if the character isn't `rolling`.
 * @throws EngineError('SINGLETON_CONFLICT') if a claimed role is already held.
 */
export function welcomeCharacter(world: World, char: Character): World {
  if (char.status !== 'rolling') {
    throw new EngineError('INVALID_STATUS', `Only rolling characters can be committed (got "${char.status}").`);
  }

  let activeSingletons = world.activeSingletons;
  for (const key of char.singletonClaims) {
    const holder = getSingletonHolderId(world, key);
    if (holder !== undefined) {
      throw new EngineError('SINGLETON_CONFLICT', `"${key}" is already held by ${holder}; ${char.id} cannot claim it.`);
    }
    // Computed keys in an object literal always create an own property, so even
    // a key like "__proto__" is stored as data rather than touching the prototype.
    activeSingletons = { ...activeSingletons, [key]: char.id };
  }

  return { ...world, activeSingletons, roster: [...world.roster, { ...char, status: 'alive' }] };
}
