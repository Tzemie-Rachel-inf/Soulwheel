import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../config/gameConfig';
import { createCharacter } from '../engine/character';
import { rollFullCharacter } from '../engine/generation';
import { createSeededRng, seededFrom } from '../engine/rng';
import type { AdventureRecord, Character, World } from '../engine/types';
import { createWorld } from '../engine/world';
import { FEATS, featContext, newAncestries, newlyEarned } from './achievements';
import { dailySeed, dailyShareText, today, type Profile } from './profile';

const world = (): World => createWorld({ rng: createSeededRng(1), now: 0 });
const blank: Profile = { version: 1, dailies: [], achievements: {}, ancestries: [] };
const soul = (name: string, seed: number): Character => createCharacter(GAME_CONFIG, { name, rng: createSeededRng(seed), now: seed });
const trip = (outcome: AdventureRecord['outcome'] = 'returned'): AdventureRecord => ({ rolls: [{ stepId: 'crossroads', optionId: 'go_adventure', probability: 0.2 }], outcome });

describe('seeds', () => {
  it('rolls the same soul from the same seed, and another from another', () => {
    const roll = (seed: string) => rollFullCharacter(GAME_CONFIG, world(), seededFrom(seed), { now: 0 }).character;
    const a = roll(dailySeed('2026-10-12'));
    const b = roll(dailySeed('2026-10-12'));
    expect(b.history.map((r) => r.optionId)).toEqual(a.history.map((r) => r.optionId));
    expect(b.name).toBe(a.name);
    expect(roll(dailySeed('2026-10-13')).history.map((r) => r.optionId)).not.toEqual(a.history.map((r) => r.optionId));
  });

  it('counts days by the local calendar', () => {
    expect(today(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('writes a daily run as a line to share', () => {
    expect(dailyShareText({ date: '2026-10-12', characterId: 'c', name: 'Kava', adventures: 7, fame: 18, tier: 'Renowned', end: 'Fell to the Enemy Host on their 7th adventure' })).toBe(
      'Soulwheel Daily Soul, 2026-10-12: Kava, 7 adventures, Renowned (18 fame). Fell to the Enemy Host on their 7th adventure.',
    );
  });
});

describe('feats', () => {
  it('has a unique id for every feat', () => {
    expect(new Set(FEATS.map((f) => f.id)).size).toBe(FEATS.length);
  });

  it('earns feats from what the world remembers, naming who earned them', () => {
    const martyr: Character = { ...soul('Aria', 1), status: 'fallen', tags: ['martyr'], adventures: [trip('fallen')] };
    const w: World = { ...world(), graveyard: [martyr] };
    const earned = Object.fromEntries(newlyEarned(featContext(w, GAME_CONFIG, blank)).map(({ feat, by }) => [feat.id, by]));
    expect(earned).toMatchObject({ six_feet_under: 'Aria', short_road: 'Aria', greater_love: 'Aria' });
    expect(earned).not.toHaveProperty('first_steps');
  });

  it('earns nothing for the world’s own rivals', () => {
    const rival: Character = { ...soul('Erevan', 3), status: 'fallen', worldBorn: true, adventures: [trip('fallen')] };
    const w: World = { ...world(), graveyard: [rival] };
    expect(newlyEarned(featContext(w, GAME_CONFIG, blank))).toEqual([]);
  });

  it('never earns a feat twice', () => {
    const w: World = { ...world(), graveyard: [{ ...soul('Aria', 1), status: 'fallen', adventures: [trip('fallen')] }] };
    const profile: Profile = { ...blank, achievements: { six_feet_under: { at: 1, by: 'Someone' } } };
    expect(newlyEarned(featContext(w, GAME_CONFIG, profile)).map(({ feat }) => feat.id)).not.toContain('six_feet_under');
  });

  it('collects ancestries across worlds toward Every Kind of Soul', () => {
    const elf: Character = { ...soul('Ilya', 2), history: [{ stepId: 'ancestry', optionId: 'elf', probability: 0.13 }] };
    const w: World = { ...world(), roster: [elf] };
    expect(newAncestries(w, blank)).toEqual(['elf']);
    expect(newAncestries(w, { ...blank, ancestries: ['elf'] })).toEqual([]);
    const every = FEATS.find((f) => f.id === 'every_kind')!;
    const [have, need] = every.progress!(featContext(w, GAME_CONFIG, { ...blank, ancestries: ['elf', 'human'] }));
    expect(have).toBe(2);
    expect(need).toBe(GAME_CONFIG.steps['ancestry']!.options.length);
  });
});
