/**
 * Gods, demons, angels, constructs, archetypes, powers, the crossroads, the "who is it?"
 * wheel and twists of fate: the engine features they rely on, through the sample config.
 */
import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../config/gameConfig';
import { isRace } from '../config/races';
import { heroRace } from '../ui/format';
import { POWERS_ROUTE } from '../config/powers';
import { BONUS_SPELL_ARCANA, trainStepId } from '../config/stats';
import {
  WHO_STEP_PREFIX,
  completeAdventure,
  getAdventureStep,
  spinAdventure,
  startAdventure,
  type AdventureState,
} from './adventure';
import { applyOption, createCharacter, earnedTitle, nameCharacter } from './character';
import { getStep, resolveNextStep, rollFullCharacter, spinCurrentStep, startGeneration } from './generation';
import { dealOptions, raceFactor } from './odds';
import { calculatePowerRating, getPowerBreakdown, traitPower } from './power';
import { createSeededRng } from './rng';
import { resolveSlices } from './roll';
import type { Character, World } from './types';
import { validateGameConfig } from './validate';
import { commitCharacter, createWorld } from './world';

const world = (): World => createWorld({ rng: createSeededRng(1), now: 0 });
const soul = (seed = 1): Character => createCharacter(GAME_CONFIG, { name: 'Test', rng: createSeededRng(seed), now: 0 });

/** Land on one option, as if the wheel had picked it. */
function take(char: Character, stepId: string, optionId: string, w: World = world()): Character {
  const option = dealOptions(getStep(GAME_CONFIG, stepId), char, GAME_CONFIG).find((o) => o.id === optionId)!;
  return applyOption(char, resolveSlices([option], w, char)[0]!, stepId, GAME_CONFIG);
}

/** The chance of one option for this character. */
function chance(stepId: string, optionId: string, char: Character, w: World = world()): number {
  const slices = resolveSlices(dealOptions(getStep(GAME_CONFIG, stepId), char, GAME_CONFIG), w, char);
  return slices.find((s) => s.option.id === optionId)!.probability;
}

function rollUntil(w: World, seed: number, predicate: (c: Character) => boolean, tries = 6000): Character {
  const rng = createSeededRng(seed);
  for (let i = 0; i < tries; i++) {
    const { character } = rollFullCharacter(GAME_CONFIG, w, rng, { now: 0 });
    if (predicate(character)) return character;
  }
  throw new Error('rollUntil: predicate never satisfied');
}

describe('spin queues and powers', () => {
  it('owes a god three Blessed spins, plus whatever their domain adds, and spends them all before naming', () => {
    let god = take(soul(), 'ancestry', 'god');
    expect(god.spinQueue).toEqual(['blessed_powers', 'blessed_powers', 'blessed_powers']);
    god = take(god, 'god_domain', 'magic');
    expect(god.spinQueue.filter((id) => id === 'arcane_powers')).toHaveLength(2);
    expect(god.singletonClaims).toContain('domain_magic');

    // The route spends them first owed, first spun; spinning a wheel uses one up.
    expect(resolveNextStep(POWERS_ROUTE, world(), god)).toBe('blessed_powers');
    god = take(god, 'blessed_powers', 'smite');
    expect(god.spinQueue.filter((id) => id === 'blessed_powers')).toHaveLength(2);

    const full = rollUntil(world(), 7, (c) => c.race === 'god');
    expect(full.spinQueue).toEqual([]);
    expect(full.traits.filter((t) => ['healing_light', 'divine_shield', 'smite', 'holy_flame', 'radiant_aura', 'sanctuary', 'fortunes_blessing', 'angelic_wings', 'resurrection', 'miracle'].includes(t.id)).length).toBeGreaterThan(0);
  });

  it('never teaches the same power twice', () => {
    const mage = take(soul(), 'arcane_powers', 'fireball');
    const fireball = resolveSlices(dealOptions(getStep(GAME_CONFIG, 'arcane_powers'), mage, GAME_CONFIG), world(), mage).find((s) => s.option.id === 'fireball')!;
    expect(fireball).toMatchObject({ locked: true, lockReason: 'Already known' });
  });

  it('gives a god of Space ten times the Combat Power', () => {
    const plain = take(soul(), 'ancestry', 'god');
    const space = take(plain, 'god_domain', 'space');
    expect(calculatePowerRating(space)).toBe(calculatePowerRating(plain) * 10);
  });
});

