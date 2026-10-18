/**
 * Quests: decisions on choice wheels, the story a quest remembers, rivals that grow out of
 * what the hero does, consequences that come due, and a finale shaped by all of it.
 */
import { describe, expect, it } from 'vitest';
import { GAME_CONFIG as SAMPLE_CONFIG } from '../config/gameConfig';
import type { GameConfig } from './types';
import { chooseAdventure, completeAdventure, getAdventureStep, rollFullAdventure, spinAdventure, startAdventure, type AdventureState } from './adventure';
import { createCharacter } from './character';
import { EngineError } from './errors';
import { getStep } from './generation';
import { dealOptions } from './odds';
import { calculatePowerRating } from './power';
import { createSeededRng } from './rng';
import { resolveSlices } from './roll';
import { RIVAL_MAX_ESCALATIONS, applyStory } from './story';
import type { Character, Rival, StoryState, World } from './types';
import { validateGameConfig } from './validate';
import { createWorld, placeCharacter } from './world';

/** These tests walk single wheels, so a short adventure must end where its wheel says: no road home. */
const GAME_CONFIG: GameConfig = { ...SAMPLE_CONFIG, adventure: { ...SAMPLE_CONFIG.adventure, roadHome: undefined } };

function soul(seed: number, patch: Partial<Character> = {}): Character {
  return { ...createCharacter(GAME_CONFIG, { name: `Soul ${seed}`, rng: createSeededRng(seed), now: 0 }), status: 'alive', ...patch };
}
function worldOf(threatLevel: number, ...chars: Character[]): World {
  return chars.reduce((w, c) => placeCharacter(w, c), { ...createWorld({ rng: createSeededRng(1), now: 0 }), threatLevel });
}
/** A quest under way, with these parts of its story already written. */
function questing(hero: Character, story: Partial<StoryState> = {}): Character {
  return {
    ...hero,
    story: { title: 'The Test', objective: 'Pass the test.', length: 6, beats: 2, threat: 0, flags: {}, log: [], seen: [], rival: null, ...story },
  };
}
const rival = (patch: Partial<Rival> = {}): Rival => ({
  name: 'Varn',
  title: 'the Humiliated Champion',
  motivation: 'Wounded pride',
  goal: 'To see you shamed',
  power: 200,
  stage: 1,
  escalations: 0,
  allies: 0,
  memory: ['You made them crawl.'],
  ...patch,
});
/** The hero arriving at a wheel mid-quest. */
const at = (hero: Character, stepId: string): AdventureState => ({ ...startAdventure(GAME_CONFIG, { ...hero, story: undefined }), character: hero, currentStepId: stepId });
/** Land on one option of a spun wheel, as if the wheel had picked it. */
function land(state: AdventureState, world: World, optionId: string): AdventureState {
  const step = getStep(GAME_CONFIG, state.currentStepId!);
  const rigged = { ...GAME_CONFIG, steps: { ...GAME_CONFIG.steps, [step.id]: { ...step, options: step.options.filter((o) => o.id === optionId) } } };
  return spinAdventure(state, rigged, world, createSeededRng(3)).state;
}
const weights = (hero: Character, world: World, stepId: string) =>
  Object.fromEntries(resolveSlices(dealOptions(getAdventureStep(GAME_CONFIG, stepId, { cast: null, character: hero }), hero, GAME_CONFIG), world, hero).map((s) => [s.option.id, s.effectiveWeight]));

describe('taking a quest', () => {
  it('starts from the crossroads, with an objective, a length of 5–7 and threat from the world', () => {
    const hero = soul(1);
    const world = worldOf(6, hero);
    expect(getStep(GAME_CONFIG, 'crossroads').options.find((o) => o.id === 'take_quest')?.nextStepId).toBe('quest_hook');
    const begun = land(at(hero, 'quest_hook'), world, 'siege');
    const story = begun.character.story!;
    expect(story).toMatchObject({ title: 'The Siege of Harrowgate', beats: 0, threat: 3, flags: { obj_siege: 1 }, rival: null });
    expect(story.length).toBeGreaterThanOrEqual(5);
    expect(story.length).toBeLessThanOrEqual(7);
    expect(begun.currentStepId).toBe('quest_road');
  });

  it('runs to a finale and files the tale with the adventure, never on the character', () => {
    const hero = soul(2);
    const world = worldOf(0, hero);
    const rng = createSeededRng(4);
    // Battles draw on the same stream, so give the road room to offer a quest.
    for (let i = 0; i < 200; i++) {
      const { state, spins } = rollFullAdventure(GAME_CONFIG, world, hero, rng);
      if (!state.character.story || state.character.status === 'fallen') continue;
      expect(spins.some((s) => s.step.id === 'quest_finale')).toBe(true);
      const after = completeAdventure(world, state);
      const back = after.roster.find((c) => c.id === hero.id)!;
      expect(back.story).toBeUndefined();
      expect(back.adventures.at(-1)?.quest).toMatchObject({ title: state.character.story.title, log: state.character.story.log });
      return;
    }
    throw new Error('no quest in 200 adventures');
  });
});

