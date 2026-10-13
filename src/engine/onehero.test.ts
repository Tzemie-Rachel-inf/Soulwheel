/**
 * One life at a time, and the rules that changed with it: the player's hero, Master a Power
 * as a ladder like Train, and gear that is only kept when it beats what a hero carries.
 */
import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../config/gameConfig';
import { applyOption, createCharacter } from './character';
import { EngineError } from './errors';
import { getStep } from './generation';
import { dealOptions } from './odds';
import { loadWorld, type StorageLike } from './persistence';
import { createSeededRng } from './rng';
import { resolveSlices } from './roll';
import type { Character, ResolvedSlice, World } from './types';
import { commitCharacter, createWorld, placeCharacter, playerHero } from './world';

const world = (): World => createWorld({ rng: createSeededRng(1), now: 0 });
const soul = (seed = 1, name = 'Test'): Character => createCharacter(GAME_CONFIG, { name, rng: createSeededRng(seed), now: 0 });
const alive = (seed = 1): Character => ({ ...soul(seed), status: 'alive' });

/** The wheel as this character is dealt it. */
function slices(stepId: string, char: Character, w: World = world()): ResolvedSlice[] {
  return resolveSlices(dealOptions(getStep(GAME_CONFIG, stepId), char, GAME_CONFIG), w, char);
}
const slice = (stepId: string, optionId: string, char: Character) => slices(stepId, char).find((s) => s.option.id === optionId);

/** Land on one option, as if the wheel had picked it. */
function take(char: Character, stepId: string, optionId: string): Character {
  const s = slice(stepId, optionId, char)!;
  return applyOption(char, s, stepId, GAME_CONFIG);
}

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

describe('one hero at a time', () => {
  it('makes a committed hero the player’s hero', () => {
    const hero = soul(1, 'Aria');
    const w = commitCharacter(world(), hero);
    expect(w.heroId).toBe(hero.id);
    expect(playerHero(w)?.name).toBe('Aria');
  });

  it('refuses a second hero while the first lives, and allows one once their story ends', () => {
    const first = soul(1, 'Aria');
    const w = commitCharacter(world(), first);
    expect(() => commitCharacter(w, soul(2, 'Brann'))).toThrowError(EngineError);
    try {
      commitCharacter(w, soul(2, 'Brann'));
    } catch (err) {
      expect((err as EngineError).code).toBe('HERO_ALIVE');
    }

    const fallen = placeCharacter(w, { ...playerHero(w)!, status: 'fallen' });
    expect(playerHero(fallen)).toBeUndefined();
    const next = commitCharacter(fallen, soul(2, 'Brann'));
    expect(playerHero(next)?.name).toBe('Brann');
  });

  it('ends a hero’s story when they turn outlaw or take a new life, though they stay in the world', () => {
    const w = commitCharacter(world(), soul(1, 'Aria'));
    const outlaw = placeCharacter(w, { ...playerHero(w)!, role: 'outlaw' });
    expect(outlaw.roster).toHaveLength(1);
    expect(playerHero(outlaw)).toBeUndefined();
  });

  it('gives a committed Demon Lord the world, not the player', () => {
    const lord = { ...soul(1, 'Vex'), role: 'demonLord' as const };
    const w = commitCharacter(world(), lord);
    expect(w.heroId).toBeNull();
    expect(playerHero(w)).toBeUndefined();
    expect(w.roster.map((c) => c.name)).toEqual(['Vex']);
  });

  it('picks the newest living hero of an old save as the player’s, and leaves the rest to the world', () => {
    const storage = memoryStorage();
    const older = { ...alive(1), name: 'Older', createdAt: 10 };
    const newer = { ...alive(2), name: 'Newer', createdAt: 20 };
    const { heroId: _heroId, ...v8 } = { ...world(), schemaVersion: 8, roster: [newer, older] };
    storage.setItem('roguelite.world', JSON.stringify(v8));
    const loaded = loadWorld(storage)!;
    expect(loaded.schemaVersion).toBe(9);
    expect(loaded.heroId).toBe(newer.id);
    expect(loaded.roster).toHaveLength(2);
  });

  it('keeps a v9 world between lives that way, even with the world’s own heroes in it', () => {
    const storage = memoryStorage();
    storage.setItem('roguelite.world', JSON.stringify({ ...world(), roster: [alive(1)], heroId: null }));
    expect(loadWorld(storage)!.heroId).toBeNull();
  });
});