describe('gods', () => {
  it('holds every domain for one god at a time', () => {
    const lifeGod = take(take(soul(2), 'ancestry', 'god'), 'god_domain', 'life');
    const w = commitCharacter(world(), lifeGod);
    const next = take(soul(3), 'ancestry', 'god', w);
    const life = resolveSlices(dealOptions(getStep(GAME_CONFIG, 'god_domain'), next, GAME_CONFIG), w, next).find((s) => s.option.id === 'life')!;
    expect(life).toMatchObject({ locked: true, lockReason: 'Another god already rules Life' });
  });

  it('lets a god of many domains spin the Domain wheel twice more, never landing on one they hold', () => {
    let god = take(take(soul(), 'ancestry', 'god'), 'god_domain', 'multi_domain');
    expect(resolveNextStep(getStep(GAME_CONFIG, 'god_domain').options.find((o) => o.id === 'multi_domain')!.nextStepId, world(), god)).toBe('god_domain');
    god = take(god, 'god_domain', 'time');
    expect(chance('god_domain', 'time', god)).toBe(0); // already theirs
    expect(chance('god_domain', 'multi_domain', god)).toBe(0); // no gathering more while gathering
    god = take(god, 'god_domain', 'justice');
    expect(resolveNextStep(getStep(GAME_CONFIG, 'god_domain').options.find((o) => o.id === 'justice')!.nextStepId, world(), god)).toBe('archetype');
    expect(god.traits.map((t) => t.id)).toContain('uncorruptable');
  });

  it('makes Mischief anywhere from common to epic, differently from soul to soul', () => {
    const rarities = new Set(
      Array.from({ length: 40 }, (_, i) => dealOptions(getStep(GAME_CONFIG, 'minor_domain'), soul(100 + i), GAME_CONFIG).find((o) => o.id === 'mischief')!.rarity),
    );
    expect([...rarities].sort()).toEqual(['common', 'epic', 'rare', 'uncommon']);
    // The same soul always sees the same odds.
    const one = soul(5);
    expect(chance('minor_domain', 'mischief', one)).toBe(chance('minor_domain', 'mischief', one));
  });

  it('mirrors the races for a god of one people, every people equally likely except the gods', () => {
    const god = take(soul(), 'ancestry', 'god');
    const options = dealOptions(getStep(GAME_CONFIG, 'god_of_race'), god, GAME_CONFIG);
    const weights = new Set(options.filter((o) => o.id !== 'gods').map((o) => o.baseWeight));
    expect(weights.size).toBe(1);
    expect(options.find((o) => o.id === 'gods')).toMatchObject({ rarity: 'legendary' });
  });
});

describe('demons and angels', () => {
  const abyssAnswer = (char: Character) => chance('abyss_calls', 'answer', char);

  it('almost always corrupts a demon, almost never an angel', () => {
    const demon = take(soul(), 'ancestry', 'demon');
    const angel = take(soul(), 'ancestry', 'celestial');
    const monster = take(soul(), 'ancestry', 'monster');
    expect(abyssAnswer(demon)).toBeGreaterThan(0.9);
    expect(abyssAnswer(angel)).toBeLessThan(0.05);
    expect(abyssAnswer(monster)).toBeCloseTo(0.16, 2);
  });

  it('makes a natural demon’s sin their race, and a corrupted mortal keep theirs', () => {
    const natural = take(take(take(soul(), 'ancestry', 'demon'), 'fiend_origin', 'natural'), 'demon_sin', 'wrath');
    expect(natural.race).toBe('balor');
    expect(natural.traits.map((t) => t.id)).toContain('true_demon');

    const corrupted = take(take(take(take(soul(), 'ancestry', 'demon'), 'fiend_origin', 'corrupted'), 'corrupted_from', 'elf'), 'fallen_sin', 'wrath');
    expect(corrupted.race).toBe('elf');
    expect(corrupted.traits.map((t) => t.id)).toContain('demonic_corruption');
    // Natural demons are the stronger: their trait outweighs the corrupted one.
    expect(natural.traits.find((t) => t.id === 'true_demon')!.power).toBeGreaterThan(corrupted.traits.find((t) => t.id === 'demonic_corruption')!.power);
  });

  it('sends lust to a Succubus or an Incubus', () => {
    const lust = take(take(take(soul(), 'ancestry', 'demon'), 'fiend_origin', 'natural'), 'demon_sin', 'lust');
    expect(resolveNextStep(getStep(GAME_CONFIG, 'demon_sin').options.find((o) => o.id === 'lust')!.nextStepId, world(), lust)).toBe('lust_form');
    expect(take(lust, 'lust_form', 'incubus').race).toBe('incubus');
  });

  it('lifts an ascended mortal into an angel of their own race', () => {
    const ascended = take(take(take(soul(), 'ancestry', 'celestial'), 'angel_origin', 'ascended'), 'ascended_from', 'orc');
    expect(ascended.race).toBe('orc');
    expect(ascended.tags).toContain('ascended');
    const virtuous = take(ascended, 'angel_virtue', 'charity');
    expect(nameCharacter(GAME_CONFIG, virtuous, createSeededRng(1)).title).toBe('Angel of Charity');
  });

  it('keeps the uncorruptable away from the Abyss', () => {
    const just = take(take(take(soul(), 'ancestry', 'demon'), 'fiend_origin', 'natural'), 'god_domain', 'justice');
    const fate = getStep(GAME_CONFIG, 'fate').options.find((o) => o.id === 'normal_fate')!;
    expect(resolveNextStep(fate.nextStepId, world(), just)).toBe('personality');
  });
});

