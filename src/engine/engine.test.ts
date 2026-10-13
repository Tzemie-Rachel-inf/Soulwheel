import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../config/gameConfig';
import { MIN_POSITIONS, STATS_START, profileRace } from '../config/stats';
import {
  EngineError,
  isSingletonClaimed,
  releaseSingletons,
  applyOption,
  completeAdventure,
  fameEarned,
  fameStanding,
  fameTier,
  rollFullAdventure,
  spinAdventure,
  startAdventure,
  calculatePowerRating,
  calculateWinProbability,
  canAdventure,
  dealOptions,
  fightOdds,
  resolveNextStep,
  commitCharacter,
  createCharacter,
  createSeededRng,
  createWorld,
  getPowerBreakdown,
  getStep,
  loadWorld,
  nameCharacter,
  resolveSlices,
  rollFullCharacter,
  rollWeightedOption,
  saveWorld,
  validateGameConfig,
  type AdventureState,
  type Character,
  type GameConfig,
  type Rarity,
  type Rng,
  type StatKey,
  type StorageLike,
  type WheelOption,
  type World,
} from './index';
import { bumpLadder, spinCurrentStep, type GenerationState } from './index';
import * as E from './index';

// ─── helpers ────────────────────────────────────────────────────────────────

const fate = getStep(GAME_CONFIG, 'fate');
const talents = getStep(GAME_CONFIG, 'talents');
const abyssal = getStep(GAME_CONFIG, 'abyssal');

const freshWorld = (seed = 1): World => createWorld({ rng: createSeededRng(seed), now: 0 });
const freshChar = (seed = 2): Character => createCharacter(GAME_CONFIG, { rng: createSeededRng(seed), now: 0 });

function expectEngineError(fn: () => unknown, code: EngineError['code']): void {
  let caught: unknown;
  try {
    fn();
  } catch (err) {
    caught = err;
  }
  expect(caught instanceof EngineError).toBe(true);
  expect((caught as EngineError).code).toBe(code);
}

/** Roll characters until one satisfies `predicate` (without committing any). */
function rollUntil(world: World, rng: Rng, predicate: (c: Character) => boolean): Character {
  for (let i = 0; i < 2000; i++) {
    const { character } = rollFullCharacter(GAME_CONFIG, world, rng, { now: 0 });
    if (predicate(character)) return character;
  }
  throw new Error('rollUntil: predicate never satisfied');
}

/** Put n fake corpses in the graveyard. */
function withGraveyard(world: World, n: number): World {
  return { ...world, graveyard: Array.from({ length: n }, (_, i) => ({ ...freshChar(100 + i), status: 'fallen' as const })) };
}

// ─── config ─────────────────────────────────────────────────────────────────