describe('decisions', () => {
  it('applies the player’s choice, marked as chosen, and refuses locked, unknown or spun ones', () => {
    const hero = questing(soul(3));
    const world = worldOf(0, hero);
    const out = chooseAdventure(at(hero, 'enc_relic'), GAME_CONFIG, world, 'leave_it');
    expect(out.roll.draw).toBe(-1);
    expect(out.state.rolls.at(-1)).toMatchObject({ stepId: 'enc_relic', optionId: 'leave_it', chosen: true });
    expect(out.state.character.story?.log.at(-1)).toBe('Left the Order’s relic where it belonged.');

    const error = (fn: () => unknown) => {
      try {
        fn();
      } catch (err) {
        return err instanceof EngineError ? err.code : 'other';
      }
      return 'none';
    };
    expect(error(() => chooseAdventure(at(hero, 'enc_witch_price'), GAME_CONFIG, world, 'pay_with_ally'))).toBe('INVALID_CHOICE'); // no ally to give
    expect(error(() => chooseAdventure(at(hero, 'enc_relic'), GAME_CONFIG, world, 'nonsense'))).toBe('INVALID_CHOICE');
    expect(error(() => chooseAdventure(at(hero, 'quest_road'), GAME_CONFIG, world, 'quiet'))).toBe('INVALID_CHOICE'); // a spun wheel
    expect(error(() => chooseAdventure(at(hero, 'enc_flood'), GAME_CONFIG, world, 'leave_gear'))).toBe('INVALID_CHOICE'); // routine encounters are spun now
  });
});

describe('rivals grow out of what the hero does', () => {
  it('makes a rival from humiliating a champion, at a share of the hero’s power, remembering why', () => {
    const hero = questing(soul(4));
    const world = worldOf(0, hero);
    const state = land(at(hero, 'q_champion_shame'), world, 'victory');
    const made = state.character.story!.rival!;
    expect(made).toMatchObject({ title: 'the Humiliated Champion', stage: 1, memory: ['You beat them, then made them crawl in front of their own men.'] });
    expect(made.power).toBe(calculatePowerRating(state.character));
    expect(state.character.story!.log.at(-1)).toBe(`Beat a champion and made them crawl. ${made.name} swore revenge.`);
  });

  it('makes only one rival a quest, escalates them only so far, and remembers what the hero does', () => {
    const hero = questing(soul(5), { rival: rival() });
    let c = applyStory(hero, { rival: { create: { title: 'Another', motivation: 'x', goal: 'y', grudge: 'z', power: 1 } } }, GAME_CONFIG, worldOf(0));
    expect(c.story!.rival!.name).toBe('Varn');
    for (let i = 0; i < 5; i++) c = applyStory(c, { rival: { escalate: {} } }, GAME_CONFIG, worldOf(0));
    expect(c.story!.rival).toMatchObject({ stage: 2, escalations: RIVAL_MAX_ESCALATIONS, power: Math.round(Math.round(200 * 1.15) * 1.15) });
    c = applyStory(c, { remember: 'Saw {hero} spare a beggar.' }, GAME_CONFIG, worldOf(0));
    expect(c.story!.rival!.memory.at(-1)).toBe('Saw Soul 5 spare a beggar.');
    c = applyStory(c, { rival: { resolve: 'Made peace with {hero}' } }, GAME_CONFIG, worldOf(0));
    expect(c.story!.rival).toMatchObject({ stage: 3, fate: 'Made peace with Soul 5' });
  });

  it('strikes back once a rival exists, and almost surely before the end', () => {
    const world = worldOf(0);
    const without = weights(questing(soul(6)), world, 'quest_road');
    expect(without['enc_rival_strikes']).toBe(0);
    const early = weights(questing(soul(6), { rival: rival(), beats: 1 }), world, 'quest_road');
    const late = weights(questing(soul(6), { rival: rival(), beats: 4 }), world, 'quest_road');
    expect(early['enc_rival_strikes']).toBeGreaterThan(0);
    expect(late['enc_rival_strikes']!).toBeGreaterThan(early['enc_rival_strikes']!);
  });

  it('fills in the rival’s name wherever the wheels mention them', () => {
    const hero = questing(soul(7), { rival: rival() });
    const step = getAdventureStep(GAME_CONFIG, 'enc_rival_strikes', { cast: null, character: hero });
    expect(step.subtitle).toBe('Varn has found them. They remember everything. How they meet it depends on who they are.');
  });
});