describe('ancestry, again: corrupted, ascended, undead and hybrid souls', () => {
  /** Where an option sends this character (who has already taken it). */
  const after = (char: Character, stepId: string, optionId: string) =>
    resolveNextStep(getStep(GAME_CONFIG, stepId).options.find((o) => o.id === optionId)!.nextStepId, world(), char);
  const ids = (stepId: string) => getStep(GAME_CONFIG, stepId).options.map((o) => o.id);
  const ancestry = ids('ancestry');

  it('rolls the whole Ancestry wheel again, minus the origin that sent them', () => {
    expect(ids('corrupted_from')).toEqual(ancestry.filter((id) => id !== 'demon'));
    expect(ids('ascended_from')).toEqual(ancestry.filter((id) => id !== 'celestial'));
    expect(ids('resurrected_from')).toEqual(ancestry.filter((id) => id !== 'construct'));
    expect(ids('hybrid_first')).toEqual(ancestry.filter((id) => id !== 'hybrid'));
  });

  it('runs a corrupted mortal through their race’s own wheels before the Abyss names their sin', () => {
    let char = take(take(soul(), 'ancestry', 'demon'), 'fiend_origin', 'corrupted');
    expect(char.spinQueue).toContain('fallen_sin');
    char = take(char, 'corrupted_from', 'elf');
    expect(after(char, 'corrupted_from', 'elf')).toBe('elf_lineage');
    char = take(char, 'elf_lineage', 'star_elf');
    expect(after(char, 'elf_lineage', 'star_elf')).toBe('fallen_sin');
    char = take(char, 'fallen_sin', 'wrath');
    expect(after(char, 'fallen_sin', 'wrath')).toBe('archetype');
    // Everything stacks: the elven line's race and trait, and the Abyss's.
    expect(char.race).toBe('star_elf');
    expect(char.traits.map((t) => t.id)).toEqual(expect.arrayContaining(['starlight', 'demonic_corruption']));
    expect(char.statBonus.might).toBe(3);
  });

  it('runs an ascended mortal through their race’s wheels, then their virtue', () => {
    let char = take(take(take(soul(), 'ancestry', 'celestial'), 'angel_origin', 'ascended'), 'ascended_from', 'dwarf');
    char = take(char, 'dwarf_clan', 'runeforged');
    expect(after(char, 'dwarf_clan', 'runeforged')).toBe('angel_virtue');
    char = take(char, 'angel_virtue', 'chastity');
    expect(char.statBonus.arcana).toBe(4);
    expect(char.traits.map((t) => t.id)).toContain('ascended_soul');
  });

  it('nests detours innermost first, and never lets a soul take the same origin twice', () => {
    // A corrupted mortal who was once an ascended angel: the virtue comes before the sin.
    let char = take(take(soul(), 'ancestry', 'demon'), 'fiend_origin', 'corrupted');
    char = take(take(char, 'corrupted_from', 'celestial'), 'angel_origin', 'ascended');
    expect(chance('ascended_from', 'demon', char)).toBe(0);
    char = take(take(char, 'ascended_from', 'human'), 'human_homeland', 'farmstead');
    expect(after(char, 'human_homeland', 'farmstead')).toBe('angel_virtue');
    char = take(char, 'angel_virtue', 'kindness');
    expect(after(char, 'angel_virtue', 'kindness')).toBe('fallen_sin');
    char = take(char, 'fallen_sin', 'pride');
    expect(after(char, 'fallen_sin', 'pride')).toBe('archetype');
  });

  it('keeps an undead construct’s ancestry, wheels and all', () => {
    let char = take(take(take(soul(), 'ancestry', 'construct'), 'construct_type', 'undead'), 'resurrected_from', 'monster');
    expect(ids('resurrected_from')).not.toContain('construct');
    char = take(take(char, 'monster_type', 'minotaur'), 'labyrinth', 'arena_champion');
    expect(after(char, 'labyrinth', 'arena_champion')).toBe('archetype');
    expect(char.race).toBe('minotaur');
    expect(char.traits.map((t) => t.id)).toContain('reanimated');
  });

  it('makes a hybrid of two races, both of whose wheels and odds stack', () => {
    let char = take(soul(), 'ancestry', 'hybrid');
    expect(after(char, 'ancestry', 'hybrid')).toBe('hybrid_first');
    char = take(take(char, 'hybrid_first', 'orc'), 'orc_standing', 'berserker');
    expect(after(char, 'orc_standing', 'berserker')).toBe('hybrid_second');
    // Not the same ancestry twice, and not a hybrid of hybrids.
    expect(chance('hybrid_second', 'orc', char)).toBe(0);
    expect(ids('hybrid_second')).not.toContain('hybrid');
    char = take(take(char, 'hybrid_second', 'dwarf'), 'dwarf_clan', 'ironfist');
    expect(after(char, 'dwarf_clan', 'ironfist')).toBe('archetype');

    expect(char.race).toBe('dwarf');
    expect(char.tags).toContain('blood:orc');
    expect(char.statBonus.might).toBe(3); // berserker 2 + Ironfist 1
    expect(isRace('orc')(world(), char) && isRace('dwarf')(world(), char)).toBe(true);
    // Race odds multiply: an orc's war axe and a dwarf's... whatever dwarves like.
    const orc = GAME_CONFIG.races.orc!.odds?.archetype?.barbarian ?? 1;
    const dwarf = GAME_CONFIG.races.dwarf!.odds?.archetype?.barbarian ?? 1;
    expect(raceFactor('archetype', 'barbarian', char, GAME_CONFIG)).toBeCloseTo(orc * dwarf);
    expect(heroRace(GAME_CONFIG, char)).toBe('Orc–Dwarf Hybrid');
  });

  it('a human first half shrinks the second wheel’s Human slice to nothing', () => {
    const char = take(take(take(soul(), 'ancestry', 'hybrid'), 'hybrid_first', 'human'), 'human_homeland', 'frontier');
    expect(chance('hybrid_second', 'human', char)).toBe(0);
  });

  it('always finishes, however deep the detours go', () => {
    const w = world();
    const rng = createSeededRng(7);
    for (let i = 0; i < 400; i++) {
      let state = startGeneration(GAME_CONFIG, { rng, now: 0 });
      // Force the rarest doors on the first wheels: hybrid, then demons and angels inside it.
      const force = ['hybrid', 'demon', 'corrupted', 'celestial', 'ascended', 'construct', 'undead'];
      while (state.currentStepId !== null) {
        const step = getStep(GAME_CONFIG, state.currentStepId);
        const dealt = dealOptions(step, state.character, GAME_CONFIG);
        const slices = resolveSlices(dealt, w, state.character).filter((s) => !s.locked && s.probability > 0);
        const forced = rng() < 0.7 ? slices.find((s) => force.includes(s.option.id)) : undefined;
        if (!forced) {
          state = spinCurrentStep(state, GAME_CONFIG, w, rng).state;
          continue;
        }
        const char = applyOption(state.character, forced, step.id, GAME_CONFIG);
        state = { ...state, character: char, currentStepId: resolveNextStep(forced.option.nextStepId, w, char), stepsTaken: state.stepsTaken + 1 };
      }
      expect(state.character.race).not.toBeNull();
      expect(state.character.spinQueue.filter((id) => ['fallen_sin', 'angel_virtue', 'hybrid_second'].includes(id))).toEqual([]);
    }
  });
});

