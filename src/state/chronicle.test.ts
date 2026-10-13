import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../config/gameConfig';
import { rollFullAdventure, completeAdventure } from '../engine/adventure';
import { createCharacter } from '../engine/character';
import { createSeededRng } from '../engine/rng';
import type { AdventureRecord, Character, World } from '../engine/types';
import { commitCharacter, createWorld, placeCharacter, playerHero } from '../engine/world';
import { backfillChronicle, chronicleAdventure, chronicleArrival, seasonLabel, threatLine } from './chronicle';

const world = (): World => createWorld({ rng: createSeededRng(1), now: 0 });
const soul = (name: string, seed = 1): Character => ({
  ...createCharacter(GAME_CONFIG, { name, rng: createSeededRng(seed), now: seed }),
  race: 'dwarf',
});
const trip = (outcome: AdventureRecord['outcome'] = 'returned'): AdventureRecord => ({ rolls: [{ stepId: 'crossroads', optionId: 'go_adventure', probability: 0.2 }], outcome });

describe('the chronicle', () => {
  it('counts seasons into years', () => {
    expect(seasonLabel(0).label).toBe('Year 1, Spring');
    expect(seasonLabel(7).label).toBe('Year 2, Winter');
  });

  it('writes an arrival when a soul is committed', () => {
    const hero = soul('Brann');
    const w = chronicleArrival(commitCharacter(world(), hero), hero, GAME_CONFIG);
    expect(w.chronicle).toEqual([{ kind: 'arrival', who: hero.id, season: 0, text: 'Brann, dwarf hero, set out into the world.' }]);
  });

  it('passes a season per adventure, and writes what it changed', () => {
    const hero = soul('Brann');
    const before = commitCharacter(world(), hero);
    const changed: Character = {
      ...playerHero(before)!,
      fame: 20,
      title: 'the Bold',
      status: 'fallen',
      adventures: [trip('fallen')],
      fate: { at: 0, summary: 'Held the pass alone so the others could escape' },
    };
    const after = chronicleAdventure(before, { ...placeCharacter(before, changed), threatLevel: 3 }, hero.id, GAME_CONFIG);
    expect(after.season).toBe(1);
    expect(after.chronicle.map((e) => [e.season, e.kind, e.text])).toEqual([
      [0, 'deed', 'Brann became known as Brann the Bold.'],
      [0, 'deed', `Brann is Renowned now. ${GAME_CONFIG.fame.tiers.find((t) => t.name === 'Renowned')!.description}`],
      [0, 'world', 'The world grew darker: dangerous now (threat 3.0).'],
      [0, 'ending', 'Brann held the pass alone so the others could escape.'],
    ]);
  });

  it('leaves a quiet season unwritten, but still counts it', () => {
    const hero = soul('Brann');
    const before = commitCharacter(world(), hero);
    const after = chronicleAdventure(before, placeCharacter(before, { ...playerHero(before)!, adventures: [trip()] }), hero.id, GAME_CONFIG);
    expect(after.season).toBe(1);
    expect(after.chronicle).toEqual([]);
  });

  it('only notes threat when the world’s mood changes', () => {
    expect(threatLine(1.5, 2.5)).toBeNull();
    expect(threatLine(5.5, 4.5)?.text).toBe('The world grew calmer: dangerous now (threat 4.5).');
  });

  it('writes an old world’s history once, a life at a time', () => {
    const first = { ...soul('Aria', 1), status: 'fallen' as const, adventures: [trip(), trip('fallen')], fate: { at: 0, summary: 'Fell on adventure 2' } };
    const second = { ...soul('Brann', 2), status: 'alive' as const, adventures: [trip()] };
    const old: World = { ...world(), roster: [second], graveyard: [first], heroId: second.id };
    const written = backfillChronicle(old, GAME_CONFIG);
    expect(written.season).toBe(3);
    expect(written.chronicle.map((e) => [e.season, e.kind])).toEqual([
      [0, 'arrival'],
      [1, 'ending'],
      [2, 'arrival'],
    ]);
    expect(backfillChronicle(written, GAME_CONFIG)).toBe(written);
  });

  it('keeps writing through whole lives without losing a season', () => {
    const rng = createSeededRng(9);
    const hero = soul('Brann');
    let w = chronicleArrival(commitCharacter(world(), hero), hero, GAME_CONFIG);
    let n = 0;
    while (playerHero(w) && n < 30) {
      const { state } = rollFullAdventure(GAME_CONFIG, w, playerHero(w)!, rng);
      w = chronicleAdventure(w, completeAdventure(w, state), hero.id, GAME_CONFIG);
      n++;
    }
    expect(w.season).toBe(n);
    expect(w.chronicle.every((e) => e.season < n)).toBe(true);
  });
});
