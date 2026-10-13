/**
 * Armour, fame's endings, and what heroes leave behind (graves, rivals, townsfolk, rulers,
 * sealed relics): the engine features they rely on, through the sample config.
 */
import { describe, expect, it } from 'vitest';
import { graves, martyrs, rivals, rulers, sealedSouls, townsfolk } from '../config/common';
import { GAME_CONFIG as SAMPLE_CONFIG } from '../config/gameConfig';
import type { GameConfig } from './types';
import { learnTechnique, takeEverything } from '../config/legacy';
import { completeAdventure, getAdventureStep, spinAdventure, startAdventure, type AdventureState } from './adventure';
import { MAX_ARMOR_TIER, applyEffects, createCharacter } from './character';
import { getStep, rollFullCharacter } from './generation';
import { calculatePowerRating } from './power';
import { createSeededRng } from './rng';
import { resolveSlices } from './roll';
import type { Character, Trait, World } from './types';
import { validateGameConfig } from './validate';
import { createWorld, placeCharacter } from './world';

/** These tests walk single wheels, so a short adventure must end where its wheel says: no road home. */
const GAME_CONFIG: GameConfig = { ...SAMPLE_CONFIG, adventure: { ...SAMPLE_CONFIG.adventure, roadHome: undefined } };

const trait = (id: string): Trait => GAME_CONFIG.traits[id]!;

/** A soul in the world, alive unless the patch says otherwise. */
function soul(seed: number, patch: Partial<Character> = {}): Character {
  return { ...createCharacter(GAME_CONFIG, { name: `Soul ${seed}`, rng: createSeededRng(seed), now: 0 }), status: 'alive', ...patch };
}

/** A world holding exactly these characters, each filed where their status says. */
function worldOf(...chars: Character[]): World {
  return chars.reduce((w, c) => placeCharacter(w, c), createWorld({ rng: createSeededRng(1), now: 0 }));
}

/** Land `hero` on one option of one wheel, as if the wheel had picked it, with `cast` featured. */
function land(hero: Character, stepId: string, optionId: string, world: World, cast: Character | null = null): AdventureState {
  const step = getStep(GAME_CONFIG, stepId);
  const option = step.options.find((o) => o.id === optionId);
  if (!option) throw new Error(`no option ${stepId} › ${optionId}`);
  const rigged = { ...GAME_CONFIG, steps: { ...GAME_CONFIG.steps, [stepId]: { ...step, options: [option] } } };
  const start: AdventureState = { ...startAdventure(rigged, hero), currentStepId: stepId, cast: cast && { stepId, character: cast } };
  return spinAdventure(start, rigged, world, createSeededRng(2)).state;
}

describe('armour', () => {
  it('dresses every hero after the Armory (and the Holy Sword bearer instead of it)', () => {
    const rng = createSeededRng(3);
    const world = worldOf();
    for (let i = 0; i < 40; i++) {
      const { character } = rollFullCharacter(GAME_CONFIG, world, rng, { now: 0 });
      const path = character.history.map((h) => h.stepId);
      if (character.role === 'demonLord') expect(path).not.toContain('outfitter');
      else expect(path).toContain('outfitter');
      if (path.includes('armory')) expect(path.indexOf('outfitter')).toBe(path.indexOf('armory') + 1);
    }
  });

  it('keeps armour between bare and the best there is', () => {
    const base = soul(4);
    const up = { id: 'up', label: 'Up', baseWeight: 1, armorTierDelta: 99, nextStepId: null };
    expect(applyEffects(base, up, 'x', GAME_CONFIG).armorTier).toBe(MAX_ARMOR_TIER);
    expect(applyEffects({ ...base, armorTier: 2 }, { ...up, armorTierDelta: -5 }, 'x', GAME_CONFIG).armorTier).toBe(0);
  });
});