describe('archetypes', () => {
  it('comes right after the race’s own wheels, and bends later wheels', () => {
    const human = take(soul(), 'ancestry', 'human');
    const homeland = getStep(GAME_CONFIG, 'human_homeland').options[0]!;
    expect(resolveNextStep(homeland.nextStepId, world(), human)).toBe('archetype');
    const mage = take(human, 'archetype', 'mage');
    expect(mage.archetype).toBe('mage');
    expect(mage.spinQueue).toEqual(['arcane_powers']);
    expect(chance('armory', 'runed_staff', mage)).toBeGreaterThan(chance('armory', 'runed_staff', human) * 2);
  });

  it('is leaned on by race: orcs make barbarians', () => {
    expect(chance('archetype', 'barbarian', take(soul(), 'ancestry', 'orc'))).toBeGreaterThan(chance('archetype', 'barbarian', take(soul(), 'ancestry', 'human')) * 2);
  });
});

describe('training and ascension', () => {
  it('locks every tier the stat already stands on', () => {
    const strong = { ...take(soul(), 'ancestry', 'human'), stats: { ...soul().stats, might: 13 } };
    const slices = resolveSlices(dealOptions(getStep(GAME_CONFIG, trainStepId('might', 'human')), strong, GAME_CONFIG), world(), strong);
    const ladder = slices.filter((s) => s.option.setStats);
    expect(ladder.filter((s) => s.locked).every((s) => s.option.setStats!.might! <= 13)).toBe(true);
    expect(ladder.filter((s) => !s.locked).every((s) => s.option.setStats!.might! > 13)).toBe(true);
    expect(slices.find((s) => s.option.id === 'strong')?.locked).toBe(true);
    expect(slices.find((s) => s.option.id === 'mighty')?.locked).toBe(false);
    expect(slices.find((s) => s.option.id === 'small_gains')?.locked).toBe(false);
  });

  it('ascends a stat already at the top of its race’s window, onto a golden wheel', () => {
    const train = getStep(GAME_CONFIG, 'train_stat').options.find((o) => o.id === 'might')!;
    const top = Math.max(...getStep(GAME_CONFIG, 'train_might_human').options.map((o) => o.setStats?.might ?? 0)); // a human's best
    const capped = { ...take(soul(), 'ancestry', 'human'), stats: { ...soul().stats, might: top } };
    expect(resolveNextStep(train.nextStepId, world(), capped)).toBe('ascend_might');
    expect(getStep(GAME_CONFIG, 'ascend_might')).toMatchObject({ golden: true });
    expect(getStep(GAME_CONFIG, 'ascend_might').options.some((o) => o.rarity === 'mythical')).toBe(true);
    const uncapped = { ...capped, stats: { ...capped.stats, might: 13 } };
    expect(resolveNextStep(train.nextStepId, world(), uncapped)).toBe('train_might_human');
  });
});

