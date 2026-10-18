import { describe, expect, it } from 'vitest';
import { GAME_CONFIG as SAMPLE_CONFIG } from '../config/gameConfig';
import { LOOT_TABLES } from '../config/gear';
import { GEAR_STEP_ID, SPOILS_STEP_PREFIX, chooseAdventure, completeAdventure, createSpoilsStep, getAdventureStep, rollFullAdventure, spinAdventure, startAdventure, type AdventureState } from './adventure';
import { applyEffects, createCharacter } from './character';
import {
  RARITY_ABILITIES,
  RARITY_POWER,
  chooseGear,
  equip,
  generateGear,
  itemCP,
  offerGear,
  rollLoot,
  settleGearOffers,
  temper,
  uniqueGear,
  uniquesInWorld,
} from './gear';
import { chooseCurrentStep, getStep, rollFullCharacter, spinCurrentStep, startGeneration, type GenerationState } from './generation';
import { loadWorld, type StorageLike } from './persistence';
import { calculatePowerRating } from './power';
import { createSeededRng } from './rng';
import { plainItem } from './testConfig';
import { RARITIES, type Character, type GameConfig, type World } from './types';
import { validateGameConfig } from './validate';
import { createWorld, placeCharacter } from './world';

/** These tests walk single wheels, so a short adventure must end where its wheel says: no road home. */
const GAME_CONFIG: GameConfig = { ...SAMPLE_CONFIG, adventure: { ...SAMPLE_CONFIG.adventure, roadHome: undefined } };
const GEAR = GAME_CONFIG.gear!;

function soul(seed: number, patch: Partial<Character> = {}): Character {
  return { ...createCharacter(GAME_CONFIG, { name: `Soul ${seed}`, rng: createSeededRng(seed), now: 0 }), status: 'alive', ...patch };
}
function worldOf(...chars: Character[]): World {
  return chars.reduce((w, c) => placeCharacter(w, c), createWorld({ rng: createSeededRng(1), now: 0 }));
}
/** Land `hero` on one option of one wheel, as if the wheel had picked it. */
function land(hero: Character, stepId: string, optionId: string, world: World, seed = 2): AdventureState {
  const step = getStep(GAME_CONFIG, stepId);
  const option = step.options.find((o) => o.id === optionId)!;
  const rigged = { ...GAME_CONFIG, steps: { ...GAME_CONFIG.steps, [stepId]: { ...step, options: [option] } } };
  const start: AdventureState = { ...startAdventure(rigged, hero), currentStepId: stepId };
  return spinAdventure(start, rigged, world, createSeededRng(seed)).state;
}