describe('taking from the dead and the living', () => {
  const dead = soul(10, {
    status: 'fallen',
    weaponTier: 7,
    armorTier: 5,
    traits: [trait('legendary_weapon'), trait('holy_sword'), trait('skill_tracking')],
    fate: { at: 1, summary: 'Fell on adventure 4' },
  });
  const hero = soul(11, { weaponTier: 2, armorTier: 1, fame: 10 });

  it('hands over a grave’s gear and items to whoever robs it, and the dead keep nothing', () => {
    const world = worldOf(hero, dead);
    const state = land(hero, 'grave', 'took_their_gear', world, dead);
    expect(state.character).toMatchObject({ weaponTier: 7, armorTier: 5, fame: 8 }); // grave robbing costs a little fame
    const blade = state.character.traits.find((t) => t.id === 'legendary_weapon');
    expect(blade?.description).toMatch(/Taken from Soul 10\.$/);
    expect(state.character.traits.some((t) => t.id === 'holy_sword')).toBe(false); // it will not serve a thief
    expect(state.character.traits.some((t) => t.id === 'skill_tracking')).toBe(false); // skills are not items
    expect(state.rolls.at(-1)?.note).toBe('Took Legendary Weapon, a tier 7 weapon and tier 5 armour from Soul 10');

    const after = completeAdventure(world, state, 1);
    const robbed = after.graveyard.find((c) => c.id === dead.id)!;
    expect(robbed).toMatchObject({ weaponTier: 0, armorTier: 0 });
    expect(robbed.traits.map((t) => t.id)).toEqual(['holy_sword', 'skill_tracking']);
  });

  it('says so when there is nothing better to take', () => {
    const rich = { ...hero, weaponTier: 9, armorTier: 9, traits: [trait('legendary_weapon')] };
    const spoils = takeEverything(dead, rich);
    expect(spoils.summary).toBe('Soul 10 carried nothing better than what they already had');
    expect(spoils.traits).toEqual([]);
    expect(spoils.effect?.loseTraits).toEqual(['legendary_weapon']); // taken all the same
  });

  it('lets an honourable hero pay respects, but never rob a grave', () => {
    const honest = { ...hero, personality: 'honorable' };
    const grave = getAdventureStep(GAME_CONFIG, 'grave', { cast: { stepId: 'grave', character: dead }, character: honest });
    const rob = resolveSlices(grave.options, worldOf(honest, dead), honest).find((s) => s.option.id === 'took_their_gear')!;
    expect(rob.locked).toBe(true);
  });

  it('teaches a master’s best technique at three quarters of their power', () => {
    const master = soul(12, { traits: [{ ...trait('fireball'), power: 60, rank: 'Virtuoso' }, trait('skill_tracking'), trait('legendary_weapon')] });
    expect(learnTechnique(master, hero).traits).toEqual([{ ...trait('fireball'), power: 45, rank: 'Taught by Soul' }]);
    const knowsFire = { ...hero, traits: [trait('fireball')] };
    expect(learnTechnique(master, knowsFire).traits?.[0]?.id).toBe('skill_tracking');
    expect(learnTechnique(soul(13), hero)).toEqual({ summary: 'Soul 13 had nothing left to teach them that they didn’t already know' });
  });
});