describe('validateGameConfig', () => {
  it('passes the sample config with no errors or warnings', () => {
    const report = validateGameConfig(GAME_CONFIG);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it('catches a broken nextStepId, an unknown trait and a negative weight', () => {
    const broken = {
      ...GAME_CONFIG,
      steps: {
        ...GAME_CONFIG.steps,
        // A wheel no race's odds point into, so only the three planted mistakes show.
        ruins: {
          ...getStep(GAME_CONFIG, 'ruins'),
          options: [{ id: 'oops', label: 'Oops', baseWeight: -1, grantTraits: ['nope'], nextStepId: 'nowhere' }],
        },
      },
    };
    const { errors } = validateGameConfig(broken);
    expect(errors).toHaveLength(3);
  });
});

// ─── rollWeightedOption ─────────────────────────────────────────────────────

describe('rollWeightedOption', () => {
  it('matches the configured odds over many seeded draws', () => {
    const world = freshWorld();
    const char = freshChar();
    const rng = createSeededRng(42);
    const N = 40_000;
    const counts = new Map<string, number>();
    for (let i = 0; i < N; i++) {
      const id = rollWeightedOption(fate.options, world, char, rng).winner.option.id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const slice of resolveSlices(fate.options, world, char)) {
      expect((counts.get(slice.option.id) ?? 0) / N).toBeCloseTo(slice.probability, 2);
    }
  });

  it('never picks a locked slice, but still returns it for rendering', () => {
    let world = freshWorld();
    const rng = createSeededRng(7);
    const lord = rollUntil(world, rng, (c) => c.role === 'demonLord');
    world = commitCharacter(world, lord);

    const char = freshChar();
    for (let i = 0; i < 5_000; i++) {
      const { winner, slices } = rollWeightedOption(fate.options, world, char, rng);
      expect(winner.option.id === 'demon_lord').toBe(false);
      expect(slices).toHaveLength(fate.options.length);
    }

    const lordSlice = resolveSlices(fate.options, world, char).find((s) => s.option.id === 'demon_lord');
    expect(lordSlice?.locked).toBe(true);
    expect(lordSlice?.effectiveWeight).toBe(0);
    expect(lordSlice?.probability).toBe(0);
    expect(lordSlice?.lockReason).toBe('A Demon Lord already reigns over this world');
  });

  it('reports winner.index as the position on the wheel', () => {
    const { winner } = rollWeightedOption(fate.options, freshWorld(), freshChar(), () => 0.999999);
    expect(winner.index).toBe(fate.options.length - 1);
    expect(fate.options[winner.index]?.id).toBe(winner.option.id);
  });

  it('skips a locked slice even when the draw lands where it would sit', () => {
    // b sits between a and c with a huge base weight, but it's locked, so the draw
    // is split 50/50 between a and c only.
    const opts: WheelOption[] = [
      { id: 'a', label: 'A', baseWeight: 1, nextStepId: null },
      { id: 'b', label: 'B', baseWeight: 1000, nextStepId: null, condition: () => false },
      { id: 'c', label: 'C', baseWeight: 1, nextStepId: null },
    ];
    expect(rollWeightedOption(opts, freshWorld(), freshChar(), () => 0.49).winner.option.id).toBe('a');
    expect(rollWeightedOption(opts, freshWorld(), freshChar(), () => 0.51).winner.option.id).toBe('c');
  });

  it('throws NO_ELIGIBLE_OPTIONS when every slice is locked', () => {
    const allLocked: WheelOption[] = [
      { id: 'x', label: 'X', baseWeight: 1, nextStepId: null, condition: () => false },
      { id: 'y', label: 'Y', baseWeight: 0, nextStepId: null },
    ];
    expectEngineError(() => rollWeightedOption(allLocked, freshWorld(), freshChar()), 'NO_ELIGIBLE_OPTIONS');
  });

  it('lets threatLevel bend the odds', () => {
    const calm = freshWorld();
    const dark = { ...calm, threatLevel: 4 };
    const p = (world: World, id: string) =>
      resolveSlices(fate.options, world, freshChar()).find((s) => s.option.id === id)?.probability ?? 0;
    expect(p(dark, 'cursed')).toBeGreaterThan(p(calm, 'cursed'));
    expect(p(dark, 'blessed')).toBeLessThan(p(calm, 'blessed'));
  });

  it('explains locks with dynamic reasons', () => {
    const world = withGraveyard(freshWorld(), 1);
    const slices = resolveSlices(talents.options, world, freshChar());
    const reason = (id: string) => slices.find((s) => s.option.id === id)?.lockReason;
    expect(reason('arcane_savant')).toBe('Requires 12 Arcana (you have 10)');
    expect(reason('echoes')).toBe('Requires 3 souls in the graveyard (1/3)');
    expect(reason('holy_sword')).toBe('The Holy Sword sleeps until a Demon Lord rises');
    expect(reason('archmage')).toBe('Requires 13 Arcana (you have 10)');
    expect(reason('runesmith')).toBe('Only dwarves are taught the runes');
    expect(reason('blademaster')).toBeNull();
  });

  it('unlocks world-gated slices once the world changes', () => {
    const slices = resolveSlices(abyssal.options, withGraveyard(freshWorld(), 5), freshChar());
    expect(slices.find((s) => s.option.id === 'lich_king')?.locked).toBe(false);
  });
});

// ─── calculatePowerRating ───────────────────────────────────────────────────

describe('calculatePowerRating', () => {
  it('follows CP = stats + weaponTier × 25 + armorTier × 20 + traits', () => {
    const char: Character = {
      ...freshChar(),
      weaponTier: 3,
      traits: [
        { id: 'a', name: 'A', description: '', power: 40 },
        { id: 'b', name: 'B', description: '', power: -10 },
      ],
    };
    expect(getPowerBreakdown(char)).toEqual({ stats: 50, weapon: 75, weaponScale: 1, armor: 0, armorScale: 1, traits: 30, multiplier: 1, total: 155 });
    expect(calculatePowerRating(char)).toBe(155);
    expect(calculatePowerRating({ ...char, armorTier: 2 })).toBe(195);
  });

  it('scales armour with Vitality, as a weapon scales with Might or Agility', () => {
    const base = freshChar();
    const tough: Character = { ...base, armorTier: 4, stats: { ...base.stats, vitality: 20 } };
    expect(getPowerBreakdown(tough)).toMatchObject({ armor: 120, armorScale: 1.5 }); // 4 × 20 × (1 + 0.05 × 10)
    const frail: Character = { ...base, armorTier: 4, stats: { ...base.stats, vitality: 0 } };
    expect(getPowerBreakdown(frail).armor).toBe(40); // never under ×0.5
  });

  it('multiplies everything by trait multipliers, a god of Space ×10', () => {
    const char: Character = {
      ...freshChar(),
      traits: [
        { id: 'a', name: 'A', description: '', power: 50 },
        { id: 'space', name: 'Cosmic Scale', description: '', power: 0, multiplier: 10 },
      ],
    };
    expect(getPowerBreakdown(char)).toMatchObject({ stats: 50, traits: 50, multiplier: 10, total: 1000 });
  });

  it('never goes negative', () => {
    const char: Character = { ...freshChar(), traits: [{ id: 'doom', name: 'Doom', description: '', power: -999 }] };
    expect(calculatePowerRating(char)).toBe(0);
  });

  it('turns CP into a weighted win chance, not a coin flip', () => {
    expect(calculateWinProbability(100, 300)).toBe(0.25);
    expect(calculateWinProbability(300, 100)).toBe(0.75);
    expect(calculateWinProbability(0, 0)).toBe(0.5);
  });
});

// ─── generation loop & world ────────────────────────────────────────────────

describe('generation loop', () => {
  it('walks the graph: race wheels, archetype, fate, personality, the race’s stat wheels, a calling, owed powers', () => {
    const world = freshWorld();
    const rng = createSeededRng(99);
    const powerWheels = ['blessed_powers', 'corrupted_powers', 'arcane_powers', 'power_mastery'];
    for (let i = 0; i < 500; i++) {
      const { character } = rollFullCharacter(GAME_CONFIG, world, rng, { now: 0 });
      const path = character.history.map((h) => h.stepId);
      expect(path[0]).toBe('ancestry');
      const fateAt = path.indexOf('fate');
      const personalityAt = path.indexOf('personality');
      expect(fateAt).toBeGreaterThan(2); // every race has at least one wheel of its own
      expect(path[fateAt - 1]).toBe('archetype'); // right after the race's wheels
      // Only monsters, the cursed, demons and angels hear the Abyss.
      const called = path.includes('abyss_calls');
      expect(path.slice(fateAt + 1, personalityAt)).toEqual(called ? ['abyss_calls'] : []);
      if (called) expect(['monster', 'cursed', 'fiend', 'corrupted', 'angel'].some((t) => character.tags.includes(t))).toBe(true);
      // Five stat wheels for the race they ended up as (or its family's), each perhaps
      // followed by its Ascension when banked bonuses broke through the top.
      const statRace = profileRace(character);
      path.forEach((id, i) => {
        if (id.startsWith('ascend_')) expect(path[i - 1]).toBe(`stat_${id.slice('ascend_'.length)}_${statRace}`);
      });
      const climbs = path.filter((id) => !id.startsWith('ascend_'));
      expect(climbs.slice(personalityAt + 1, personalityAt + 6)).toEqual(
        ['might', 'agility', 'intellect', 'arcana', 'vitality'].map((stat) => `stat_${stat}_${statRace}`),
      );
      // Then a calling, then every owed power spin.
      const rest = climbs.slice(personalityAt + 6);
      const calling = rest.filter((id) => !powerWheels.includes(id)).join('>');
      expect(calling).toBe(
        character.role === 'demonLord' // a route sends Demon Lords to the Abyss
          ? 'abyssal'
          : character.singletonClaims.includes('holy_sword_bearer') // the Holy Sword skips the Armory, not the armour
            ? 'talents>outfitter'
            : 'talents>armory>outfitter',
      );
      expect(rest.slice(calling.split('>').length).every((id) => powerWheels.includes(id))).toBe(true);
      expect(character.spinQueue).toEqual([]); // every owed spin was spent
      expect(character.status).toBe('rolling');
      expect(character.name).not.toBe(''); // named as the last wheel landed
    }
  });

  it('applyOption never mutates its input', () => {
    const char = freshChar();
    const before = JSON.stringify(char);
    const slice = resolveSlices(fate.options, freshWorld(), char).find((s) => s.option.id === 'demon_lord');
    if (!slice) throw new Error('missing slice');
    const after = applyOption(char, slice, 'fate', GAME_CONFIG);
    expect(JSON.stringify(char)).toBe(before);
    expect(after.role).toBe('demonLord');
    expect(after.singletonClaims).toEqual(['demon_lord']);
  });

  it('is reproducible from a seed', () => {
    const a = rollFullCharacter(GAME_CONFIG, freshWorld(), createSeededRng(5), { now: 0 }).character;
    const b = rollFullCharacter(GAME_CONFIG, freshWorld(), createSeededRng(5), { now: 0 }).character;
    expect(a).toEqual(b);
  });
});

describe('Demon Lord singleton', () => {
  it('is only written to the world on commit', () => {
    const world = freshWorld();
    const lord = rollUntil(world, createSeededRng(3), (c) => c.role === 'demonLord');
    expect(isSingletonClaimed(world, 'demon_lord')).toBe(false);
    expect(commitCharacter(world, lord).activeSingletons).toEqual({ demon_lord: lord.id });
  });

  it('holds across every later character', () => {
    const rng = createSeededRng(11);
    let world = freshWorld();
    const lord = rollUntil(world, rng, (c) => c.role === 'demonLord');
    world = commitCharacter(world, lord);
    for (let i = 0; i < 1_000; i++) {
      const { character } = rollFullCharacter(GAME_CONFIG, world, rng, { now: 0 });
      expect(character.role).not.toBe('demonLord'); // heroes, or minions sworn at birth
      expect(character.singletonClaims).not.toContain('demon_lord');
    }
  });

  it('rejects a stale claim if another Demon Lord was committed first', () => {
    const rng = createSeededRng(21);
    const world = freshWorld();
    const first = rollUntil(world, rng, (c) => c.role === 'demonLord');
    const second = rollUntil(world, rng, (c) => c.role === 'demonLord');
    const afterFirst = commitCharacter(world, first);
    expectEngineError(() => commitCharacter(afterFirst, second), 'SINGLETON_CONFLICT');
  });

  it('wakes the Holy Sword, which is then a singleton too', () => {
    const rng = createSeededRng(31);
    let world = freshWorld();
    world = commitCharacter(world, rollUntil(world, rng, (c) => c.role === 'demonLord'));
    const bearer = rollUntil(world, rng, (c) => c.singletonClaims.includes('holy_sword_bearer'));
    expect(bearer.tags.includes('cursed')).toBe(false);
    world = commitCharacter(world, bearer);
    const reason = resolveSlices(talents.options, world, freshChar()).find((s) => s.option.id === 'holy_sword')?.lockReason;
    expect(reason).toBe('The Holy Sword has already chosen a bearer');
  });
});

// ─── generic singletons ──────────────────────────────────────────────────────

describe('generic singletons', () => {
  /** A two-wheel config invented on the spot, with role keys the engine has never seen. */
  const origin: GameConfig = {
    entryStepId: 'origin',
    baseStats: GAME_CONFIG.baseStats,
    traits: {},
    races: {},
    personalities: {},
    archetypes: {},
    fallbackNames: ['Test'],
    fame: GAME_CONFIG.fame,
    adventure: GAME_CONFIG.adventure,
    steps: {
      origin: {
        id: 'origin',
        title: 'Origin',
        options: [
          { id: 'chosen', label: 'Chosen Hero', baseWeight: 1, claimSingleton: 'chosen_hero', nextStepId: 'calling' },
          { id: 'commoner', label: 'Commoner', baseWeight: 3, nextStepId: 'calling' },
        ],
      },
      calling: {
        id: 'calling',
        title: 'Calling',
        options: [
          { id: 'archmage', label: 'Archmage', baseWeight: 1, claimSingleton: 'archmage', nextStepId: null },
          { id: 'farmer', label: 'Farmer', baseWeight: 1, nextStepId: null },
        ],
      },
    },
  };
  const rollOrigin = (world: World, rng: Rng) => rollFullCharacter(origin, world, rng, { now: 0 }).character;

  it('locks and writes any key a config invents, with no engine changes', () => {
    const rng = createSeededRng(41);
    let world = freshWorld();
    let hero = rollOrigin(world, rng);
    while (!hero.singletonClaims.includes('chosen_hero')) hero = rollOrigin(world, rng);
    world = commitCharacter(world, hero);

    expect(isSingletonClaimed(world, 'chosen_hero')).toBe(true);
    expect(world.activeSingletons['chosen_hero']).toBe(hero.id);

    const slice = resolveSlices(getStep(origin, 'origin').options, world, freshChar())[0];
    expect(slice?.locked).toBe(true);
    expect(slice?.lockReason).toBe('Already claimed in this world');
    for (let i = 0; i < 2_000; i++) {
      expect(rollOrigin(world, rng).singletonClaims.includes('chosen_hero')).toBe(false);
    }
  });

  it('lets one character hold several roles, each tracked independently', () => {
    const rng = createSeededRng(43);
    let world = freshWorld();
    let both = rollOrigin(world, rng);
    while (both.singletonClaims.length < 2) both = rollOrigin(world, rng);
    world = commitCharacter(world, both);
    expect(world.activeSingletons).toEqual({ chosen_hero: both.id, archmage: both.id });

    for (let i = 0; i < 500; i++) expect(rollOrigin(world, rng).singletonClaims).toEqual([]);
  });

  it('releaseSingletons frees every role the character held, and only theirs', () => {
    const world: World = {
      ...freshWorld(),
      activeSingletons: { chosen_hero: 'chr_a', archmage: 'chr_a', demon_lord: 'chr_b' },
    };
    const released = releaseSingletons(world, 'chr_a');
    expect(released.activeSingletons).toEqual({ demon_lord: 'chr_b' });
    expect(resolveSlices(getStep(origin, 'origin').options, released, freshChar())[0]?.locked).toBe(false);
    expect(world.activeSingletons['chosen_hero']).toBe('chr_a'); // input untouched
  });

  it('treats unusual keys as plain data', () => {
    const odd: WheelOption[] = [{ id: 'p', label: 'P', baseWeight: 1, claimSingleton: '__proto__', nextStepId: null }];
    const char = applyOption(freshChar(), resolveSlices(odd, freshWorld(), freshChar())[0]!, 's', origin);
    const world = commitCharacter(freshWorld(), char);
    expect(Object.getPrototypeOf(world.activeSingletons)).toBe(Object.prototype);
    expect(isSingletonClaimed(world, '__proto__')).toBe(true);
    expect(isSingletonClaimed(world, 'toString')).toBe(false);
  });
});

// ─── races ──────────────────────────────────────────────────────────────────

describe('races', () => {
  const armory = getStep(GAME_CONFIG, 'armory');
  const moonbow = (world: World, c: Character) =>
    resolveSlices(armory.options, world, c).find((s) => s.option.id === 'elven_moonbow');
  const as = (race: string, extra: Partial<Character> = {}): Character => ({ ...freshChar(), race, ...extra });
  const chance = (stepId: string, optionId: string, c: Character) =>
    resolveSlices(dealOptions(getStep(GAME_CONFIG, stepId), c, GAME_CONFIG), freshWorld(), c).find((s) => s.option.id === optionId)!
      .probability;

  it('gives every character exactly one race, from the first wheel', () => {
    const rng = createSeededRng(50);
    for (let i = 0; i < 300; i++) {
      const { character } = rollFullCharacter(GAME_CONFIG, freshWorld(), rng, { now: 0 });
      expect(character.history[0]?.stepId).toBe('ancestry');
      expect(character.race !== null && character.race in GAME_CONFIG.races).toBe(true);
    }
  });

  it('gives every race at least one wheel of its own', () => {
    for (const stepId of ['ancestry', 'monster_type']) {
      for (const option of getStep(GAME_CONFIG, stepId).options) {
        if (option.id === 'monster') continue; // the monster's wheel is "what kind?"
        expect(['fate', 'monster_type', null]).not.toContain(option.nextStepId);
      }
    }
  });

  it('lets later wheels gate options on a whole race family', () => {
    const world = freshWorld();
    expect(moonbow(world, as('wood_elf'))?.locked).toBe(false);
    expect(moonbow(world, as('dark_elf'))?.locked).toBe(false);
    expect(moonbow(world, as('dwarf'))?.lockReason).toBe('Only an elf can draw a moonbow');
  });

  it('bends the other wheels by race, with a family’s odds underneath', () => {
    expect(chance('personality', 'cruel', as('orc'))).toBeGreaterThan(chance('personality', 'cruel', as('human')) * 1.4);
    expect(chance('fate', 'blessed', as('celestial'))).toBeGreaterThan(chance('fate', 'blessed', as('human')) * 2);
    expect(chance('armory', 'war_axe', as('dwarf'))).toBeGreaterThan(chance('armory', 'war_axe', as('human')) * 2);
    // A Wood Elf has no table of its own: the elf family's applies. A Dark Elf's own entries win.
    expect(chance('armory', 'hunters_longbow', as('wood_elf'))).toBeCloseTo(chance('armory', 'hunters_longbow', as('elf')), 9);
    expect(chance('personality', 'cruel', as('dark_elf'))).toBeGreaterThan(chance('personality', 'cruel', as('wood_elf')));
  });

  it('rolls each race on its own stat ladder, with odds peaked where the race sits', () => {
    const ladder = (stepId: string, c: Character) =>
      resolveSlices(dealOptions(getStep(GAME_CONFIG, stepId), c, GAME_CONFIG), freshWorld(), c);
    const p = (slices: ReturnType<typeof ladder>, test: (value: number) => boolean) =>
      slices.filter((s) => test(Object.values(s.option.setStats!)[0]!)).reduce((sum, s) => sum + s.probability, 0);

    const human = ladder('stat_might_human', as('human'));
    expect(Math.max(...human.map((s) => s.probability))).toBe(p(human, (v) => v === 10)); // humans: Average likeliest
    expect(p(human, (v) => v <= 10)).toBeGreaterThan(0.5); // and Average or below more often than not
    const orc = ladder('stat_might_orc', as('orc'));
    expect(p(orc, (v) => v > 10)).toBeGreaterThan(0.6); // orcs: stronger than average

    const labels = (stepId: string) => getStep(GAME_CONFIG, stepId).options.map((o) => o.label);
    expect(labels('stat_might_goblin')).toContain('Powerless');
    expect(labels('stat_might_human')).not.toContain('Powerless');
    expect(labels('stat_might_minotaur')[0]).toBe('Battle Ram'); // best first, renamed for minotaurs
    expect(labels('stat_might_human')).not.toContain('Titanic');
  });

  it('lets a skeleton become a Lich, who rolls on the Lich’s ladders', () => {
    // About 1 soul in 800, so walk the path by hand.
    let lich = freshChar();
    for (const [stepId, optionId] of [['ancestry', 'monster'], ['monster_type', 'skeleton'], ['undeath', 'spark_of_sorcery']] as const) {
      const option = getStep(GAME_CONFIG, stepId).options.find((o) => o.id === optionId)!;
      lich = applyOption(lich, resolveSlices([option], freshWorld(), lich)[0]!, stepId, GAME_CONFIG);
    }
    expect(lich.race).toBe('lich');
    expect(resolveNextStep(STATS_START, freshWorld(), lich)).toBe('stat_might_lich');
  });

  it('sorts goblins into a band, and now and then makes them its boss', () => {
    // A Warboss is rare (about 1 in 8,000 souls), so walk the path by hand.
    const path: [string, string][] = [['ancestry', 'monster'], ['monster_type', 'goblin'], ['goblin_band', 'great_horde'], ['goblin_place_horde', 'boss']];
    let char = freshChar();
    for (const [stepId, optionId] of path) {
      const option = getStep(GAME_CONFIG, stepId).options.find((o) => o.id === optionId)!;
      expect(resolveNextStep(option.nextStepId, freshWorld(), char)).not.toBeNull();
      char = applyOption(char, resolveSlices([option], freshWorld(), char)[0]!, stepId, GAME_CONFIG);
    }
    const warboss = nameCharacter(GAME_CONFIG, char, createSeededRng(54));
    expect(warboss.race).toBe('goblin');
    expect(warboss.title).toBe('Warboss of the Great Horde');
    expect(warboss.traits.map((t) => t.id)).toContain('horde_warboss');
  });

  it('rejects a race that is not registered, and race odds that point nowhere', () => {
    const bad: WheelOption = { id: 'x', label: 'X', baseWeight: 1, setRace: 'naga', nextStepId: null };
    const slice = resolveSlices([bad], freshWorld(), freshChar())[0]!;
    expectEngineError(() => applyOption(freshChar(), slice, 'ancestry', GAME_CONFIG), 'UNKNOWN_RACE');
    const broken = { ...GAME_CONFIG, steps: { ...GAME_CONFIG.steps, fate: { ...fate, options: [...fate.options, bad] } } };
    expect(validateGameConfig(broken).errors).toEqual(['fate › x: unknown race "naga".']);

    const typo = { ...GAME_CONFIG, races: { ...GAME_CONFIG.races, orc: { ...GAME_CONFIG.races['orc']!, odds: { fate: { cursd: 2 } } } } };
    expect(validateGameConfig(typo).errors).toEqual(['Race "orc": odds for unknown option "fate › cursd".']);
  });
});

// ─── names and titles ───────────────────────────────────────────────────────

describe('names and titles', () => {
  const option = (stepId: string, id: string) => getStep(GAME_CONFIG, stepId).options.find((o) => o.id === id)!;
  const take = (char: Character, stepId: string, id: string) =>
    applyOption(char, resolveSlices([option(stepId, id)], freshWorld(), char)[0]!, stepId, GAME_CONFIG);

  it('names a soul only as its last wheel lands, from its race', () => {
    const rng = createSeededRng(60);
    for (let i = 0; i < 100; i++) {
      const { spins, character } = rollFullCharacter(GAME_CONFIG, freshWorld(), rng, { now: 0 });
      expect(spins.slice(0, -1).every((sp) => sp.state.character.name === '')).toBe(true);
      const race = GAME_CONFIG.races[character.race!]!;
      const pool = race.names ?? GAME_CONFIG.races[race.family ?? '']?.names ?? GAME_CONFIG.fallbackNames;
      expect(pool).toContain(character.name.split(' ')[0]);
    }
  });

  it('gives dwarves their clan as a surname', () => {
    const dwarf = rollUntil(freshWorld(), createSeededRng(61), (c) => c.race === 'dwarf');
    const clans = getStep(GAME_CONFIG, 'dwarf_clan').options.map((o) => o.surname);
    expect(clans).toContain(dwarf.name.split(' ').at(-1));
  });

  it('crowns the highest-priority title earned, and keeps a name already given', () => {
    let soul = take(createCharacter(GAME_CONFIG, { name: 'Aldric', rng: createSeededRng(62), now: 0 }), 'fate', 'blessed');
    soul = take(soul, 'personality', 'brave');
    const named = nameCharacter(GAME_CONFIG, soul, createSeededRng(63));
    expect(named.name).toBe('Aldric');
    expect(named.title).toBe('the Blessed'); // priority 22 beats "the Brave" at 14
    expect(nameCharacter(GAME_CONFIG, take(soul, 'talents', 'archmage'), createSeededRng(63)).title).toBe('Archmage of the Spire');
  });
});

// ─── the Abyss calls ────────────────────────────────────────────────────────

describe('the Abyss calls', () => {
  it('lets monsters and the cursed join the Demon Lord’s army before they are ever heroes', () => {
    const sworn = rollUntil(freshWorld(), createSeededRng(64), (c) => c.role === 'minion');
    expect(sworn.history.some((h) => h.stepId === 'abyss_calls' && h.optionId === 'answer')).toBe(true);
    expect(['monster', 'cursed', 'fiend', 'corrupted', 'angel'].some((tag) => sworn.tags.includes(tag))).toBe(true);
    const world = commitCharacter(freshWorld(), sworn);
    expect(world.roster[0]).toMatchObject({ role: 'minion', status: 'alive' });
    expect(canAdventure(world.roster[0]!)).toBe(false);
  });
});

// ─── rarity ─────────────────────────────────────────────────────────────────

describe('rarity', () => {
  const withFateOption = (id: string, patch: Partial<WheelOption>): GameConfig => ({
    ...GAME_CONFIG,
    steps: {
      ...GAME_CONFIG.steps,
      fate: { ...fate, options: fate.options.map((o) => (o.id === id ? { ...o, ...patch } : o)) },
    },
  });

  it('tiers every sample option', () => {
    const untiered = Object.values(GAME_CONFIG.steps).flatMap((s) => s.options.filter((o) => !o.rarity).map((o) => o.id));
    expect(untiered).toEqual([]);
  });

  it('warns when a rarer option is more likely than a more common one', () => {
    const { warnings } = validateGameConfig(withFateOption('demon_lord', { baseWeight: 60 }));
    expect(warnings).toEqual([
      'fate › demon_lord: marked legendary (weight 60) but outweighs blessed, which is uncommon (weight 14).',
    ]);
  });

  it('never touches the odds: rarity is presentation only', () => {
    const p = (config: GameConfig) =>
      resolveSlices(getStep(config, 'fate').options, freshWorld(), freshChar()).map((s) => s.probability);
    expect(p(withFateOption('normal_fate', { rarity: 'legendary' }))).toEqual(p(GAME_CONFIG));
  });

  it('rejects an unknown tier', () => {
    const { errors } = validateGameConfig(withFateOption('normal_fate', { rarity: 'mythic' as Rarity }));
    expect(errors).toEqual(['fate › normal_fate: unknown rarity "mythic".']);
  });
});

// ─── adventures ─────────────────────────────────────────────────────────────

describe('adventures', () => {
  const troll = getStep(GAME_CONFIG, 'fight_troll');
  const hasIronWill = (c: Character) => c.traits.some((t) => t.id === 'iron_will');

  /** A world with one living hero (no Iron Will, so they can die) holding the Archmage's seat. */
  function worldWithHero(seed: number): { world: World; hero: Character } {
    const rng = createSeededRng(seed);
    const base = freshWorld();
    const rolled = rollUntil(base, rng, (c) => c.role === 'hero' && !hasIronWill(c) && c.singletonClaims.length === 0);
    const world = commitCharacter(base, rolled);
    const hero = world.roster[0]!;
    return { world: { ...world, activeSingletons: { archmage: hero.id } }, hero };
  }

  it('earns fame by how hard the foe was and how the fight was won', () => {
    const { hero } = worldWithHero(60);
    const option = (id: string) => troll.options.find((o) => o.id === id)!;
    const step = { ...troll, foe: { name: 'Troll', power: 300 } };
    expect(fameEarned(GAME_CONFIG, option('victory'), step, hero)).toBe(12);
    expect(fameEarned(GAME_CONFIG, option('glory'), step, hero)).toBe(24);
    expect(fameEarned(GAME_CONFIG, option('out_wrestled'), step, hero)).toBe(18); // a win only some heroes have
    expect(fameEarned(GAME_CONFIG, option('retreat'), step, hero)).toBe(0);
    expect(fameEarned(GAME_CONFIG, option('victory'), { ...step, foe: { name: 'Dragon', power: 900 } }, hero)).toBe(36);
    // Along the way, nothing; at the end of a road, by rarity; an option's own fame wins.
    const road = getStep(GAME_CONFIG, 'road');
    expect(fameEarned(GAME_CONFIG, road.options.find((o) => o.id === 'bandit_ambush')!, road, hero)).toBe(0);
    expect(fameEarned(GAME_CONFIG, road.options.find((o) => o.id === 'quiet_roads')!, road, hero)).toBe(2);
    expect(fameEarned(GAME_CONFIG, road.options.find((o) => o.id === 'titans_grave')!, road, hero)).toBe(12);
    const legend = getStep(GAME_CONFIG, 'legend');
    expect(fameEarned(GAME_CONFIG, legend.options.find((o) => o.id === 'murdered_the_legend')!, legend, hero)).toBe(-12);
  });

  it('ranks fame into tiers, and lets the famous take riskier roads', () => {
    const tiers = GAME_CONFIG.fame.tiers;
    expect([0, 5, 6, 31, 32, 99, 100, 5000].map((f) => fameStanding(tiers, f).tier.name)).toEqual([
      'Unknown', 'Unknown', 'Known', 'Renowned', 'Famous', 'Legendary', 'Mythic', 'Mythic',
    ]);
    expect(fameStanding(tiers, 50).next?.name).toBe('Legendary');
    expect(fameStanding(tiers, 500).next).toBeNull();

    const { hero } = worldWithHero(61);
    const crossroads = getStep(GAME_CONFIG, 'crossroads');
    const weight = (c: Character, id: string) => dealOptions(crossroads, c, GAME_CONFIG).find((o) => o.id === id)!.baseWeight;
    const famous = { ...hero, fame: 80 };
    expect(fameTier(GAME_CONFIG, famous)).toBe(4);
    expect(weight(famous, 'war') / weight(hero, 'war')).toBeCloseTo(1 + 0.3 * 4, 9); // fameScaling 0.3 per tier
    expect(weight(famous, 'study')).toBeLessThan(weight(hero, 'study'));
    expect(weight(famous, 'destiny')).toBeGreaterThan(weight(famous, 'go_adventure')); // and their story wants to end
  });

  it('only sends living heroes', () => {
    const { hero } = worldWithHero(61);
    expectEngineError(() => startAdventure(GAME_CONFIG, { ...hero, role: 'demonLord' }), 'INVALID_STATUS');
    expectEngineError(() => startAdventure(GAME_CONFIG, { ...hero, status: 'rolling' }), 'INVALID_STATUS');
    expectEngineError(() => startAdventure(GAME_CONFIG, { ...hero, status: 'fallen' }), 'INVALID_STATUS');
  });

  it('never asks a hero to retire: a road that ends just brings them home', () => {
    const { world, hero } = worldWithHero(62);
    const rng = createSeededRng(63);
    let home = 0;
    for (let i = 0; i < 2_000; i++) {
      const { state } = rollFullAdventure(GAME_CONFIG, world, hero, rng);
      expect(state.character.status).not.toBe('retired'); // only Destiny retires a hero, and it needs renown
      if (state.character.status === 'alive' && state.character.role === 'hero') home++;
    }
    expect(home).toBeGreaterThan(1_500);
  });

  it('opens Destiny to the Renowned and the Legendary Challenges to the Famous', () => {
    const { world, hero } = worldWithHero(64);
    const crossroads = getStep(GAME_CONFIG, 'crossroads');
    const lock = (c: Character, id: string) => resolveSlices(dealOptions(crossroads, c, GAME_CONFIG), world, c).find((s) => s.option.id === id)!;
    expect(lock(hero, 'destiny').locked).toBe(true);
    expect(lock(hero, 'destiny').lockReason).toMatch(/^Only for the Renowned/);
    expect(lock({ ...hero, fame: 15 }, 'destiny').locked).toBe(false);
    expect(lock({ ...hero, fame: 15 }, 'legendary_challenge').locked).toBe(true);
    expect(lock({ ...hero, fame: 32 }, 'legendary_challenge').locked).toBe(false);
  });

  it('sends the fallen to the graveyard, and frees their roles', () => {
    const { world, hero } = worldWithHero(66);
    const rng = createSeededRng(67);
    let state = rollFullAdventure(GAME_CONFIG, world, hero, rng).state;
    while (state.character.status !== 'fallen') state = rollFullAdventure(GAME_CONFIG, world, hero, rng).state;

    // Death ends the adventure on the spot.
    const last = state.rolls.at(-1)!;
    expect(getStep(GAME_CONFIG, last.stepId).options.find((o) => o.id === last.optionId)?.setStatus).toBe('fallen');

    const after = completeAdventure(world, state, 123);
    expect(after.roster).toEqual([]);
    expect(after.activeSingletons).toEqual({});
    expect(after.graveyard.at(-1)).toMatchObject({
      id: hero.id,
      status: 'fallen',
      fate: { at: 123, summary: 'Fell on adventure 1' },
      adventures: [{ rolls: state.rolls, outcome: 'fallen' }],
    });
    // The dead are never written into creation history.
    expect(after.graveyard.at(-1)?.history).toEqual(hero.history);
  });

  it('lets Iron Will cheat death', () => {
    const { world, hero } = worldWithHero(68);
    const stubborn = { ...hero, traits: [...hero.traits, GAME_CONFIG.traits['iron_will']!] };
    const slain = resolveSlices(dealOptions(troll, stubborn, GAME_CONFIG), world, stubborn).find((s) => s.option.id === 'slain');
    expect(slain?.locked).toBe(true);
    expect(slain?.lockReason).toBe('Iron Will: they get back up. Every time.');
    expect(slain?.effectiveWeight).toBe(0);
    expect(slain?.option.baseWeight).toBeGreaterThan(0); // still drawn at the size it would have had
  });

  it('retires a hero to the hall of fame when Destiny calls, with the story written down', () => {
    const { world, hero } = worldWithHero(69);
    const destiny = getStep(GAME_CONFIG, 'destiny');
    const retire = destiny.options.find((o) => o.id === 'hang_up_the_sword')!;
    const rigged = { ...GAME_CONFIG, steps: { ...GAME_CONFIG.steps, destiny: { ...destiny, options: [retire] } } };
    const renowned = { ...hero, fame: 20, adventures: [{ rolls: [], outcome: 'returned' as const }] };
    const start = { ...startAdventure(rigged, renowned), currentStepId: 'destiny' };
    const { state } = spinAdventure(start, rigged, world, createSeededRng(70));
    expect(state.currentStepId).toBeNull();

    const after = completeAdventure({ ...world, roster: [renowned] }, state, 5);
    expect(after.roster).toEqual([]);
    expect(after.activeSingletons).toEqual({});
    expect(after.hallOfFame.at(-1)).toMatchObject({
      id: hero.id,
      status: 'retired',
      fate: { summary: 'Hung up the sword, a legend in their own time' },
    });
    expect(after.hallOfFame.at(-1)?.adventures.at(-1)).toMatchObject({ outcome: 'retired', note: 'Hung up the sword, a legend in their own time' });
  });

  it('brings returning heroes home changed, one adventure older', () => {
    const { world, hero } = worldWithHero(71);
    const rng = createSeededRng(72);
    let state = rollFullAdventure(GAME_CONFIG, world, hero, rng).state;
    while (state.character.status !== 'alive') state = rollFullAdventure(GAME_CONFIG, world, hero, rng).state;

    const after = completeAdventure(world, state);
    expect(after.roster).toHaveLength(1);
    expect(after.roster[0]).toMatchObject({ id: hero.id, status: 'alive', stats: state.character.stats });
    const explored = state.character.expedition;
    const place = explored && { place: { name: explored.name, depth: explored.depth, discovered: explored.isNew } };
    expect(after.roster[0]?.adventures).toEqual([{ rolls: state.rolls, outcome: 'returned', ...place }]);
    expect(after.activeSingletons).toEqual(world.activeSingletons); // roles stay with the living
    // Fame comes home with them, roll by roll.
    expect(after.roster[0]?.fame).toBe(state.character.fame);
    expect(state.fameEarned).toBe(state.rolls.reduce((sum, r) => sum + (r.fame ?? 0), 0));
  });

  it('refuses to write an unfinished adventure, or one whose hero has left the world', () => {
    const { world, hero } = worldWithHero(73);
    const started = startAdventure(GAME_CONFIG, hero);
    expectEngineError(() => completeAdventure(world, started), 'INVALID_STATUS');
    const { state } = rollFullAdventure(GAME_CONFIG, world, hero, createSeededRng(74));
    expectEngineError(() => completeAdventure(freshWorld(), state), 'UNKNOWN_CHARACTER');
  });

  it('decides each spin before any animation, without touching its input', () => {
    const { world, hero } = worldWithHero(75);
    const start = startAdventure(GAME_CONFIG, hero);
    const before = JSON.stringify(start);
    const outcome = spinAdventure(start, GAME_CONFIG, world, createSeededRng(76));
    expect(JSON.stringify(start)).toBe(before);
    expect(outcome.state.rolls).toHaveLength(1);
    expect(outcome.step.options[outcome.roll.winner.index]?.id).toBe(outcome.roll.winner.option.id);
  });

  it('weighs Combat Power against the foe’s power', () => {
    const even: Character = { ...freshChar(), stats: { might: 60, agility: 60, intellect: 60, arcana: 60, vitality: 60 } };
    expect(calculatePowerRating(even)).toBe(300); // the Bridge Troll's power
    expect(fightOdds(troll, even)).toBe(0.5);
    const slices = resolveSlices(dealOptions(troll, even, GAME_CONFIG), freshWorld(), even);
    const win = slices.filter((s) => s.option.fight === 'win').reduce((sum, s) => sum + s.probability, 0);
    expect(win).toBeCloseTo(0.5, 9);
    expect(fightOdds(getStep(GAME_CONFIG, 'road'), even)).toBeNull(); // not a fight
  });

  it('gives stronger heroes better odds, a bigger Victory slice, and fewer deaths', () => {
    const { world, hero } = worldWithHero(77);
    const strong = { ...hero, weaponTier: 10 };
    const victory = (c: Character) => dealOptions(troll, c, GAME_CONFIG).find((o) => o.id === 'victory')!.baseWeight;
    expect(fightOdds(troll, strong)!).toBeGreaterThan(fightOdds(troll, hero)!);
    expect(victory(strong)).toBeGreaterThan(victory(hero));

    const rng = createSeededRng(78);
    const deathRate = (c: Character) => {
      let dead = 0;
      for (let i = 0; i < 6_000; i++) if (rollFullAdventure(GAME_CONFIG, world, c, rng).state.character.status === 'fallen') dead++;
      return dead / 6_000;
    };
    expect(deathRate(strong)).toBeLessThan(deathRate(hero));
  });

  it('sends Monster Lair adventurers to one of several lairs, then into its fight', () => {
    const { world, hero } = worldWithHero(79);
    const rng = createSeededRng(80);
    const lairs = new Set<string>();
    for (let i = 0; i < 3_000; i++) {
      const { rolls } = rollFullAdventure(GAME_CONFIG, world, hero, rng).state;
      const at = rolls.findIndex((r) => r.stepId === 'lairs');
      if (at < 0) continue;
      lairs.add(rolls[at]!.optionId);
      expect(rolls[at + 1]?.stepId).toMatch(/^fight_/);
    }
    // Every lair but the Haunted Crypt, which waits for two souls in the graveyard.
    expect([...lairs].sort()).toEqual(['dragons_den', 'goblin_warren', 'spider_nest', 'troll_bridge', 'wyvern_roost']);
  });

  /** Adventure until `done` says stop, or fail loudly. */
  function adventureUntil(world: World, hero: Character, seed: number, done: (state: AdventureState) => boolean): AdventureState {
    const rng = createSeededRng(seed);
    for (let i = 0; i < 30_000; i++) {
      const { state } = rollFullAdventure(GAME_CONFIG, world, hero, rng);
      if (done(state)) return state;
    }
    throw new Error('adventureUntil: never happened');
  }

  /** A second soul, committed to `world` and then reshaped by `patch` (role, status...). */
  function withSecond(world: World, seed: number, patch: Partial<Character>): { world: World; other: Character } {
    const rolled = rollUntil(world, createSeededRng(seed), (c) => c.role === 'hero' && c.singletonClaims.length === 0);
    const other = { ...rolled, status: 'alive' as const, ...patch };
    return { world: E.placeCharacter(world, other), other };
  }

  it('turns a bandit-hearted hero outlaw: they stay in the world, stop adventuring, and lose their roles', () => {
    const { world, hero } = worldWithHero(81);
    const greedy = { ...hero, personality: 'greedy' };
    const state = adventureUntil(world, greedy, 82, (s) => s.character.role === 'outlaw');

    const after = completeAdventure(world, state);
    const outlaw = after.roster.find((c) => c.id === hero.id)!;
    expect(outlaw).toMatchObject({ role: 'outlaw', status: 'alive' });
    expect(outlaw.adventures.at(-1)).toMatchObject({ outcome: 'turned', turnedTo: 'outlaw' });
    expect(after.activeSingletons).toEqual({}); // the Archmage's seat is free again
    expect(canAdventure(outlaw)).toBe(false);
  });

  it('never turns an honourable hero', () => {
    const { world, hero } = worldWithHero(83);
    const honest = { ...hero, personality: 'honorable', tags: [...hero.tags, 'cursed'] };
    const rng = createSeededRng(84);
    for (let i = 0; i < 3_000; i++) {
      const { character } = rollFullAdventure(GAME_CONFIG, world, honest, rng).state;
      expect(['outlaw', 'minion']).not.toContain(character.role); // (a twist of fate may still make them an NPC)
    }
    const offer = resolveSlices(getStep(GAME_CONFIG, 'road').options, world, honest).find((s) => s.option.id === 'tempting_offer');
    expect(offer?.locked).toBe(true);
  });

  it('brings outlaws back as foes, at their own Combat Power, and lets heroes bring them to justice', () => {
    const base = worldWithHero(85);
    const { world, other: outlaw } = withSecond(base.world, 86, { role: 'outlaw', weaponTier: 6 });
    const road = resolveSlices(getStep(GAME_CONFIG, 'road').options, world, base.hero);
    expect(road.find((s) => s.option.id === 'familiar_face')?.locked).toBe(false);

    const rng = createSeededRng(87);
    let fight: ReturnType<typeof rollFullAdventure>['spins'][number] | undefined;
    while (!fight) fight = rollFullAdventure(GAME_CONFIG, world, base.hero, rng).spins.find((sp) => sp.step.id === 'fight_outlaw');
    expect(fight.step.foe).toEqual({ name: outlaw.name, power: calculatePowerRating(outlaw) });
    expect(fight.state.rolls.at(-1)?.cast).toBe(outlaw.name);

    const justice = adventureUntil(world, base.hero, 88, (s) => s.rolls.some((r) => r.stepId === 'fight_outlaw' && r.optionId === 'glory'));
    const after = completeAdventure(world, justice, 9);
    expect(after.roster.some((c) => c.id === outlaw.id)).toBe(false);
    expect(after.graveyard.find((c) => c.id === outlaw.id)).toMatchObject({
      status: 'fallen',
      weaponTier: 0, // everything they stole goes to the one who stopped them
      fate: { at: 9, summary: `Brought down by ${base.hero.name}` },
    });
    expect(justice.rolls.find((r) => r.stepId === 'fight_outlaw')?.note).toMatch(new RegExp(outlaw.name));
    expect(justice.character.weaponTier).toBeGreaterThanOrEqual(6);
  });

  it('lets a retired legend come out of retirement', () => {
    const base = worldWithHero(89);
    const { world, other: legend } = withSecond(base.world, 90, { status: 'retired', fate: { at: 1, summary: 'Retired after 3 adventures' } });
    expect(world.hallOfFame.map((c) => c.id)).toEqual([legend.id]);

    const state = adventureUntil(world, base.hero, 91, (s) => s.rolls.some((r) => r.optionId === 'one_last_ride'));
    expect(state.rolls.find((r) => r.stepId === 'legend')?.cast).toBe(legend.name);
    const after = completeAdventure(world, state);
    expect(after.hallOfFame.some((c) => c.id === legend.id)).toBe(false); // (the hero may have retired in their place)
    const back = after.roster.find((c) => c.id === legend.id)!;
    expect(back.status).toBe('alive');
    expect(back.fate).toBeUndefined();
    expect(canAdventure(back)).toBe(true);
  });

  it('lets dark hearts swear to the Demon Lord, and redeems champions who are beaten gloriously', () => {
    const base = worldWithHero(92);
    const reigning = { ...base.world, activeSingletons: { ...base.world.activeSingletons, demon_lord: 'chr_lord' } };
    const cruel = { ...base.hero, personality: 'cruel' };
    const sworn = adventureUntil(reigning, cruel, 93, (s) => s.character.role === 'minion');
    expect(completeAdventure(reigning, sworn).roster.find((c) => c.id === base.hero.id)?.role).toBe('minion');

    const { world, other: champion } = withSecond(base.world, 94, { role: 'minion' });
    const redeemed = adventureUntil(world, base.hero, 95, (s) => s.rolls.some((r) => r.stepId === 'fight_champion' && r.optionId === 'glory'));
    expect(completeAdventure(world, redeemed).roster.find((c) => c.id === champion.id)?.role).toBe('hero');
  });

  it('validates casts', () => {
    const steps = GAME_CONFIG.steps;
    const noCast = { ...steps, ruins: { ...steps['ruins']!, options: [{ id: 'x', label: 'X', baseWeight: 1, castEffect: { setStatus: 'fallen' as const }, nextStepId: null }] } };
    expect(validateGameConfig({ ...GAME_CONFIG, steps: noCast }).errors).toEqual(['ruins › x: a cast effect needs a wheel that casts a character.']);
    const castingEntry = { ...steps, crossroads: { ...steps['crossroads']!, cast: { from: () => [] } } };
    expect(validateGameConfig({ ...GAME_CONFIG, steps: castingEntry }).errors).toEqual(['Entry wheel "crossroads" cannot cast a character.']);
  });

  it('validates the adventure entry wheel', () => {
    const broken = { ...GAME_CONFIG, adventure: { ...GAME_CONFIG.adventure, entryStepId: 'nowhere' } };
    expect(validateGameConfig(broken).errors).toEqual(['adventure.entryStepId "nowhere" does not match any wheel.']);
  });
});

// ─── personality, monsters, talents ─────────────────────────────────────────

describe('personality and monsters', () => {
  it('gives every soul a personality from the registry', () => {
    const rng = createSeededRng(100);
    for (let i = 0; i < 300; i++) {
      const { character } = rollFullCharacter(GAME_CONFIG, freshWorld(), rng, { now: 0 });
      expect(character.personality !== null && character.personality in GAME_CONFIG.personalities).toBe(true);
    }
  });

  it('rolls a monster’s kind on a wheel of its own', () => {
    const monster = rollUntil(freshWorld(), createSeededRng(101), (c) => c.tags.includes('monster'));
    const [first, second] = monster.history;
    expect([first?.stepId, first?.optionId]).toEqual(['ancestry', 'monster']);
    expect(second?.stepId).toBe('monster_type');
    const kind = getStep(GAME_CONFIG, 'monster_type').options.find((o) => o.id === second?.optionId)!;
    expect([kind.setRace, 'lich']).toContain(monster.race); // a skeleton may have become a Lich
  });

  it('lays the stat wheels out best first, at least 15 positions each', () => {
    const minotaur = getStep(GAME_CONFIG, 'stat_might_minotaur').options;
    expect(minotaur[0]!.label).toBe('Battle Ram');
    const values = minotaur.map((o) => o.setStats!.might!);
    expect(values).toEqual([...values].sort((a, b) => b - a));
    for (const step of Object.values(GAME_CONFIG.steps).filter((s) => /^(stat|train)_[a-z]+_/.test(s.id))) {
      expect(step.options.filter((o) => o.setStats).length, step.id).toBeGreaterThanOrEqual(MIN_POSITIONS);
    }
  });

  it('keeps the old tier names (and ids) on their values, so older saves still read', () => {
    const human = getStep(GAME_CONFIG, 'stat_might_human').options;
    const at = (v: number) => human.find((o) => o.setStats?.might === v)!;
    expect([7, 10, 13, 16, 20].map((v) => at(v).id)).toEqual(['weak', 'average', 'strong', 'mighty', 'herculean']);
    expect(new Set(human.map((o) => o.label)).size).toBe(human.length); // every position its own name
  });

  it('leaves most ordinary souls without a talent, and fewer lucky ones', () => {
    const talentsWheel = getStep(GAME_CONFIG, 'talents');
    const ordinary = (c: Character) =>
      resolveSlices(dealOptions(talentsWheel, c, GAME_CONFIG), freshWorld(), c).find((s) => s.option.id === 'ordinary')!.probability;
    expect(ordinary(freshChar())).toBeGreaterThan(0.5);
    expect(ordinary({ ...freshChar(), luck: 1 })).toBeLessThan(ordinary(freshChar()));
  });

  it('rejects a personality that is not registered', () => {
    const odd: WheelOption = { id: 'odd', label: 'Odd', baseWeight: 1, setPersonality: 'grumpy', nextStepId: null };
    const broken = { ...GAME_CONFIG, steps: { ...GAME_CONFIG.steps, fate: { ...fate, options: [...fate.options, odd] } } };
    expect(validateGameConfig(broken).errors).toEqual(['fate › odd: unknown personality "grumpy".']);
    const slice = resolveSlices([odd], freshWorld(), freshChar())[0]!;
    expectEngineError(() => applyOption(freshChar(), slice, 'fate', GAME_CONFIG), 'UNKNOWN_PERSONALITY');
  });
});

// ─── stat rolls and luck ────────────────────────────────────────────────────

describe('stat rolls', () => {
  const agility = getStep(GAME_CONFIG, 'stat_agility_human');
  const armory = getStep(GAME_CONFIG, 'armory');
  const option = (stepId: string, id: string) => getStep(GAME_CONFIG, stepId).options.find((o) => o.id === id)!;
  const take = (char: Character, stepId: string, id: string) =>
    applyOption(char, resolveSlices([option(stepId, id)], freshWorld(), char)[0]!, stepId, GAME_CONFIG);
  const odds = (step: typeof agility, c: Character) => resolveSlices(dealOptions(step, c, GAME_CONFIG), freshWorld(), c);
  const human = (): Character => ({ ...freshChar(), race: 'human' });

  it('rolls every stat once, moves the result a position per banked point, and spends the bank', () => {
    const rng = createSeededRng(90);
    let sawBonus = false;
    let sawOverflow = false;
    for (let i = 0; i < 300; i++) {
      const { spins } = rollFullCharacter(GAME_CONFIG, freshWorld(), rng, { now: 0 });
      const statSpins = spins.filter((sp) => sp.step.id.startsWith('stat_'));
      expect(statSpins.map((sp) => sp.step.id.split('_')[1])).toEqual(['might', 'agility', 'intellect', 'arcana', 'vitality']);
      for (const spin of statSpins) {
        const before = spins[spins.indexOf(spin) - 1]!.state.character;
        const key = spin.step.id.split('_')[1] as StatKey;
        const bonus = before.statBonus[key];
        const rungs = spin.roll.slices.filter((s) => s.option.setStats); // best first
        const landed = rungs.findIndex((s) => s.index === spin.roll.winner.index);
        const target = landed - bonus;
        if (bonus !== 0) sawBonus = true;
        // The wheel rolls plain values; the bank moves the result, clamped to the ladder.
        const expected = rungs[Math.max(0, Math.min(rungs.length - 1, target))]!.option.setStats![key]!;
        expect(spin.state.character.stats[key]).toBe(expected);
        expect(spin.state.character.statBonus[key]).toBe(0);
        // Pushed past the top: Ascension comes next.
        if (target < 0) {
          sawOverflow = true;
          expect(spin.state.currentStepId).toBe(`ascend_${key}`);
        }
      }
      expect(Object.values(spins.at(-1)!.state.character.statBonus).every((v) => v === 0)).toBe(true);
    }
    expect(sawBonus).toBe(true);
    expect(sawOverflow).toBe(true);
  });

  it('banks bonuses from race wheels, then moves the stat roll up a position per point', () => {
    const burglar = take(take(freshChar(), 'ancestry', 'halfling'), 'halfling_hearth', 'burglars_kin');
    expect(burglar.stats).toEqual(GAME_CONFIG.baseStats);
    expect(burglar.statBonus.agility).toBe(2);
    const halflingAgility = getStep(GAME_CONFIG, 'stat_agility_halfling');
    // The wheel shows plain values...
    const slices = resolveSlices(dealOptions(halflingAgility, burglar, GAME_CONFIG), freshWorld(), burglar);
    const steady = slices.find((s) => s.option.id === 'steady')!;
    expect(steady.option.setStats).toEqual({ agility: 10 });
    // ...and a landing on Steady is moved two positions up, to Spry (12).
    const bump = bumpLadder(halflingAgility, slices, steady.index, burglar)!;
    expect(bump).toMatchObject({ stat: 'agility', from: steady.index, stages: 2, overflow: false });
    expect(slices[bump.to]!.option.id).toBe('spry');
    expect(bump.path.map((i) => slices[i]!.option.id)).toEqual(['light_footed', 'spry']);
  });

  it('hammers a top roll through to Ascension, then carries on with the next stat', () => {
    const blessed = { ...take(freshChar(), 'ancestry', 'human'), statBonus: { ...freshChar().statBonus, might: 1 } };
    const atMight: GenerationState = { character: blessed, currentStepId: 'stat_might_human', stepsTaken: 5 };
    const top = () => 0; // the RNG's lowest draw lands on the first slice: the best position
    const broke = spinCurrentStep(atMight, GAME_CONFIG, freshWorld(), top);
    expect(broke.bump).toMatchObject({ overflow: true, stages: 0 });
    expect(broke.state).toMatchObject({ currentStepId: 'ascend_might', resume: 'stat_agility_human' });
    expect(broke.state.character.history.at(-1)).toMatchObject({ stepId: 'stat_might_human', bumpedFrom: broke.roll.winner.option.id });

    const ascended = spinCurrentStep(broke.state, GAME_CONFIG, freshWorld(), top);
    expect(ascended.step.id).toBe('ascend_might');
    expect(ascended.state.character.stats.might).toBeGreaterThanOrEqual(30);
    expect(ascended.state.currentStepId).toBe('stat_agility_human');
    expect(ascended.state.resume).toBeUndefined();
  });

  it('makes Average the likeliest result for a human, and Average or below most of the time', () => {
    const slices = odds(agility, human());
    const p = (ids: string[]) => slices.filter((s) => ids.includes(s.option.id)).reduce((sum, s) => sum + s.probability, 0);
    expect(Math.max(...slices.map((s) => s.probability))).toBe(p(['steady']));
    const atOrBelow = slices.filter((s) => s.option.setStats!.agility! <= 10).reduce((sum, s) => sum + s.probability, 0);
    expect(atOrBelow).toBeGreaterThan(0.5);
  });

  it('takes luck from fate, and luck tilts the ladders toward the top (resizing their slices)', () => {
    expect(take(freshChar(), 'fate', 'blessed').luck).toBe(1);
    expect(take(freshChar(), 'fate', 'cursed').luck).toBe(-0.5);
    expect(take(freshChar(), 'fate', 'normal_fate').luck).toBe(0);

    const lucky = { ...human(), luck: 1 };
    const top = (c: Character) => dealOptions(agility, c, GAME_CONFIG)[0]!;
    expect(top(lucky).baseWeight).toBeGreaterThan(top(human()).baseWeight * 2);
    const best = (c: Character) => odds(agility, c)[0]!.probability;
    expect(best(lucky)).toBeGreaterThan(best(human()) * 2);
    expect(best({ ...human(), luck: -0.5 })).toBeLessThan(best(human()));
  });

  it('leaves an ordinary fate most likely empty-handed at the Armory, and a blessed one far likelier armed', () => {
    const likeliest = (c: Character) => odds(armory, c).reduce((a, b) => (b.probability > a.probability ? b : a)).option.id;
    const unarmed = (c: Character) => odds(armory, c).find((s) => s.option.id === 'empty_hands')!.probability;
    expect(likeliest(freshChar())).toBe('empty_hands');
    expect(unarmed({ ...freshChar(), luck: 1 })).toBeLessThan(unarmed(freshChar()) / 2);
  });

  it('keeps Empty Hands at its old chance among seventeen weapons', () => {
    // As before: 28 of 96.5 for a non-elf once a hero has fallen (the Heirloom unlocked).
    const mourning = withGraveyard(freshWorld(), 1);
    const empty = resolveSlices(dealOptions(armory, freshChar(), GAME_CONFIG), mourning, freshChar()).find((s) => s.option.id === 'empty_hands')!;
    expect(empty.probability).toBeCloseTo(28 / 96.5, 9);
    expect(armory.options.filter((o) => o.weaponTierDelta).length).toBe(17);
  });
});

describe('routes', () => {
  it('rejects a route that picks a wheel outside its list', () => {
    const route = (to: string | null) => ({ among: ['talents'], pick: () => to });
    expectEngineError(() => resolveNextStep(route('armory'), freshWorld(), freshChar()), 'UNKNOWN_STEP');
    expect(resolveNextStep(route('talents'), freshWorld(), freshChar())).toBe('talents');
    expect(resolveNextStep(route(null), freshWorld(), freshChar())).toBeNull();
  });

  it('validates route targets, and fight options that have no foe', () => {
    const extra: WheelOption[] = [
      { id: 'lost', label: 'Lost', baseWeight: 1, nextStepId: { among: ['nowhere'], pick: () => 'nowhere' } },
      { id: 'brawl', label: 'Brawl', baseWeight: 1, fight: 'win', nextStepId: null },
    ];
    const broken = { ...GAME_CONFIG, steps: { ...GAME_CONFIG.steps, fate: { ...fate, options: [...fate.options, ...extra] } } };
    expect(validateGameConfig(broken).errors).toEqual([
      'fate › lost: nextStepId "nowhere" does not match any wheel.',
      'fate › brawl: a fight option needs a wheel with a foe.',
    ]);
  });
});

// ─── persistence ────────────────────────────────────────────────────────────

describe('persistence', () => {
  const memoryStorage = (): StorageLike => {
    const map = new Map<string, string>();
    return {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
      removeItem: (k) => void map.delete(k),
    };
  };

  it('round-trips a world through storage', () => {
    const storage = memoryStorage();
    const rng = createSeededRng(8);
    let world = freshWorld();
    world = commitCharacter(world, rollFullCharacter(GAME_CONFIG, world, rng, { now: 0 }).character);
    saveWorld(world, storage);
    expect(loadWorld(storage)).toEqual(world);
  });

  it('returns null for missing or corrupt saves', () => {
    const storage = memoryStorage();
    expect(loadWorld(storage)).toBeNull();
    storage.setItem('roguelite.world', '{not json');
    expect(loadWorld(storage)).toBeNull();
    storage.setItem('roguelite.world', JSON.stringify({ schemaVersion: 99 }));
    expect(loadWorld(storage)).toBeNull();
  });

  it('rejects saves from before schema version 2', () => {
    const storage = memoryStorage();
    storage.setItem('roguelite.world', JSON.stringify({ ...freshWorld(), schemaVersion: 1 }));
    expect(loadWorld(storage)).toBeNull();
  });

  const NO_BONUS = { might: 0, agility: 0, intellect: 0, arcana: 0, vitality: 0 };

  it('upgrades a v2 save, so a world from before races and adventures keeps going', () => {
    const storage = memoryStorage();
    const { race: _r, adventures: _a, luck: _l, statBonus: _b, personality: _p, title: _t, archetype: _ar, spinQueue: _q, ...oldHero } = { ...freshChar(), status: 'alive' as const };
    const v2 = { ...freshWorld(), schemaVersion: 2, roster: [oldHero], graveyard: [oldHero], hallOfFame: [] };
    storage.setItem('roguelite.world', JSON.stringify(v2));

    const loaded = loadWorld(storage);
    expect(loaded?.schemaVersion).toBe(9);
    expect(loaded?.roster[0]).toEqual({
      ...oldHero,
      race: null,
      personality: null,
      archetype: null,
      title: null,
      adventures: [],
      luck: 0,
      statBonus: NO_BONUS,
      spinQueue: [],
      armorTier: 0,
      fame: 0,
    });
    expect(loaded?.graveyard[0]?.adventures).toEqual([]);
  });

  it('upgrades a v3 save, keeping its races and adventures', () => {
    const storage = memoryStorage();
    const { luck: _l, statBonus: _b, personality: _p, title: _t, ...v3Hero } = { ...freshChar(), status: 'alive' as const, race: 'elf' };
    storage.setItem('roguelite.world', JSON.stringify({ ...freshWorld(), schemaVersion: 3, roster: [v3Hero] }));
    expect(loadWorld(storage)?.roster[0]).toEqual({ ...v3Hero, personality: null, title: null, luck: 0, statBonus: NO_BONUS, armorTier: 0, fame: 0 });
  });

  it('upgrades a v7 save: no armour yet, and fame for the adventures already behind them', () => {
    const storage = memoryStorage();
    const { armorTier: _a, fame: _f, ...v7Hero } = {
      ...freshChar(),
      status: 'alive' as const,
      adventures: [1, 2, 3].map(() => ({ rolls: [], outcome: 'returned' as const })),
    };
    storage.setItem('roguelite.world', JSON.stringify({ ...freshWorld(), schemaVersion: 7, roster: [v7Hero] }));
    expect(loadWorld(storage)?.roster[0]).toEqual({ ...v7Hero, armorTier: 0, fame: 18 });
  });

  it('drops malformed singleton entries instead of locking a role forever', () => {
    const storage = memoryStorage();
    const damaged = { ...freshWorld(), activeSingletons: { demon_lord: 'chr_x', archmage: null, chosen_hero: 42 } };
    storage.setItem('roguelite.world', JSON.stringify(damaged));
    expect(loadWorld(storage)?.activeSingletons).toEqual({ demon_lord: 'chr_x' });
  });
});