describe('making gear', () => {
  it('makes items within their rarity’s power band, with as many abilities as the rarity gives', () => {
    const rng = createSeededRng(1);
    for (let i = 0; i < 600; i++) {
      const kind = i % 2 ? 'weapon' : 'armor';
      const item = generateGear(GEAR, { kind, power: [1, 10] }, rng);
      const [lo, hi] = RARITY_POWER[item.rarity];
      expect(item.power).toBeGreaterThanOrEqual(lo);
      expect(item.power).toBeLessThanOrEqual(hi);
      expect(item.abilities).toHaveLength(RARITY_ABILITIES[item.rarity]);
      expect(new Set(item.abilities).size).toBe(item.abilities.length);
      expect(GEAR.bases[item.base]?.kind).toBe(kind);
      expect(kind === 'weapon' ? item.damage : item.resists).toBeDefined();
      for (const id of item.abilities) expect(GAME_CONFIG.traits[id]).toBeDefined();
    }
  });

  it('keeps a goblin’s drop goblin-sized, and lets a dragon drop something worth a song', () => {
    const rng = createSeededRng(2);
    const hero = soul(3);
    const goblin = Array.from({ length: 300 }, () => rollLoot(GEAR, LOOT_TABLES.goblins, rng, hero)).flat();
    expect(Math.max(...goblin.filter((r) => !r.item.uniqueId).map((r) => r.item.power))).toBeLessThanOrEqual(3);
    const dragon = Array.from({ length: 300 }, () => rollLoot(GEAR, LOOT_TABLES.dragon, rng, hero)).flat();
    expect(Math.min(...dragon.filter((r) => !r.item.uniqueId).map((r) => r.item.power))).toBeGreaterThanOrEqual(6);
    expect(dragon.some((r) => r.item.uniqueId === 'dragonbone_blade')).toBe(true);
  });

  it('leans rarer for a glorious win', () => {
    const hero = soul(4);
    const rank = (shift: number) => {
      const rng = createSeededRng(5);
      const rolls = Array.from({ length: 400 }, () => rollLoot(GEAR, LOOT_TABLES.troll, rng, hero, { shift })).flat();
      return rolls.reduce((sum, r) => sum + RARITIES.indexOf(r.item.rarity), 0) / rolls.length;
    };
    expect(rank(1)).toBeGreaterThan(rank(0));
  });

  it('never drops a unique someone in the world already has, nor a weapon for an Archmage', () => {
    const holder = equip(soul(6), 'weapon', uniqueGear(GEAR, 'dragonbone_blade'), GAME_CONFIG);
    const claimed = uniquesInWorld(worldOf(holder));
    expect(claimed.has('dragonbone_blade')).toBe(true);
    const rng = createSeededRng(7);
    const drops = Array.from({ length: 300 }, () => rollLoot(GEAR, LOOT_TABLES.dragon, rng, soul(8), { claimed })).flat();
    expect(drops.some((r) => r.item.uniqueId === 'dragonbone_blade')).toBe(false);
    const mage = { ...soul(9), rules: { noWeapon: true } };
    const mageDrops = Array.from({ length: 100 }, () => rollLoot(GEAR, LOOT_TABLES.dragon, rng, mage)).flat();
    expect(mageDrops.every((r) => r.item.kind === 'armor')).toBe(true);
  });

  it('gives every foe a table that validates, and the whole config stays clean', () => {
    expect(validateGameConfig(SAMPLE_CONFIG)).toEqual({ errors: [], warnings: [] });
    const broken = { ...GAME_CONFIG, gear: { ...GEAR, uniques: { ...GEAR.uniques, bad: { ...GEAR.uniques['holy_sword']!, id: 'bad', power: 11, base: 'nope' } } } };
    expect(validateGameConfig(broken).errors).toEqual(['Unique gear "bad": power must be a whole number from 1 to 10.', 'Unique gear "bad": unknown base "nope".']);
  });
});

describe('the Holy Sword, and the other uniques', () => {
  it('is power 10, holy, and gives its bearer the holy_sword trait', () => {
    const blade = uniqueGear(GEAR, 'holy_sword');
    expect(blade).toMatchObject({ power: 10, rarity: 'mythical', damage: 'holy', stat: 'might' });
    const bearer = equip(soul(10), 'weapon', blade, GAME_CONFIG);
    expect(bearer.traits.map((t) => t.id)).toEqual(['holy_sword', 'gear_blessed']);
    expect(bearer.traits.every((t) => t.item === 'weapon')).toBe(true);
    // Put down, its abilities go with it.
    expect(equip(bearer, 'weapon', null, GAME_CONFIG).traits).toEqual([]);
  });

  it('comes from the Talents wheel as the unique itself', () => {
    const option = getStep(GAME_CONFIG, 'talents').options.find((o) => o.id === 'holy_sword')!;
    const chosen = applyEffects(soul(11), option, 'talents', GAME_CONFIG);
    expect(chosen.weapon?.uniqueId).toBe('holy_sword');
    expect(chosen.traits.some((t) => t.id === 'holy_sword')).toBe(true);
  });
});