describe('meeting the world’s past heroes', () => {
  it('never casts the hero as their own rival', () => {
    const hero = soul(20);
    const other = soul(21);
    expect(rivals(worldOf(hero, other), hero).map((c) => c.id)).toEqual([other.id]);
    const road = resolveSlices(getStep(GAME_CONFIG, 'road').options, worldOf(hero), hero);
    expect(road.find((s) => s.option.id === 'rival_on_the_road')?.locked).toBe(true);
  });

  it('deals a settled hero’s trade only when that is what they do now', () => {
    const smith = soul(22, { role: 'npc', traits: [trait('npc_blacksmith')] });
    const bard = soul(23, { role: 'npc', traits: [trait('npc_bard')] });
    const ids = (cast: Character | null) =>
      getAdventureStep(GAME_CONFIG, 'townsfolk', { cast: cast && { stepId: 'townsfolk', character: cast }, character: soul(99) }).options.map((o) => o.id);
    expect(ids(smith)).toContain('reforged');
    expect(ids(smith)).not.toContain('their_song');
    expect(ids(bard)).toContain('their_song');
    expect(ids(null)).toEqual(['swapped_stories', 'one_last_adventure', 'robbed_them', 'murdered_them']);
  });

  it('lets a dark heart murder a rival for what they carry', () => {
    const cruel = soul(24, { personality: 'cruel', weaponTier: 1 });
    const rival = soul(25, { weaponTier: 6, fame: 30 });
    const world = worldOf(cruel, rival);
    const state = land(cruel, 'rival', 'betrayed', world, rival);
    expect(state.character.tags).toContain('kinslayer');
    expect(state.character.weaponTier).toBe(6);
    const after = completeAdventure(world, state, 3);
    expect(after.graveyard.find((c) => c.id === rival.id)).toMatchObject({ status: 'fallen', weaponTier: 0, fate: { summary: `Murdered by ${cruel.name}` } });
  });

  it('binds two heroes who swear brotherhood, both of them', () => {
    const a = soul(26);
    const b = soul(27);
    const world = worldOf(a, b);
    const after = completeAdventure(world, land(a, 'rival', 'swore_brotherhood', world, b));
    for (const id of [a.id, b.id]) expect(after.roster.find((c) => c.id === id)?.traits.map((t) => t.id)).toContain('blood_brother');
  });

  it('weighs a duel with a rival at their own Combat Power, and pays fame for it', () => {
    const hero = soul(28);
    const rival = soul(29, { weaponTier: 4 });
    const state = land(hero, 'fight_rival', 'glory', worldOf(hero, rival), rival);
    expect(state.rolls.at(-1)?.fame).toBe(Math.round((calculatePowerRating(rival) / 25) * 2));
    expect(state.character.weaponTier).toBe(4); // won their blade
  });
});