describe('the crossroads', () => {
  const hero = (seed: number): { w: World; hero: Character } => {
    const rolled = rollUntil(world(), seed, (c) => c.role === 'hero' && c.singletonClaims.length === 0);
    const w = commitCharacter(world(), rolled);
    return { w, hero: w.roster[0]! };
  };

  it('starts every adventure by choosing what to do', () => {
    const { hero: h } = hero(11);
    expect(startAdventure(GAME_CONFIG, h).currentStepId).toBe('crossroads');
    expect(getStep(GAME_CONFIG, 'crossroads').options.find((o) => o.id === 'go_adventure')).toMatchObject({ nextStepId: 'road', rarity: 'common' });
  });

  it('turns a hero into an NPC on a twist of fate, who stays in the world (a monarch keeping the crown)', () => {
    const { w, hero: h } = hero(12);
    let state: AdventureState = { ...startAdventure(GAME_CONFIG, h), currentStepId: 'twist_fate' };
    const forced = getStep(GAME_CONFIG, 'twist_fate').options.find((o) => o.id === 'monarch')!;
    // Land on Monarch: the wheel's only open slice in this rigged copy.
    const rigged = { ...GAME_CONFIG, steps: { ...GAME_CONFIG.steps, twist_fate: { ...getStep(GAME_CONFIG, 'twist_fate'), options: [forced] } } };
    state = spinAdventure(state, rigged, w, createSeededRng(1)).state;
    expect(state.currentStepId).toBeNull();
    expect(state.character.role).toBe('npc');
    expect(state.character.title).toBe('Monarch of the Realm');
    const after = completeAdventure(w, state);
    expect(after.roster.find((c) => c.id === h.id)).toMatchObject({ role: 'npc', status: 'alive' });
    expect(after.activeSingletons['monarch']).toBe(h.id);
    expect(after.roster.find((c) => c.id === h.id)!.adventures.at(-1)).toMatchObject({ outcome: 'turned', turnedTo: 'npc' });
  });

  it('spins a "who is it?" wheel when a cast wheel has two or more candidates', () => {
    const { w, hero: h } = hero(13);
    const legends = [soul(201), soul(202), soul(203)].map((c, i) => ({ ...c, name: `Legend ${i}`, status: 'retired' as const }));
    const withLegends = { ...w, hallOfFame: legends };

    // From the road, an Old Legend: the next wheel is "who is it?" with all three.
    const road = { ...startAdventure(GAME_CONFIG, h), currentStepId: 'road' };
    const onlyLegend = { ...GAME_CONFIG, steps: { ...GAME_CONFIG.steps, road: { ...getStep(GAME_CONFIG, 'road'), options: [getStep(GAME_CONFIG, 'road').options.find((o) => o.id === 'old_legend')!] } } };
    const arrived = spinAdventure(road, onlyLegend, withLegends, createSeededRng(2)).state;
    expect(arrived.currentStepId).toBe(`${WHO_STEP_PREFIX}legend`);
    const who = getAdventureStep(GAME_CONFIG, arrived.currentStepId!, arrived);
    expect(who.options.map((o) => o.label).sort()).toEqual(['Legend 0', 'Legend 1', 'Legend 2']);
    expect(new Set(who.options.map((o) => o.baseWeight)).size).toBe(1); // equal slices

    // Spinning it picks who appears; nothing is recorded but the pick.
    const picked = spinAdventure(arrived, GAME_CONFIG, withLegends, createSeededRng(3));
    expect(picked.state.currentStepId).toBe('legend');
    expect(picked.state.cast?.character.name).toBe(picked.roll.winner.option.label);
    expect(picked.state.rolls).toEqual(arrived.rolls);
    const met = spinAdventure(picked.state, GAME_CONFIG, withLegends, createSeededRng(4)).state;
    expect(met.rolls.at(-1)).toMatchObject({ stepId: 'legend', cast: picked.roll.winner.option.label });
  });

  it('lets a lone candidate simply appear', () => {
    const { w, hero: h } = hero(14);
    const legend = { ...soul(301), name: 'Only One', status: 'retired' as const };
    const road = { ...startAdventure(GAME_CONFIG, h), currentStepId: 'road' };
    const onlyLegend = { ...GAME_CONFIG, steps: { ...GAME_CONFIG.steps, road: { ...getStep(GAME_CONFIG, 'road'), options: [getStep(GAME_CONFIG, 'road').options.find((o) => o.id === 'old_legend')!] } } };
    const arrived = spinAdventure(road, onlyLegend, { ...w, hallOfFame: [legend] }, createSeededRng(2)).state;
    expect(arrived.currentStepId).toBe('legend');
    expect(arrived.cast?.character.name).toBe('Only One');
  });

  it('gives an adventure title once it outranks every title earned', () => {
    const { hero: h } = hero(15);
    const champion = earnedTitle(GAME_CONFIG, h, [{ stepId: 'fight_tournament', optionId: 'glory', probability: 0.1 }]);
    expect(champion).toBe(h.title && /Demon Lord|Archmage|Holy Sword/.test(h.title) ? h.title : champion);
    const humble = { ...h, history: [] };
    expect(earnedTitle(GAME_CONFIG, humble, [{ stepId: 'fight_tournament', optionId: 'glory', probability: 0.1 }])).toBe('Champion of the Realm');
  });

  it('meets the road home when an adventure would end after a spin or two, and only once', () => {
    const { w, hero: h } = hero(16);
    const state: AdventureState = { ...startAdventure(GAME_CONFIG, h), currentStepId: 'study' };
    const after = spinAdventure(state, GAME_CONFIG, w, createSeededRng(5)).state;
    expect(after.currentStepId).toBe('road_home');
    const tale = { ...GAME_CONFIG, steps: { ...GAME_CONFIG.steps, road_home: { ...getStep(GAME_CONFIG, 'road_home'), options: getStep(GAME_CONFIG, 'road_home').options.filter((o) => o.id === 'tavern_tale') } } };
    const home = spinAdventure(after, tale, w, createSeededRng(5)).state;
    expect(home.currentStepId).toBeNull();
  });

  it('brings a hero home with the fame they earned, and never with none', () => {
    const { w, hero: h } = hero(16);
    const long = [1, 2, 3].map((n) => ({ stepId: `earlier_${n}`, optionId: 'x', probability: 1 }));
    const quiet = { ...GAME_CONFIG, steps: { ...GAME_CONFIG.steps, study: { ...getStep(GAME_CONFIG, 'study'), options: [{ id: 'quiet', label: 'Quiet', baseWeight: 1, fame: 0, nextStepId: null }] } } };
    const state: AdventureState = { ...startAdventure(quiet, h), currentStepId: 'study', rolls: long };
    const after = spinAdventure(state, quiet, w, createSeededRng(5)).state;
    expect(after.currentStepId).toBeNull();
    expect(after.fameEarned).toBe(quiet.fame.floor);
    expect(after.rolls.at(-1)?.fame).toBe(quiet.fame.floor);
    expect(after.character.fame).toBe(h.fame + after.fameEarned);
  });
});