describe('keep or take', () => {
  it('takes an item into an empty slot at once, and offers it for a filled one', () => {
    const bare = soul(12);
    expect(offerGear(bare, plainItem('weapon', 3), GAME_CONFIG).weapon?.power).toBe(3);
    const armed = soul(13, { weapon: plainItem('weapon', 2) });
    const offered = offerGear(armed, plainItem('weapon', 5), GAME_CONFIG);
    expect(offered.weapon?.power).toBe(2);
    expect(offered.gearOffers?.map((o) => o.power)).toEqual([5]);
  });

  it('keeps or takes as the player says, abilities and all', () => {
    const armed = soul(14, { weapon: plainItem('weapon', 6) });
    const offered = offerGear(armed, uniqueGear(GEAR, 'whispering_blade'), GAME_CONFIG);
    const kept = chooseGear(offered, false, GAME_CONFIG);
    expect(kept.character.weapon?.power).toBe(6);
    expect(kept.character.gearOffers).toBeUndefined();
    expect(kept.note).toBe('Kept Test weapon 6; left The Whispering Blade behind');
    const taken = chooseGear(offered, true, GAME_CONFIG);
    expect(taken.character.weapon?.uniqueId).toBe('whispering_blade');
    expect(taken.character.traits.map((t) => t.id)).toContain('sentient_blade');
    expect(taken.note).toBe('Took The Whispering Blade; left Test weapon 6 behind');
  });

  it('lets a hero left to themselves keep whichever is better', () => {
    const armed = soul(15, { weapon: plainItem('weapon', 6) });
    const worse = settleGearOffers(offerGear(armed, plainItem('weapon', 2), GAME_CONFIG), GAME_CONFIG).character;
    expect(worse.weapon?.power).toBe(6);
    const better = settleGearOffers(offerGear(armed, plainItem('weapon', 8), GAME_CONFIG), GAME_CONFIG).character;
    expect(better.weapon?.power).toBe(8);
    expect(itemCP(plainItem('weapon', 8), armed, GAME_CONFIG)).toBe(200);
  });

  it('stops the adventure on a Keep / Take choice, and goes on where it was going once decided', () => {
    const hero = soul(16, { weapon: plainItem('weapon', 2) });
    const world = worldOf(hero);
    const found = land(hero, 'find_weapon', 'heirloom', world);
    expect(found.currentStepId).toBe(GEAR_STEP_ID);
    expect(found.gearChoice).toEqual({ then: null });
    const step = getAdventureStep(GAME_CONFIG, GEAR_STEP_ID, found);
    expect(step.choice).toBe(true);
    expect(step.options.map((o) => o.id)).toEqual(['keep', 'take']);
    const taken = chooseAdventure(found, GAME_CONFIG, world, 'take').state;
    expect(taken.character.weapon?.power).toBe(3);
    expect(taken.currentStepId).toBeNull();
    expect(taken.rolls.at(-1)).toMatchObject({ stepId: GEAR_STEP_ID, optionId: 'take', chosen: true });
    // An autoplay picks the better one.
    expect(spinAdventure(found, GAME_CONFIG, world, createSeededRng(3)).state.character.weapon?.power).toBe(3);
  });
});

describe('tempering', () => {
  it('raises what they carry up to 10, breaks it at 0, and arms empty hands', () => {
    const armed = soul(17, { weapon: plainItem('weapon', 8) });
    expect(temper(armed, 'weapon', 5, GAME_CONFIG).weapon).toMatchObject({ power: 10, tempered: 2 });
    expect(temper(armed, 'weapon', -8, GAME_CONFIG).weapon).toBeNull();
    const made = temper(soul(18), 'weapon', 2, GAME_CONFIG).weapon!;
    expect(made).toMatchObject({ power: 2, rarity: 'common' });
    // The same soul, the same rolls: the same blade.
    expect(temper(soul(18), 'weapon', 2, GAME_CONFIG).weapon).toEqual(made);
  });

  it('keeps an Archmage empty-handed', () => {
    const mage = soul(19, { rules: { noWeapon: true } });
    expect(temper(mage, 'weapon', 3, GAME_CONFIG).weapon).toBeNull();
    expect(offerGear(mage, plainItem('weapon', 9), GAME_CONFIG).weapon).toBeNull();
  });
});

