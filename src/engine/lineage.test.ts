import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../config/gameConfig';
import { createCharacter, nameCharacter } from './character';
import { getStep } from './generation';
import { HEIR_FAME_CAP, asHeir, canNameHeir, heirOf, houseOf, housesOf } from './lineage';
import { dealOptions } from './odds';
import { createSeededRng } from './rng';
import { resolveSlices } from './roll';
import type { Character, World } from './types';
import { createWorld } from './world';

const world = (): World => createWorld({ rng: createSeededRng(1), now: 0 });
const soul = (name = '', seed = 1): Character => createCharacter(GAME_CONFIG, { name, rng: createSeededRng(seed), now: seed });

const founder = (): Character => ({
  ...soul('Grukk', 1),
  race: 'orc',
  status: 'retired',
  fame: 45,
  stats: { might: 18, agility: 11, intellect: 9, arcana: 7, vitality: 14 },
  history: [{ stepId: 'ancestry', optionId: 'orc', probability: 0.14 }],
  adventures: [{ rolls: [], outcome: 'retired' }],
});

describe('dynasties', () => {
  it('names a house after a family name, or the founder’s own name', () => {
    expect(houseOf({ ...soul('Pip Fairbairn') })).toBe('Fairbairn');
    expect(houseOf(founder())).toBe('Grukk');
  });

  it('lets a hero with a name worth inheriting have one heir, once their story is over', () => {
    const w: World = { ...world(), hallOfFame: [founder()] };
    expect(canNameHeir(w, founder())).toBe(true);
    expect(canNameHeir(w, { ...founder(), fame: 2 })).toBe(false);
    expect(canNameHeir(w, { ...founder(), status: 'alive', role: 'hero' })).toBe(false);
    expect(canNameHeir(w, { ...founder(), status: 'alive', role: 'outlaw' })).toBe(false);
    const heir = asHeir(soul('', 2), founder());
    expect(canNameHeir({ ...w, roster: [heir] }, founder())).toBe(false);
  });

  it('gives an heir the house, a banked point in their parent’s best stat, and a little fame', () => {
    const heir = asHeir(soul('', 2), founder());
    expect(heir.lineage).toEqual({ house: 'Grukk', generation: 2, parentId: founder().id, ancestry: 'orc' });
    expect(heir.statBonus.might).toBe(1);
    expect(heir.fame).toBe(5);
    expect(asHeir(soul('', 2), { ...founder(), fame: 400 }).fame).toBe(HEIR_FAME_CAP);
  });

  it('names an heir for their house, whatever the wheels say', () => {
    const heir = { ...asHeir(soul('', 2), founder()), race: 'orc' };
    expect(nameCharacter(GAME_CONFIG, heir, createSeededRng(4)).name).toMatch(/ Grukk$/);
  });

  it('leans the Wheel of Ancestry hard toward the parent’s', () => {
    const chance = (c: Character) =>
      resolveSlices(dealOptions(getStep(GAME_CONFIG, 'ancestry'), c, GAME_CONFIG), world(), c).find((s) => s.option.id === 'orc')!.probability;
    const heir = asHeir(soul('', 2), founder());
    expect(chance(heir)).toBeGreaterThan(0.6);
    expect(chance(soul('', 2))).toBeLessThan(0.2);
  });

  it('traces a house from founder through every generation', () => {
    const second = { ...asHeir(soul('Tamsin Grukk', 2), founder()), status: 'fallen' as const, fame: 30 };
    const third = asHeir(soul('Ulla Grukk', 3), second);
    const w: World = { ...world(), hallOfFame: [founder()], graveyard: [second], roster: [third] };
    expect(heirOf(w, founder())?.name).toBe('Tamsin Grukk');
    expect(housesOf(w)).toEqual([{ name: 'Grukk', members: [founder(), second, third] }]);
    expect(third.lineage!.generation).toBe(3);
  });
});