describe('validation of the new rules', () => {
  it('rejects queued spins on unknown wheels and unknown archetypes', () => {
    const bad = { id: 'x', label: 'X', baseWeight: 1, queueSpins: { nowhere: 1 }, setArchetype: 'jester', nextStepId: null };
    const broken = { ...GAME_CONFIG, steps: { ...GAME_CONFIG.steps, ruins: { ...getStep(GAME_CONFIG, 'ruins'), options: [...getStep(GAME_CONFIG, 'ruins').options, bad] } } };
    expect(validateGameConfig(broken).errors).toEqual(['ruins › x: unknown archetype "jester".', 'ruins › x: queues spins on unknown wheel "nowhere".']);
  });

  it('accepts the sample config with no warnings', () => {
    expect(validateGameConfig(GAME_CONFIG)).toEqual({ errors: [], warnings: [] });
  });
});

describe('stats, spells and traits on the wheels', () => {
  const fighter = (stats: Partial<Character['stats']>, extra: Partial<Character> = {}): Character => ({
    ...soul(),
    status: 'alive',
    stats: { ...soul().stats, ...stats },
    ...extra,
  });

  it('scales a weapon with the better of Might and Agility, and spells with Arcana', () => {
    const strong = fighter({ might: 20, agility: 12 }, { weaponTier: 4 });
    expect(getPowerBreakdown(strong)).toMatchObject({ weapon: 150, weaponScale: 1.5 }); // 4 × 25 × 1.5
    const nimble = fighter({ might: 4, agility: 16 }, { weaponTier: 4 });
    expect(getPowerBreakdown(nimble).weapon).toBe(130); // agility 16: ×1.3

    const fireball = GAME_CONFIG.traits['fireball']!;
    expect(fireball.scalesWith).toEqual(['arcana']);
    expect(traitPower(fireball, fighter({ arcana: 20 }))).toBe(Math.round(fireball.power * 1.5));
    expect(traitPower(fireball, fighter({ arcana: 4 }))).toBe(Math.round(fireball.power * 0.7));
    expect(traitPower(GAME_CONFIG.traits['dragonslayer']!, fighter({ arcana: 20 }))).toBe(GAME_CONFIG.traits['dragonslayer']!.power); // not a spell
  });

  it('makes a fight’s glory likelier with Intellect, without changing the chance to win', () => {
    const guardian = getStep(GAME_CONFIG, 'fight_guardian');
    const odds = (c: Character) => resolveSlices(dealOptions(guardian, c, GAME_CONFIG), world(), c);
    const glory = (c: Character) => odds(c).find((s) => s.option.id === 'glory')!.probability;
    const winning = (c: Character) => odds(c).filter((s) => s.option.fight === 'win').reduce((sum, s) => sum + s.probability, 0);

    const dull = fighter({ intellect: 4 });
    const sharp = fighter({ intellect: 20 });
    expect(glory(sharp)).toBeGreaterThan(glory(dull) * 1.5);
    // The same CP either way (stats sum alike), so the same chance to win.
    const dullEven = { ...dull, stats: { ...dull.stats, might: dull.stats.might + 16 } };
    expect(winning(sharp)).toBeCloseTo(winning(dullEven), 9);
  });

  it('deals trait-specific outcomes only to those with the trait', () => {
    const ruins = (c: Character) => dealOptions(getStep(GAME_CONFIG, 'ruins'), c, GAME_CONFIG).map((o) => o.id);
    const plain = fighter({});
    expect(ruins(plain)).not.toContain('picked_the_vault');
    const thief = take(plain, 'skills', 'lockpicking');
    expect(ruins(thief)).toContain('picked_the_vault');

    // In a fight, a trait win is a way to win: it shares the win side, scaled by the hero's odds.
    const archer = take(plain, 'skills', 'archery');
    const wyvern = resolveSlices(dealOptions(getStep(GAME_CONFIG, 'fight_wyvern'), archer, GAME_CONFIG), world(), archer);
    expect(wyvern.find((s) => s.option.id === 'shot_down')).toMatchObject({ locked: false, option: { fight: 'win', rarity: 'rare' } });
    expect(wyvern.map((s) => s.index)).toEqual(wyvern.map((_, i) => i)); // positions follow the dealt list
  });

  it('lets a phylactery or Resurrection cheat death, like Iron Will', () => {
    const lich = take(take(take(soul(), 'ancestry', 'monster'), 'monster_type', 'skeleton'), 'undeath', 'spark_of_sorcery');
    const slain = resolveSlices(dealOptions(getStep(GAME_CONFIG, 'fight_dragon'), lich, GAME_CONFIG), world(), lich).find((s) => s.option.id === 'slain')!;
    expect(slain).toMatchObject({ locked: true, lockReason: 'Phylactery: their soul is kept elsewhere. They reform.' });
  });

  it('rejects trait outcomes and stat scaling that name things that don’t exist', () => {
    const bad = { id: 'x', label: 'X', baseWeight: 1, requiresTrait: ['juggling'], statScaling: { charm: 0.1 } as never, nextStepId: null };
    const broken = { ...GAME_CONFIG, steps: { ...GAME_CONFIG.steps, ruins: { ...getStep(GAME_CONFIG, 'ruins'), options: [...getStep(GAME_CONFIG, 'ruins').options, bad] } } };
    expect(validateGameConfig(broken).errors).toEqual(['ruins › x: requires unknown trait "juggling".', 'ruins › x: statScaling names unknown stat "charm".']);
  });
});