describe('Master a Power: a ladder, like Train', () => {
  const caster = (rank: string) => {
    const learned = take(soul(), 'arcane_powers', 'fireball');
    return take(learned, 'power_mastery', rank);
  };

  it('is locked at the crossroads for a hero with no power, or none left to climb', () => {
    expect(slice('crossroads', 'master_power', alive())!.locked).toBe(true);
    expect(slice('crossroads', 'master_power', caster('expert'))!.locked).toBe(false);
    expect(slice('crossroads', 'master_power', caster('transcendent'))!.locked).toBe(true);
  });

  it('deals only the powers they know, plus the source of them all', () => {
    const dealt = slices('master_power', caster('practised')).map((s) => s.option.id);
    expect(dealt).toEqual(['fireball', 'the_source', 'a_power_of_their_own']);
    expect(slice('master_power', 'fireball', caster('practised'))!.option.nextStepId).toBe('master_fireball');
  });

  it('locks every rank at or below the one they hold', () => {
    const ladder = slices('master_fireball', caster('expert'));
    const open = ladder.filter((s) => !s.locked).map((s) => s.option.id);
    expect(open).toEqual(['transcendent', 'paragon', 'virtuoso', 'small_gains']);
    expect(ladder.find((s) => s.option.id === 'expert')!.lockReason).toBe('Already Expert');
  });

  it('sets the new rank from the power’s base, rather than stacking on the old one', () => {
    const base = GAME_CONFIG.traits['fireball']!.power;
    const climbed = take(caster('expert'), 'master_fireball', 'paragon');
    expect(climbed.traits.find((t) => t.id === 'fireball')).toMatchObject({ rank: 'Paragon', power: Math.round(base * 2.5) });
  });

  it('measures a taught power by its power, since it carries no rank from the ladder', () => {
    const base = GAME_CONFIG.traits['fireball']!.power;
    const taught: Character = { ...alive(), traits: [{ ...GAME_CONFIG.traits['fireball']!, power: Math.round(base * 0.75), rank: 'Taught by Old Mira' }] };
    const open = slices('master_fireball', taught).filter((s) => !s.locked).map((s) => s.option.id);
    expect(open).toContain('practised');
    expect(open).not.toContain('novice');
  });
});

describe('gear: a found item is kept only if it beats what they carry', () => {
  const armed = (weaponTier: number): Character => ({ ...alive(), weaponTier });

  it('locks weapons on Find a Weapon that are no better than theirs', () => {
    const open = slices('find_weapon', armed(2)).filter((s) => !s.locked).map((s) => s.option.id);
    expect(open).not.toContain('rusty_blade');
    expect(open).not.toContain('fine_steel');
    expect(open).toContain('heirloom');
  });

  it('replaces their weapon with a better one, never stacks on it', () => {
    expect(take(armed(2), 'find_weapon', 'heirloom').weaponTier).toBe(3);
    expect(take(armed(0), 'find_weapon', 'rusty_blade').weaponTier).toBe(1);
  });

  it('keeps the better blade when treasure turns up a worse one', () => {
    expect(take(armed(4), 'treasure', 'gem_blade').weaponTier).toBe(4);
    expect(take(armed(1), 'treasure', 'gem_blade').weaponTier).toBe(2);
  });

  it('stops sending a hero to look once nothing found could beat their gear', () => {
    expect(slice('crossroads', 'find_weapon', armed(5))!.locked).toBe(true);
    expect(slice('crossroads', 'find_weapon', armed(4))!.locked).toBe(false);
    expect(slice('crossroads', 'find_armor', { ...alive(), armorTier: 5 })!.locked).toBe(true);
  });
});

describe('enemies come back for them', () => {
  it('doubles road ambushes for the hunted, and the Demon Lord’s envoys for the marked', () => {
    const weight = (optionId: string, char: Character) =>
      dealOptions(getStep(GAME_CONFIG, 'road'), char, GAME_CONFIG).find((o) => o.id === optionId)!.baseWeight;
    const plain = alive();
    const hunted = take(plain, 'make_enemy', 'spurned_noble');
    expect(hunted.tags).toContain('hunted');
    expect(weight('bandit_ambush', hunted)).toBe(weight('bandit_ambush', plain) * 2);
    expect(weight('demon_envoy', { ...plain, tags: ['marked'] })).toBe(weight('demon_envoy', plain) * 2);
  });
});
