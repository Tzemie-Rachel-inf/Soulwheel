import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../config/gameConfig';
import { completeAdventure, rollFullAdventure } from '../engine/adventure';
import { createCharacter } from '../engine/character';
import { rollFullCharacter } from '../engine/generation';
import { createSeededRng, type Rng } from '../engine/rng';
import { computeEffectiveWeight } from '../engine/roll';
import { getStep } from '../engine/generation';
import type { Character, GameConfig, World } from '../engine/types';
import { commitCharacter, createWorld, playerHero } from '../engine/world';
import { chronicleAdventure } from './chronicle';
import { MAX_WORLD_HEROES, worldHeroes, worldTurn } from './worldTurn';

const world = (): World => createWorld({ rng: createSeededRng(1), now: 0 });
/** A config whose world always does something, and always the given event. */
const only = (id: string): GameConfig => ({ ...GAME_CONFIG, worldEvents: GAME_CONFIG.worldEvents!.filter((e) => e.id === id) });
const always: Rng = () => 0;

function withHero(seed = 1): World {
  const hero: Character = { ...createCharacter(GAME_CONFIG, { name: 'Aria', rng: createSeededRng(seed), now: 0 }), race: 'human' };
  return commitCharacter(world(), hero);
}

describe('the world’s own turn', () => {
  it('leaves an omen that bends the wheels, then fades', () => {
    const w = worldTurn({ ...withHero(), season: 4 }, only('plague'), undefined, always);
    expect(w.omens).toEqual([expect.objectContaining({ id: 'plague', until: 7 })]);
    expect(w.chronicle.find((e) => e.kind === 'world')).toMatchObject({ season: 4, tone: 'ember', text: expect.stringMatching(/plague/) });

    const disaster = getStep(GAME_CONFIG, 'crossroads').options.find((o) => o.id === 'disaster')!;
    expect(computeEffectiveWeight(disaster, w)).toBeCloseTo(computeEffectiveWeight(disaster, { ...w, omens: [] }) * 2);
    expect(computeEffectiveWeight(disaster, { ...w, season: 7 })).toBeCloseTo(computeEffectiveWeight(disaster, { ...w, omens: [] }));

    const later = worldTurn({ ...w, season: 7 }, { ...GAME_CONFIG, worldEvents: [] }, undefined, always);
    expect(later.omens).toEqual([]);
  });

  it('moves threat, within its bounds', () => {
    expect(worldTurn({ ...withHero(), threatLevel: 9.5 }, only('restless_dead'), undefined, always).threatLevel).toBe(10);
  });

  it('only marches the Demon Lord when one reigns', () => {
    const w = worldTurn(withHero(), only('demon_march'), undefined, always);
    expect(w.omens).toEqual([]);
    expect(w.chronicle).toEqual([]);
  });

  it('sends out a rival the moment the player makes a jealous one', () => {
    const before = withHero();
    const hero = playerHero(before)!;
    const after = { ...before, roster: before.roster.map((c) => (c.id === hero.id ? { ...c, tags: [...c.tags, 'rival'] } : c)) };
    const w = worldTurn(after, { ...GAME_CONFIG, worldEvents: [] }, hero, createSeededRng(5));
    const rivals = worldHeroes(w);
    expect(rivals.length).toBeLessThanOrEqual(1);
    const line = w.chronicle.find((e) => e.kind === 'rival' || e.kind === 'world');
    expect(line?.text).toMatch(rivals.length ? /sworn to outdo Aria/ : /./);
  });

  it('lives whole seasons for the world’s heroes, and never touches the player’s', () => {
    const rng = createSeededRng(11);
    let w = withHero();
    const hero = playerHero(w)!;
    // Three heroes of the world's own.
    for (let i = 0; worldHeroes(w).length < 3 && i < 30; i++) {
      const { character } = rollFullCharacter(GAME_CONFIG, w, rng);
      if (character.role === 'hero') w = { ...w, roster: [...w.roster, { ...character, status: 'alive' }] };
    }
    const seasons = 6;
    for (let s = 0; s < seasons; s++) w = worldTurn({ ...w, season: w.season + 1 }, GAME_CONFIG, playerHero(w), rng);
    expect(playerHero(w)).toEqual(hero);
    const theirs = [...w.roster, ...w.graveyard, ...w.hallOfFame].filter((c) => c.id !== hero.id && c.role !== 'demonLord');
    expect(theirs.some((c) => c.adventures.length > 0)).toBe(true);
    expect(worldHeroes(w).length).toBeLessThanOrEqual(MAX_WORLD_HEROES);
  });

  it('keeps turning through long lives without breaking', () => {
    for (const seed of [1, 2, 3]) {
      const rng = createSeededRng(seed * 101);
      let w = world();
      for (let life = 0; life < 4; life++) {
        let soul: Character | null = null;
        while (!soul) {
          const { character } = rollFullCharacter(GAME_CONFIG, w, rng);
          if (character.role === 'hero') soul = character;
        }
        w = commitCharacter(w, soul);
        for (let n = 0; playerHero(w) && n < 25; n++) {
          const before = playerHero(w)!;
          const { state } = rollFullAdventure(GAME_CONFIG, w, before, rng);
          w = worldTurn(chronicleAdventure(w, completeAdventure(w, state), before.id, GAME_CONFIG), GAME_CONFIG, before, rng);
        }
      }
      expect(w.season).toBeGreaterThan(4);
      expect(w.chronicle.every((e, i, all) => i === 0 || e.season >= all[i - 1]!.season)).toBe(true);
      expect(worldHeroes(w).length).toBeLessThanOrEqual(MAX_WORLD_HEROES);
    }
  });
});