describe('the Spoils wheel', () => {
  const fighter = (seed: number) => soul(seed, { stats: { might: 30, agility: 30, intellect: 10, arcana: 10, vitality: 30 } });

  it('follows a fight won, drawn from the foe’s loot table, and goes on to where the fight led', () => {
    const hero = fighter(20);
    const world = worldOf(hero);
    const won = land(hero, 'fight_troll', 'victory', world);
    expect(won.currentStepId).toBe(`${SPOILS_STEP_PREFIX}fight_troll`);
    expect(won.spoils?.foe).toBe('Bridge Troll');
    const step = getAdventureStep(GAME_CONFIG, won.currentStepId!, won);
    expect(step.options.at(-1)?.id).toBe('nothing');
    expect(step.options.length).toBeGreaterThan(1);
    const after = spinAdventure(won, GAME_CONFIG, world, createSeededRng(4)).state;
    expect(after.spoils).toBeNull();
    expect([null, GEAR_STEP_ID]).toContain(after.currentStepId);
  });

  it('never follows a retreat', () => {
    const hero = fighter(21);
    const lost = land(hero, 'fight_troll', 'retreat', worldOf(hero));
    expect(lost.spoils ?? null).toBeNull();
    expect(lost.currentStepId?.startsWith(SPOILS_STEP_PREFIX) ?? false).toBe(false);
  });

  it('makes its items before it is spun, and no archetype reshapes it (a Wise hero spins it once)', () => {
    const hero = { ...fighter(22), rules: { rollTwice: true } };
    const world = worldOf(hero);
    const won = land(hero, 'fight_troll', 'victory', world);
    const outcome = spinAdventure(won, GAME_CONFIG, world, createSeededRng(6));
    expect(outcome.alt).toBeUndefined();
    expect(outcome.step.fixed).toBe(true);
    expect(outcome.step.options.map((o) => o.id)).toEqual(createSpoilsStep(GAME_CONFIG, won.spoils).options.map((o) => o.id));
  });

  it('drops what a foe from the world carried, but never the Holy Sword', () => {
    const hero = fighter(23);
    const outlaw = equip(soul(24, { role: 'outlaw', armor: plainItem('armor', 4) }), 'weapon', uniqueGear(GEAR, 'holy_sword'), GAME_CONFIG);
    const world = worldOf(hero, outlaw);
    const step = getStep(GAME_CONFIG, 'fight_outlaw');
    const option = step.options.find((o) => o.id === 'victory')!;
    const rigged = { ...GAME_CONFIG, steps: { ...GAME_CONFIG.steps, fight_outlaw: { ...step, options: [option] } } };
    const start: AdventureState = { ...startAdventure(rigged, hero), currentStepId: 'fight_outlaw', cast: { stepId: 'fight_outlaw', character: outlaw } };
    const won = spinAdventure(start, rigged, world, createSeededRng(7)).state;
    if (won.spoils) {
      expect(won.spoils.items.some((i) => i.item.uniqueId === 'holy_sword')).toBe(false);
    }
    // Over many lives, no one but its bearer ever holds it.
    const rng = createSeededRng(8);
    for (let i = 0; i < 200; i++) {
      const { state } = rollFullAdventure(GAME_CONFIG, world, hero, rng);
      expect(state.character.weapon?.uniqueId === 'holy_sword').toBe(false);
      completeAdventure(world, state, 1);
    }
  });

  it('pays off: a hero who fights a lot ends up better armed', () => {
    const hero = fighter(25);
    const world = worldOf(hero);
    const rng = createSeededRng(9);
    let found = 0;
    for (let i = 0; i < 300; i++) {
      const { state } = rollFullAdventure(GAME_CONFIG, world, hero, rng);
      if (state.rolls.some((r) => r.stepId.startsWith(SPOILS_STEP_PREFIX) && r.optionId !== 'nothing')) found++;
    }
    expect(found).toBeGreaterThan(10);
  });
});