describe('endings', () => {
  const renowned = (seed: number, patch: Partial<Character> = {}) => soul(seed, { fame: 40, ...patch });

  it('turns a hero into a mentor who stays in the world, and whom others can learn from', () => {
    const hero = renowned(30, { traits: [trait('skill_archery')] });
    const world = worldOf(hero);
    const state = land(hero, 'destiny', 'take_an_apprentice', world);
    expect(state.currentStepId).toBeNull();
    const after = completeAdventure(world, state);
    const mentor = after.roster.find((c) => c.id === hero.id)!;
    expect(mentor).toMatchObject({ role: 'npc', status: 'alive', title: 'Mentor of Heroes' });
    expect(mentor.tags).toContain('mentor');
    expect(mentor.adventures.at(-1)).toMatchObject({ outcome: 'turned', turnedTo: 'npc', note: 'Laid down the sword to teach the next generation' });
    expect(townsfolk(after).map((c) => c.id)).toEqual([mentor.id]);

    const student = soul(31);
    const lesson = land(student, 'townsfolk', 'one_more_lesson', placeCharacter(after, student), mentor);
    expect(lesson.character.traits.at(-1)).toMatchObject({ id: 'skill_archery', rank: 'Taught by Soul' });
  });

  it('crowns a hero ruler of one particular place, which no one else can then claim', () => {
    const hero = renowned(32);
    const world = worldOf(hero);
    const after = completeAdventure(world, land(hero, 'thrones', 'ironhold', world));
    expect(after.activeSingletons['throne_ironhold']).toBe(hero.id);
    expect(rulers(after).map((c) => c.id)).toEqual([hero.id]);
    expect(after.roster[0]?.title).toBe('Thane of Ironhold');
    expect(after.roster[0]?.fate).toBeUndefined(); // still in the world, ruling

    const next = renowned(33);
    const thrones = resolveSlices(getStep(GAME_CONFIG, 'thrones').options, placeCharacter(after, next), next);
    expect(thrones.find((s) => s.option.id === 'ironhold')).toMatchObject({ locked: true, lockReason: 'Ironhold already has a ruler' });
    expect(thrones.find((s) => s.option.id === 'frontier')?.locked).toBe(false); // the frontier has room for anyone
  });

  it('lets a hero give their life (Iron Will or not), and makes their grave a shrine', () => {
    const hero = renowned(34, { traits: [trait('iron_will')] });
    const world = worldOf(hero);
    const stand = resolveSlices(getStep(GAME_CONFIG, 'destiny').options, world, hero).find((s) => s.option.id === 'the_last_stand')!;
    expect(stand.locked).toBe(false); // a choice, not a defeat
    const after = completeAdventure(world, land(hero, 'destiny', 'the_last_stand', world), 7);
    expect(after.graveyard[0]).toMatchObject({ status: 'fallen', fate: { at: 7, summary: 'Held the gate alone, so that a city could flee' } });
    expect(martyrs(after).map((c) => c.id)).toEqual([hero.id]);
    expect(graves(after)).toHaveLength(1);
  });

  it('seals a soul in a relic, for another hero to claim, free, or be taken by', () => {
    const hero = renowned(35, { weaponTier: 8 });
    const world = worldOf(hero);
    const sealed = completeAdventure(world, land(hero, 'destiny', 'bound_to_a_relic', world));
    const soulInside = sealed.hallOfFame[0]!;
    expect(soulInside).toMatchObject({ status: 'sealed', fate: { summary: 'Bound their soul into a relic, to fight on in other hands' } });
    expect(sealedSouls(sealed)).toHaveLength(1);

    // Claimed: their power goes with the relic, and nobody else will find it.
    const finder = soul(36);
    const w2 = placeCharacter(sealed, finder);
    const claimed = land(finder, 'soul_relic', 'claimed_it', w2, soulInside);
    const relic = claimed.character.traits.find((t) => t.id === `soulbound_${soulInside.id}`)!;
    expect(relic).toMatchObject({ item: 'relic', power: Math.max(20, Math.round(calculatePowerRating(soulInside) / 4)) });
    expect(sealedSouls(completeAdventure(w2, claimed))).toEqual([]);

    // Freed: back in the world as a hero.
    const freed = completeAdventure(w2, land(finder, 'soul_relic', 'freed_them', w2, soulInside));
    const walksFree = freed.roster.find((c) => c.id === soulInside.id);
    expect(walksFree).toMatchObject({ status: 'alive', role: 'hero' });
    expect(walksFree?.fate).toBeUndefined();

    // Possessed: the spirit walks out in the finder's place.
    const swapped = completeAdventure(w2, land(finder, 'soul_relic', 'possessed', w2, soulInside));
    expect(swapped.roster.find((c) => c.id === soulInside.id)?.status).toBe('alive');
    expect(swapped.hallOfFame.find((c) => c.id === finder.id)?.status).toBe('sealed');
  });

  it('lets a famous hero slay the Demon Lord: victory, and the Abyss’s throne stands empty', () => {
    const lord = soul(37, { role: 'demonLord', singletonClaims: ['demon_lord'] });
    const hero = renowned(38);
    const world = { ...worldOf(lord, hero), activeSingletons: { demon_lord: lord.id } };
    const fight = getAdventureStep(GAME_CONFIG, 'fight_demon_lord', { cast: { stepId: 'fight_demon_lord', character: lord }, character: hero });
    expect(fight.foe).toEqual({ name: lord.name, power: calculatePowerRating(lord) });

    const state = land(hero, 'fight_demon_lord', 'glory', world, lord);
    expect(state.character.status).toBe('victorious');
    const after = completeAdventure(world, state, 9);
    expect(after.hallOfFame.find((c) => c.id === hero.id)).toMatchObject({ status: 'victorious', fate: { summary: 'Slew the Demon Lord, and ended the long night' } });
    expect(after.graveyard.find((c) => c.id === lord.id)?.fate?.summary).toBe(`Slain by ${hero.name}`);
    expect(after.activeSingletons).toEqual({});
  });

  it('crowns the one who wins an empty throne, on a throne of their choosing', () => {
    const glory = getStep(GAME_CONFIG, 'fight_usurper').options.find((o) => o.id === 'glory')!;
    expect(glory.nextStepId).toBe('thrones');
  });
});