describe('spells: bonus, mastery, names', () => {
  it('teaches a spell to a soul born with strong Arcana', () => {
    const human = take(soul(), 'ancestry', 'human');
    const arcana = (value: number) => getStep(GAME_CONFIG, 'stat_arcana_human').options.find((o) => o.setStats?.arcana === value)!;
    expect(arcana(BONUS_SPELL_ARCANA).queueSpins).toEqual({ arcane_powers: 1 });
    expect(arcana(BONUS_SPELL_ARCANA - 1).queueSpins).toBeUndefined();
    const gifted = take(human, 'stat_arcana_human', arcana(BONUS_SPELL_ARCANA).id);
    expect(gifted.spinQueue).toEqual(['arcane_powers']);
    // Training Arcana later teaches nothing extra.
    expect(getStep(GAME_CONFIG, 'train_arcana_human').options.some((o) => o.queueSpins)).toBe(false);
  });

  it('rolls a mastery for every power learned, honing that power', () => {
    const arcane = getStep(GAME_CONFIG, 'arcane_powers');
    expect(arcane.options.find((o) => o.id === 'fireball')!.nextStepId).toBe('power_mastery');
    const caster = take(soul(), 'arcane_powers', 'fireball');
    const honed = take(caster, 'power_mastery', 'virtuoso');
    const fireball = honed.traits.find((t) => t.id === 'fireball')!;
    expect(fireball).toMatchObject({ rank: 'Virtuoso', power: Math.round(GAME_CONFIG.traits['fireball']!.power * 1.75) });
    // Strong Arcana makes the top ranks likelier.
    const sharp = { ...caster, stats: { ...caster.stats, arcana: 24 } };
    expect(chance('power_mastery', 'paragon', sharp)).toBeGreaterThan(chance('power_mastery', 'paragon', caster) * 1.4);
  });

  it('names any stat value, with a race’s own names and Ascension tiers', () => {
    const name = GAME_CONFIG.statName!;
    const human = take(soul(), 'ancestry', 'human');
    const minotaur = take(take(soul(), 'ancestry', 'monster'), 'monster_type', 'minotaur');
    expect(name('might', 10, human)).toBe('Average');
    expect(name('might', 25, human)).toBe('Titanic');
    expect(name('might', 25, minotaur)).toBe('Battle Ram');
    expect(name('might', 27, human)).toBe('Titanic');
    expect(name('might', 50, human)).toBe('Worldbreaker');
    expect(name('might', 0, human)).toBe('Powerless');
  });
});