describe('old saves', () => {
  const memoryStorage = (): StorageLike => {
    const m = new Map<string, string>();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
  };

  it('turns a v9 hero’s tiers and the Holy Sword trait into items, the same way every time', () => {
    const { weapon: _w, armor: _a, ...base } = soul(26);
    const v9Hero = { ...base, weaponTier: 4, armorTier: 3, traits: [GAME_CONFIG.traits['holy_sword']!, GAME_CONFIG.traits['skill_tracking']!] };
    const v9 = { ...createWorld({ rng: createSeededRng(1), now: 0 }), schemaVersion: 9, roster: [v9Hero] };
    const storage = memoryStorage();
    storage.setItem('roguelite.world', JSON.stringify(v9));
    const hero = loadWorld(storage, GAME_CONFIG)!.roster[0]!;
    expect(hero).not.toHaveProperty('weaponTier');
    expect(hero.weapon).toMatchObject({ uniqueId: 'holy_sword', power: 4 });
    expect(hero.armor).toMatchObject({ power: 3 });
    expect(hero.traits.map((t) => t.id)).toEqual(['skill_tracking', 'holy_sword', 'gear_blessed']);
    expect(loadWorld(storage, GAME_CONFIG)!.roster[0]).toEqual(hero);
    expect(calculatePowerRating(hero)).toBeGreaterThan(0);
  });
});

describe('better steel: found, not tempered, unless a smith is at work', () => {
  const opt = (patch: object) => ({ id: 'x', label: 'X', baseWeight: 1, nextStepId: null, ...patch });
  it('a tier gain finds a random item that much stronger, offered as Keep or Take', () => {
    const hero = soul(3, { weapon: plainItem('weapon', 4) });
    const after = applyEffects(hero, opt({ weaponTierDelta: 2 }), 'x', GAME_CONFIG);
    expect(after.weapon?.power).toBe(4); // what they carry is untouched
    expect(after.gearOffers?.[0]).toMatchObject({ kind: 'weapon', power: 6 });
  });
  it('empty hands just take it', () => {
    const after = applyEffects(soul(3), opt({ armorTierDelta: 1 }), 'x', GAME_CONFIG);
    expect(after.armor?.power).toBe(1);
    expect(after.gearOffers ?? []).toHaveLength(0);
  });
  it('a smith (an upgrade) tempers what they carry, and a loss still wears it down', () => {
    const hero = soul(3, { weapon: plainItem('weapon', 4) });
    expect(applyEffects(hero, opt({ weaponTierDelta: 2, upgrade: true }), 'x', GAME_CONFIG).weapon).toMatchObject({ power: 6, tempered: 2 });
    expect(applyEffects(hero, opt({ weaponTierDelta: -1 }), 'x', GAME_CONFIG).weapon?.power).toBe(3);
  });
});

describe('Keep or Take in creation, as on the road', () => {
  const w = createWorld({ rng: createSeededRng(1), now: 0 });
  it('stops for the choice when a find meets a filled slot, then goes on where it was going', () => {
    let found: GenerationState | null = null;
    for (let seed = 1; seed < 400 && !found; seed++) {
      const rng = createSeededRng(seed);
      let state = startGeneration(GAME_CONFIG, { rng, now: 0 });
      while (state.currentStepId !== null && state.currentStepId !== GEAR_STEP_ID) state = spinCurrentStep(state, GAME_CONFIG, w, rng).state;
      if (state.currentStepId === GEAR_STEP_ID) found = state;
    }
    expect(found).not.toBeNull();
    const keep = chooseCurrentStep(found!, GAME_CONFIG, w, 'keep').state;
    const take = chooseCurrentStep(found!, GAME_CONFIG, w, 'take').state;
    const offer = found!.character.gearOffers![0]!;
    expect(take.character[offer.kind]?.id).toBe(offer.id);
    expect(keep.character[offer.kind]?.id).not.toBe(offer.id);
    expect(keep.currentStepId).not.toBe(GEAR_STEP_ID);
  });
  it('left to themselves, every soul still finishes', () => {
    for (let seed = 1; seed < 60; seed++) expect(rollFullCharacter(GAME_CONFIG, w, createSeededRng(seed)).character.gearOffers ?? []).toHaveLength(0);
  });
});
