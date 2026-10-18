/**
 * Talents with a life after creation: Shadowstep slips past fights, Iron Will pays for never
 * resting, the Holy Sword is a 10 of 10, Blademasters walk the Way of the Blade, and Intellect
 * sharpens all Combat Power.
 */
import { describe, expect, it } from 'vitest';
import { GAME_CONFIG as SAMPLE_CONFIG } from '../config/gameConfig';
import { chooseAdventure, getAdventureStep, spinAdventure, startAdventure, type AdventureState } from './adventure';
import { createCharacter } from './character';
import { getStep } from './generation';
import { dealOptions } from './odds';
import { createSeededRng } from './rng';
import { resolveSlices } from './roll';
import type { Character, GameConfig, World } from './types';
import { validateGameConfig } from './validate';
import { createWorld, placeCharacter } from './world';

const GAME_CONFIG: GameConfig = { ...SAMPLE_CONFIG, adventure: { ...SAMPLE_CONFIG.adventure, roadHome: undefined } };
const trait = (id: string) => GAME_CONFIG.traits[id]!;

function soul(seed: number, patch: Partial<Character> = {}): Character {
  return { ...createCharacter(GAME_CONFIG, { name: `Soul ${seed}`, rng: createSeededRng(seed), now: 0 }), status: 'alive', ...patch };
}
const worldOf = (...chars: Character[]): World => chars.reduce((w, c) => placeCharacter(w, c), createWorld({ rng: createSeededRng(1), now: 0 }));
const at = (hero: Character, stepId: string): AdventureState => ({ ...startAdventure(GAME_CONFIG, hero), character: hero, currentStepId: stepId });
function land(state: AdventureState, world: World, optionId: string): AdventureState {
  const step = getStep(GAME_CONFIG, state.currentStepId!);
  const rigged = { ...GAME_CONFIG, steps: { ...GAME_CONFIG.steps, [step.id]: { ...step, options: step.options.filter((o) => o.id === optionId) } } };
  return spinAdventure(state, rigged, world, createSeededRng(3)).state;
}
const odds = (hero: Character, world: World, stepId: string) =>
  Object.fromEntries(resolveSlices(dealOptions(getStep(GAME_CONFIG, stepId), hero, GAME_CONFIG), world, hero).map((s) => [s.option.id, s.probability]));

describe('the config', () => {
  it('still validates', () => {
    expect(validateGameConfig(GAME_CONFIG).errors).toEqual([]);
  });
});

describe('Shadowstep', () => {
  const sneak = soul(1, { traits: [trait('shadowstep')] });
  const world = worldOf(sneak);

  it('stops before a fight to decide, naming the foe', () => {
    const state = land(at(sneak, 'crossroads'), world, 'tournament');
    expect(state.currentStepId).toBe('shadowstep');
    expect(state.evading?.stepId).toBe('fight_tournament');
    expect(getAdventureStep(GAME_CONFIG, 'shadowstep', state).subtitle).toContain('Tournament Champion');
  });

  it('never stops anyone without it', () => {
    const plain = soul(2);
    expect(land(at(plain, 'crossroads'), worldOf(plain), 'tournament').currentStepId).toBe('battle:fight_tournament');
  });

  it('goes straight to the fight for those who stand and fight', () => {
    const state = land(at(sneak, 'crossroads'), world, 'tournament');
    const fought = chooseAdventure(state, GAME_CONFIG, world, 'stand_and_fight', createSeededRng(4)).state;
    expect(fought.currentStepId).toBe('battle:fight_tournament');
    expect(fought.evading).toBeNull();
  });

  it('is an even 50/50 spin once they step into the shadows', () => {
    const state = chooseAdventure(land(at(sneak, 'crossroads'), world, 'tournament'), GAME_CONFIG, world, 'step_into_shadow').state;
    expect(state.currentStepId).toBe('shadowstep_roll');
    const p = odds(sneak, world, 'shadowstep_roll');
    expect(p['slipped_by']! + p['robbed_in_passing']!).toBeCloseTo(0.5, 9);
    expect(p['seen']).toBeCloseTo(0.5, 9);
    // Seen: the fight happens anyway.
    expect(land(state, world, 'seen').currentStepId).toBe('battle:fight_tournament');
    // Unseen: the fight never happens, and the road goes where the fight would have led (home).
    const escaped = land(state, world, 'slipped_by');
    expect(escaped.currentStepId).toBeNull();
    expect(escaped.rolls.some((r) => r.stepId === 'fight_tournament')).toBe(false);
    expect(escaped.character.meters?.wounds ?? 0).toBe(0);
  });
});

describe('Iron Will', () => {
  it('no longer keeps them from dying of their wounds', () => {
    const stubborn = soul(3, { traits: [trait('iron_will')] });
    expect(odds(stubborn, worldOf(stubborn), 'festering')['died_of_wounds']).toBeGreaterThan(0);
  });
});

describe('the Holy Sword', () => {
  it('is a 10 of 10 weapon', () => {
    const option = getStep(GAME_CONFIG, 'talents').options.find((o) => o.id === 'holy_sword')!;
    expect(option.gear?.weapon).toEqual({ unique: 'holy_sword' });
    expect(GAME_CONFIG.gear?.uniques['holy_sword']).toMatchObject({ power: 10, rarity: 'mythical', damage: 'holy', untakeable: true });
  });
});

describe('Blademaster', () => {
  it('is offered the Way of the Blade at the crossroads, and nobody else is', () => {
    const blade = soul(6, { traits: [trait('blademaster')] });
    expect(odds(blade, worldOf(blade), 'crossroads')['way_of_the_blade']).toBeGreaterThan(0);
    const plain = soul(7);
    expect(odds(plain, worldOf(plain), 'crossroads')['way_of_the_blade']).toBeUndefined();
  });
});