describe('powers keep their promise', () => {
  it('teaches a power on every spin of a power wheel, until every power there is known', () => {
    const char: Character = { ...soul(), status: 'alive' };
    expect(chance('corrupted_powers', 'surge', char)).toBe(0);
    const step = getStep(GAME_CONFIG, 'corrupted_powers');
    const allKnown = step.options.filter((o) => o.id !== 'surge').reduce<Character>((c, o) => take(c, step.id, o.id), char);
    expect(chance('corrupted_powers', 'surge', allKnown)).toBe(1);
  });

  it('leaves a debt when the Abyss answers, which Unfinished Business collects', () => {
    const taught = take({ ...soul(), status: 'alive' }, 'power_school', 'corrupted');
    expect(taught.tags).toContain('hook:abyss_debt');
    expect(GAME_CONFIG.hooks?.['hook:abyss_debt']).toBeDefined();
    expect(chance('crossroads', 'unfinished_business', taught)).toBeGreaterThan(0);
    const w = world();
    expect(resolveNextStep(getStep(GAME_CONFIG, 'crossroads').options.find((o) => o.id === 'unfinished_business')!.nextStepId, w, taught)).toBe('abyss_collects');
    expect(take(taught, 'abyss_collects', 'paid_in_luck').tags).not.toContain('hook:abyss_debt');
  });
});

describe('who they are tilts the crossroads', () => {
  it('bends the crossroads by personality, as it does by archetype', () => {
    const base: Character = { ...soul(), status: 'alive', personality: null, archetype: null };
    expect(chance('crossroads', 'make_ally', { ...base, personality: 'kind' })).toBeGreaterThan(chance('crossroads', 'make_ally', base));
    expect(chance('crossroads', 'make_ally', { ...base, personality: 'cruel' })).toBeLessThan(chance('crossroads', 'make_ally', base));
  });
});