describe('consequences', () => {
  it('makes theft pay now and cost later: the relic, more threat, and a keeper who hunts it', () => {
    const hero = questing(soul(8));
    const state = land(at(hero, 'q_relic_steal'), worldOf(0, hero), 'stolen_clean');
    expect(state.character.traits.some((t) => t.id === 'veiled_relic')).toBe(true);
    expect(state.character.story).toMatchObject({ threat: 2, flags: { relic: 1 }, rival: { title: 'Keeper of the Veil' } });
    // Later, handing it back ends the raids and the power both.
    const gambit = land({ ...state, currentStepId: 'enc_rival_gambit' }, worldOf(0, hero), 'give_it_back');
    expect(gambit.character.traits.some((t) => t.id === 'veiled_relic')).toBe(false);
    expect(gambit.character.story?.threat).toBe(0);
  });

  it('brings a bargain’s price due before the end, every time', () => {
    const owing = questing(soul(9), { flags: { bargain: 1 }, beats: 5, length: 6 });
    const road = weights(owing, worldOf(0), 'quest_road');
    const total = Object.values(road).reduce((a, b) => a + b, 0);
    expect(road['enc_witch_price']! / total).toBeGreaterThan(0.85);
  });

  it('lets a legendary event darken the whole world, written when the adventure is', () => {
    const hero = soul(10);
    const world = worldOf(2, hero);
    const state = land(at(questing(hero, { beats: 3 }), 'q_events_legendary'), world, 'kingdom_turns');
    expect(state.worldThreat).toBe(1);
    const finished = { ...state, currentStepId: null };
    expect(completeAdventure(world, finished).threatLevel).toBe(3);
  });
});

describe('a finale shaped by the journey', () => {
  const world = worldOf(0);
  const share = (hero: Character, id: string) => {
    const w = weights(hero, world, 'quest_finale');
    return w[id]! / Object.values(w).reduce((a, b) => a + b, 0);
  };

  it('favours a duel when a rival with a long memory is still out there, and locks it when there is none', () => {
    expect(share(questing(soul(11)), 'fin_duel')).toBe(0);
    const grudge = questing(soul(11), { rival: rival({ memory: ['a', 'b', 'c', 'd'], escalations: 2 }) });
    expect(share(grudge, 'fin_duel')).toBeGreaterThan(0.5);
  });

  it('turns to a siege when the threat is high, and to an alliance against a forbidden being', () => {
    expect(share(questing(soul(12), { threat: 9 }), 'fin_siege')).toBeGreaterThan(share(questing(soul(12), { threat: 0 }), 'fin_siege'));
    expect(share(questing(soul(12), { flags: { catastrophe: 1, allies: 1 } }), 'fin_alliance')).toBeGreaterThan(0.6);
  });

  it('puts a rival still in play at the head of the enemy, and concludes them with it', () => {
    const hero = questing(soul(13), { rival: rival({ power: 300 }) });
    const plain = getAdventureStep(GAME_CONFIG, 'q_fin_siege_fight', { cast: null, character: questing(soul(13)) }).foe!;
    const led = getAdventureStep(GAME_CONFIG, 'q_fin_siege_fight', { cast: null, character: hero }).foe!;
    expect(led.name).toBe('Varn and the Besieging Host');
    expect(led.power).toBe(plain.power + 150);
    const won = land(at(hero, 'q_fin_siege_fight'), worldOf(0, hero), 'victory');
    expect(won.character.story?.rival?.fate).toBe('Stood against Soul 13 at the end of The Test, and lost');
    // The road would end here; first, the spoils of the siege.
    expect(won.currentStepId).toBe('spoils:q_fin_siege_fight');
    expect(won.spoils?.then).toBeNull();
  });

  it('opens choices from earlier decisions: the relic, allies, mercy', () => {
    const open = (hero: Character) =>
      Object.fromEntries(resolveSlices(getStep(GAME_CONFIG, 'fin_duel').options, world, hero).map((s) => [s.option.id, !s.locked]));
    expect(open(questing(soul(14), { rival: rival() }))).toEqual({ head_on: true, use_relic: false, call_allies: false, offer_mercy: false, before_the_gods: false });
    expect(open(questing(soul(14), { rival: rival(), flags: { relic: 1, allies: 2, mercy: 1 } }))).toEqual({ head_on: true, use_relic: true, call_allies: true, offer_mercy: true, before_the_gods: false });
    expect(open(questing(soul(14, { fame: 40 }), { rival: rival() })).before_the_gods).toBe(true); // the Famous get holy ground
  });
});

describe('validation of quests', () => {
  it('accepts fights against a foe worked out from the hero, and rejects removing unknown traits', () => {
    const flood = getStep(GAME_CONFIG, 'enc_flood');
    const bad = { id: 'x', label: 'X', baseWeight: 1, removeTraits: ['nothing_here'], nextStepId: null };
    const broken = { ...GAME_CONFIG, steps: { ...GAME_CONFIG.steps, enc_flood: { ...flood, options: [...flood.options, bad] } } };
    expect(validateGameConfig(broken).errors).toEqual(['enc_flood › x: removes unknown trait "nothing_here".']);
  });
});