describe('mentors teach only what they know', () => {
  it('gives each mentor their own lessons: the spymaster teaches locks and shadows, not swords', () => {
    const ids = getStep(GAME_CONFIG, 'lesson_spymaster').options.map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining(['lockpicking', 'stealth', 'disguise', 'diplomacy', 'train_agility', 'train_intellect']));
    expect(ids).not.toContain('swordplay');
    expect(ids).not.toContain('train_might');
    expect(ids).not.toContain('magic'); // no magic to teach
    expect(getStep(GAME_CONFIG, 'lesson_hermit_mage').options.find((o) => o.id === 'magic')?.nextStepId).toBe('arcane_powers');
  });

  it('trains a stat only up to the mentor’s own level', () => {
    const step = getStep(GAME_CONFIG, 'lesson_swordmaster');
    const lesson = step.options.find((o) => o.id === 'train_might')!; // a swordmaster stands at 18 Might
    const at17 = soul(50, { stats: { might: 17, agility: 10, intellect: 10, arcana: 10, vitality: 10 } });
    expect(applyEffects(at17, lesson, step.id, GAME_CONFIG).stats.might).toBe(18); // +2, stopped at 18
    const at18 = { ...at17, stats: { ...at17.stats, might: 18 } };
    const slice = resolveSlices([lesson], worldOf(at18), at18)[0]!;
    expect(slice).toMatchObject({ locked: true, lockReason: 'They can’t teach Might past 18 (you have 18)' });
    const known = { ...at17, traits: [trait('skill_swordplay')] };
    expect(resolveSlices(step.options, worldOf(known), known).find((s) => s.option.id === 'swordplay')?.locked).toBe(true);
  });

  it('lets a living legend teach their own skills, and stats only where they stand above the student', () => {
    const legend = soul(51, { status: 'retired', stats: { might: 16, agility: 8, intellect: 10, arcana: 10, vitality: 10 }, traits: [trait('skill_lockpicking')] });
    const student = soul(52, { stats: { might: 15, agility: 12, intellect: 10, arcana: 10, vitality: 10 } });
    const ids = getAdventureStep(GAME_CONFIG, 'mentor_legend', { cast: { stepId: 'mentor_legend', character: legend }, character: student }).options.map((o) => o.id);
    expect(ids).toContain('skill_lockpicking');
    expect(ids).not.toContain('skill_swordplay');
    expect(ids).toContain('train_might');
    expect(ids).not.toContain('train_agility'); // the student is already better
    const trained = land(student, 'mentor_legend', 'train_might', worldOf(student, legend), legend);
    expect(trained.character.stats.might).toBe(16); // one point: as far as the legend's own 16
    expect(trained.rolls.at(-1)?.note).toBe(`Trained Might to 16 under ${legend.name}, who stands at 16`);
  });
});

describe('a stat worn down to nothing', () => {
  it('kills the hero, whatever the roll meant to do', () => {
    const frail = soul(40, { stats: { might: 10, agility: 10, intellect: 10, arcana: 10, vitality: 1 } });
    const world = worldOf(frail);
    const state = land(frail, 'tame_beast', 'mauled', world); // −1 Vitality (and two wounds)
    expect(state.character.status).toBe('fallen');
    expect(state.currentStepId).toBeNull();
    const after = completeAdventure(world, state, 4);
    expect(after.graveyard[0]?.fate).toEqual({ at: 4, summary: 'Their vitality gave out entirely' });
  });

  it('leaves a hero with something left standing', () => {
    const sturdy = soul(41, { stats: { might: 10, agility: 10, intellect: 10, arcana: 10, vitality: 3 } });
    expect(land(sturdy, 'tame_beast', 'mauled', worldOf(sturdy)).character.status).toBe('alive');
  });
});

describe('validation of legacies', () => {
  it('rejects spoils and cast conditions on a wheel that casts no one, and fame tiers out of order', () => {
    const study = getStep(GAME_CONFIG, 'study');
    const bad = { id: 'x', label: 'X', baseWeight: 1, spoils: takeEverything, castCondition: () => true, nextStepId: null };
    const broken = { ...GAME_CONFIG, steps: { ...GAME_CONFIG.steps, study: { ...study, options: [...study.options, bad] } } };
    expect(validateGameConfig(broken).errors).toEqual([
      'study › x: spoils need a wheel that casts a character.',
      'study › x: a cast condition needs a wheel that casts a character.',
    ]);
    const tiers = [{ name: 'Low', min: 0 }, { name: 'High', min: 10 }, { name: 'Lower', min: 5 }];
    expect(validateGameConfig({ ...GAME_CONFIG, fame: { ...GAME_CONFIG.fame, tiers } }).errors).toEqual([
      'fame.tiers[2] ("Lower"): each tier must start higher than the one before.',
    ]);
  });
});
