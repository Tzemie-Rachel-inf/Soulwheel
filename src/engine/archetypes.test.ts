/**
 * Archetypes: each one's rule, through the sample config. How fate treats a soul: twice-spun
 * wheels, bets on every gain, trimmed and dreamt-up wheels, smashes and decrees.
 */
import { describe, expect, it } from 'vitest';
import { plainItem } from './testConfig';
import { ARCHETYPES } from '../config/archetypes';
import { GAME_CONFIG } from '../config/gameConfig';
import { statStepId } from '../config/stats';
import { decideAdventure, spinAdventure, startAdventure, type AdventureState } from './adventure';
import { applyOption, createCharacter } from './character';
import { autoPick, decideCurrentStep, getStep, pickOutcome, rollFullCharacter, spinCurrentStep, type GenerationState } from './generation';
import { dealOptions, fightOdds } from './odds';
import { calculatePowerRating, getPowerBreakdown, weaponStat } from './power';
import { createSeededRng } from './rng';
import { resolveSlices } from './roll';
import type { Character, GameConfig, StatBlock, WheelStep, World } from './types';
import { commitCharacter, createWorld } from './world';

const world = (): World => createWorld({ rng: createSeededRng(1), now: 0 });
const soul = (seed = 1): Character => createCharacter(GAME_CONFIG, { name: 'Test', rng: createSeededRng(seed), now: 0 });

/** Land on one option, as if the wheel had picked it. */
function take(char: Character, stepId: string, optionId: string, config: GameConfig = GAME_CONFIG): Character {
  const option = dealOptions(getStep(config, stepId), char, config).find((o) => o.id === optionId)!;
  return applyOption(char, resolveSlices([option], world(), char)[0]!, stepId, config);
}

/** A human of this archetype, about to roll their stats. */
function human(archetype: keyof typeof ARCHETYPES, seed = 1): Character {
  return take(take(soul(seed), 'ancestry', 'human'), 'archetype', archetype);
}

const at = (character: Character, stepId: string): GenerationState => ({ character, currentStepId: stepId, stepsTaken: 0 });
const dealt = (stepId: string, char: Character) => dealOptions(getStep(GAME_CONFIG, stepId), char, GAME_CONFIG, { world: world() });
const MIGHT = statStepId('might', 'human');

/** A committed hero of this archetype, ready for the road. */
function hero(archetype: keyof typeof ARCHETYPES): { w: World; hero: Character } {
  const rng = createSeededRng(5);
  for (let i = 0; i < 500; i++) {
    const { character } = rollFullCharacter(GAME_CONFIG, world(), rng, { now: 0 });
    if (character.role !== 'hero' || character.singletonClaims.length > 0) continue;
    const { rules: _r, decrees: _d, ...plain } = character;
    const made = take({ ...plain, archetype: null }, 'archetype', archetype);
    const w = commitCharacter(world(), { ...made, history: character.history });
    return { w, hero: w.roster[0]! };
  }
  throw new Error('no hero');
}

describe('the Wheel of Archetypes', () => {
  it('passes the config check, its own wheels included', () => {
    for (const id of ['gamble', 'trickster_gambit', 'martial_training', 'vessel_of', 'vessel_assimilation']) expect(GAME_CONFIG.steps[id]).toBeDefined();
  });
});

describe('Wise', () => {
  it('spins every wheel twice and keeps the result they choose', () => {
    const state = at(human('wise'), MIGHT);
    const outcome = spinCurrentStep(state, GAME_CONFIG, world(), createSeededRng(3));
    expect(outcome.alt).toBeDefined();
    expect(outcome.alt!.step.id).toBe(MIGHT);
    expect(outcome.alt!.state.character.history.at(-1)?.how).toBe('wise');
    // Keeping one drops the other.
    expect(pickOutcome(outcome, true)).toBe(outcome.alt);
    expect(pickOutcome(outcome, false).alt).toBeUndefined();
    // Left to themselves, they keep the stronger.
    const kept = autoPick(outcome);
    expect(calculatePowerRating(kept.state.character)).toBe(
      Math.max(calculatePowerRating(outcome.state.character), calculatePowerRating(outcome.alt!.state.character)),
    );
  });

  it('only once for anyone else', () => {
    expect(spinCurrentStep(at(human('realist'), MIGHT), GAME_CONFIG, world(), createSeededRng(3)).alt).toBeUndefined();
  });
});

describe('Gambler', () => {
  it('bets a stat roll on the coin: doubled, or knocked to 1, then goes where it was going', () => {
    const state = at(human('gambler'), MIGHT);
    const spun = spinCurrentStep(state, GAME_CONFIG, world(), createSeededRng(4));
    const rolled = spun.state.character.stats.might;
    expect(spun.state.currentStepId).toBe('gamble');
    expect(spun.state.character.stake).toEqual({ gains: { set: { might: rolled } }, then: statStepId('agility', 'human') });
    expect(getStep(GAME_CONFIG, 'gamble').options.map((o) => o.gamble)).toEqual(['double', 'lose', 'triple']);

    // The coin's slices are Double, Lose, Jackpot; a smash on one decides it, for the test.
    const coin = (how: 'double' | 'lose') => decideCurrentStep(spun.state, GAME_CONFIG, world(), how === 'double' ? 0 : 1, 'smash');
    const won = coin('double').state;
    expect(won.character.stats.might).toBe(rolled * 2);
    expect(won.character.stake).toBeUndefined();
    expect(won.currentStepId).toBe(statStepId('agility', 'human'));
    expect(coin('lose').state.character.stats.might).toBe(1);
  });

  it('bets banked bonuses: +2 becomes +4 or nothing', () => {
    const before = human('gambler');
    const spun = decideCurrentStep(at(before, 'fate'), GAME_CONFIG, world(), dealtIndex('fate', before, (o) => (o.statBonus?.might ?? 0) > 0), 'smash');
    const gained = spun.state.character.statBonus.might - before.statBonus.might;
    expect(gained).toBeGreaterThan(0);
    expect(spun.state.character.stake?.gains.bonus?.might).toBe(gained);
    expect(decideCurrentStep(spun.state, GAME_CONFIG, world(), 0, 'smash').state.character.statBonus.might).toBe(before.statBonus.might + gained * 2);
    expect(decideCurrentStep(spun.state, GAME_CONFIG, world(), 1, 'smash').state.character.statBonus.might).toBe(before.statBonus.might);
  });

  it('never bets for anyone else, and never bets the coin itself', () => {
    expect(spinCurrentStep(at(human('wise'), MIGHT), GAME_CONFIG, world(), createSeededRng(4)).state.currentStepId).not.toBe('gamble');
    const rng = createSeededRng(8);
    for (let i = 0; i < 60; i++) {
      const { character } = rollFullCharacter(GAME_CONFIG, world(), rng, { now: 0 });
      const path = character.history.map((h) => h.stepId);
      path.forEach((id, k) => {
        if (id === 'gamble') expect(path[k - 1]).not.toBe('gamble');
      });
      if (character.archetype !== 'gambler') expect(path).not.toContain('gamble');
      expect(character.stake).toBeUndefined();
      expect(character.name).not.toBe('');
    }
  });
});

/** The index of the first dealt slice on a wheel matching `test`. */
function dealtIndex(stepId: string, char: Character, test: (o: ReturnType<typeof dealt>[number]) => boolean): number {
  const slices = resolveSlices(dealt(stepId, char), world(), char);
  const i = slices.findIndex((s) => s.effectiveWeight > 0 && test(s.option));
  if (i < 0) throw new Error(`nothing on ${stepId} matches`);
  return i;
}

describe('All-Rounder', () => {
  it('rolls Might, and every other stat comes out the same, plus its own bank', () => {
    const banked: Character = { ...human('all_rounder'), statBonus: { might: 0, agility: 2, intellect: 0, arcana: -1, vitality: 0 } };
    const outcome = spinCurrentStep(at(banked, MIGHT), GAME_CONFIG, world(), createSeededRng(2));
    const { stats, statBonus } = outcome.state.character;
    expect(stats.agility).toBe(stats.might + 2);
    expect(stats.intellect).toBe(stats.might);
    expect(stats.arcana).toBe(Math.max(1, stats.might - 1));
    expect(stats.vitality).toBe(stats.might);
    expect(Object.values(statBonus).every((v) => v === 0)).toBe(true);
    // The other stat wheels are behind them, recorded as if rolled.
    expect(outcome.state.currentStepId).toBe('talents');
    expect(outcome.state.character.history.map((h) => h.stepId).slice(-4)).toEqual(['agility', 'intellect', 'arcana', 'vitality'].map((s) => statStepId(s as keyof StatBlock, 'human')));
  });
});

describe('Assassin', () => {
  it('wields with Agility only, and wears armour with the better of Vitality and Agility', () => {
    const strong: Character = { ...human('assassin'), stats: { might: 20, agility: 8, intellect: 10, arcana: 10, vitality: 6 }, weapon: plainItem('weapon', 3), armor: plainItem('armor', 3) };
    expect(weaponStat(strong)).toBe('agility');
    const power = getPowerBreakdown(strong);
    expect(power.weapon).toBe(Math.round(3 * 25 * 0.84)); // Agility 8, not Might 20
    expect(power.armor).toBe(Math.round(3 * 20 * 0.84)); // Agility 8 beats Vitality 6
  });
});

describe('Realist', () => {
  it('cuts the best and worst rungs of a stat ladder', () => {
    const plain = human('wise');
    const ladder = (c: Character) => dealt(MIGHT, c).map((o) => o.setStats?.might);
    expect(ladder(human('realist'))).toEqual(ladder(plain).slice(1, -1));
  });

  it('cuts the most common and the rarest slice of any other wheel', () => {
    const plain = dealt('fate', human('wise')).map((o) => o.id);
    const real = dealt('fate', human('realist')).map((o) => o.id);
    expect(real).toHaveLength(plain.length - 2);
  });
});

describe('Dreamer', () => {
  it('adds a Miracle above the best rung and a Nightmare below the worst', () => {
    const plain = dealt(MIGHT, human('wise'));
    const dream = dealt(MIGHT, human('dreamer'));
    expect(dream).toHaveLength(plain.length + 2);
    expect(dream[0]!.setStats!.might).toBe(plain[0]!.setStats!.might! + 3);
    expect(dream[0]!.rarity).toBe('mythical');
    expect(dream.at(-1)!.setStats!.might).toBe(Math.max(1, plain.at(-1)!.setStats!.might! - 3));
  });
});

describe('Broken', () => {
  it('loses one to three slices, more on bigger wheels, the same ones for the same spin', () => {
    const broken = human('broken');
    for (const stepId of ['fate', 'talents', MIGHT]) {
      const plain = dealt(stepId, human('wise')).length;
      const cracked = dealOptions(getStep(GAME_CONFIG, stepId), broken, GAME_CONFIG, { world: world(), salt: 4 });
      expect(plain - cracked.length).toBeGreaterThanOrEqual(1);
      expect(plain - cracked.length).toBeLessThanOrEqual(3);
      expect(dealOptions(getStep(GAME_CONFIG, stepId), broken, GAME_CONFIG, { world: world(), salt: 4 }).map((o) => o.id)).toEqual(cracked.map((o) => o.id));
    }
  });
});

describe('Transcendent', () => {
  it('swaps the odds of common and the rarest tier', () => {
    const odds = (c: Character) => {
      const slices = resolveSlices(dealt('archetype', c), world(), c);
      const p = (rarity: string) => slices.filter((s) => s.option.rarity === rarity).reduce((sum, s) => sum + s.probability, 0);
      return { common: p('common'), mythical: p('mythical') };
    };
    const before = odds(soul());
    const after = odds({ ...soul(), rules: { mirrorRarity: true } });
    expect(after.common).toBeCloseTo(before.mythical);
    expect(after.mythical).toBeCloseTo(before.common);
  });
});

describe('Martial', () => {
  it('trains where a spell would have been taught, holds Arcana at 0, and skips its wheel', () => {
    const martial = human('martial');
    expect(martial.stats.arcana).toBe(0);
    const state = at({ ...martial, spinQueue: ['arcane_powers'] }, 'arcane_powers');
    const outcome = spinCurrentStep(state, GAME_CONFIG, world(), createSeededRng(1));
    expect(outcome.step.title).toBe('Training, Not Spells');
    expect(outcome.state.character.traits).toEqual([]);
    expect(outcome.state.character.spinQueue).toEqual([]); // the owed spin is spent
    const intellect = spinCurrentStep(at(martial, statStepId('intellect', 'human')), GAME_CONFIG, world(), createSeededRng(1));
    expect(intellect.state.currentStepId).toBe(statStepId('vitality', 'human')); // Arcana's wheel is skipped
    expect(intellect.state.character.stats.arcana).toBe(0);
  });

  it('survives the road without Arcana', () => {
    const { w, hero: h } = hero('martial');
    const rng = createSeededRng(2);
    let state = startAdventure(GAME_CONFIG, h);
    state = spinAdventure(state, GAME_CONFIG, w, rng).state;
    expect(state.character.stats.arcana).toBe(0);
    expect(state.fate ?? '').not.toContain('arcana');
  });
});

describe('Archmage', () => {
  it('can never be armed, and their spells count double', () => {
    const mage = human('archmage');
    const armory = resolveSlices(dealt('armory', mage), world(), mage);
    expect(armory.filter((s) => !s.locked).every((s) => !s.option.gear?.weapon && !s.option.weaponTierDelta)).toBe(true);
    expect(armory.some((s) => s.lockReason === 'An Archmage holds no weapon')).toBe(true);
    const blade = getStep(GAME_CONFIG, 'armory').options.find((o) => o.gear?.weapon !== undefined || (o.weaponTierDelta ?? 0) > 0)!;
    const armed = take(mage, 'armory', blade.id);
    expect(armed.weapon).toBeNull();
    expect(armed.gearOffers ?? []).toEqual([]);
    const spell = { id: 'bolt', name: 'Bolt', description: '', power: 50, scalesWith: ['arcana' as const] };
    const caster = { ...mage, traits: [spell], stats: { ...mage.stats, arcana: 10 } };
    expect(getPowerBreakdown(caster).traits).toBe(100);
    expect(getPowerBreakdown({ ...caster, rules: undefined }).traits).toBe(50);
  });
});

describe('Vessel', () => {
  it('learns what lives inside them, then how far it has taken them', () => {
    let v = human('vessel');
    v = take(v, 'vessel_of', 'dragon');
    expect(v.traits.at(-1)).toMatchObject({ id: 'vessel_dragon', power: 50 });
    expect(v.statBonus.might).toBeGreaterThanOrEqual(2);
    v = take(v, 'vessel_assimilation', 'overtaken');
    expect(v.traits.at(-1)).toMatchObject({ power: 175, rank: 'Overtaken' });
    expect(v.tags).toContain('possessed');
  });
});

describe('Brute and Ancient', () => {
  it('a Smash lands where the pointer is, or the nearest slice that can be rolled', () => {
    const brute = human('brute');
    const state = at(brute, 'fate');
    const slices = resolveSlices(dealt('fate', brute), world(), brute);
    const outcome = decideCurrentStep(state, GAME_CONFIG, world(), 2, 'smash');
    expect(outcome.roll.winner.option.id).toBe(slices[2]!.option.id);
    expect(outcome.state.character.history.at(-1)?.how).toBe('smash');
  });

  it('a decree is spent once, and only on an open slice', () => {
    const ancient = human('ancient');
    expect(ancient.decrees).toBe(1);
    const state = at(ancient, 'fate');
    const index = dealtIndex('fate', ancient, (o) => o.rarity === 'legendary' || o.rarity === 'epic');
    const outcome = decideCurrentStep(state, GAME_CONFIG, world(), index, 'decree');
    expect(outcome.state.character.decrees).toBe(0);
    expect(outcome.state.character.history.at(-1)).toMatchObject({ how: 'decree', optionId: resolveSlices(dealt('fate', ancient), world(), ancient)[index]!.option.id });
    expect(() => decideCurrentStep({ ...state, character: outcome.state.character }, GAME_CONFIG, world(), index, 'decree')).toThrow('No decrees left');
  });
});

describe('Hero', () => {
  it('is dealt more of every holy slice', () => {
    const weight = (c: Character) => dealt('blessed_powers', c).find((o) => o.id === 'smite')!.baseWeight;
    expect(weight(human('hero'))).toBeCloseTo(weight(human('wise')) * 1.3);
  });

  it('is missed by death about one time in ten', () => {
    const { w, hero: h } = hero('hero');
    const doom: WheelStep = { id: 'doom', title: 'Doom', options: [{ id: 'die', label: 'Die', baseWeight: 1, fame: 0, setStatus: 'fallen', nextStepId: null }] };
    const config = { ...GAME_CONFIG, steps: { ...GAME_CONFIG.steps, doom } };
    const rng = createSeededRng(9);
    let spared = 0;
    for (let i = 0; i < 2000; i++) {
      const state: AdventureState = { ...startAdventure(config, h), currentStepId: 'doom' };
      const after = spinAdventure(state, config, w, rng).state;
      if (after.character.status === 'alive') {
        spared++;
        expect(after.rolls.at(-1)?.note).toBe('Death came for them, and missed.');
      }
    }
    expect(spared / 2000).toBeGreaterThan(0.07);
    expect(spared / 2000).toBeLessThan(0.13);
  });
});

describe('Trickster', () => {
  it('spins a gambit before every fight, bends their power for it, and spends it there', () => {
    const { w, hero: h } = hero('trickster');
    const lead: WheelStep = { id: 'lead', title: 'Lead', options: [{ id: 'go', label: 'Go', baseWeight: 1, fame: 0, nextStepId: 'fight_troll' }] };
    const config = { ...GAME_CONFIG, steps: { ...GAME_CONFIG.steps, lead } };
    let state: AdventureState = { ...startAdventure(config, h), currentStepId: 'lead' };
    state = spinAdventure(state, config, w, createSeededRng(1)).state;
    expect(state.currentStepId).toBe('trickster_gambit');
    // Doubled, decided by a smash for the test.
    const doubled = getStep(config, 'trickster_gambit').options.findIndex((o) => o.id === 'doubled');
    state = decideAdventure(state, config, w, doubled, 'smash').state;
    expect(state.currentStepId).toBe('battle:fight_troll');
    expect(state.character.fightBoost).toBe(2);
    const troll = getStep(config, 'fight_troll');
    expect(fightOdds(troll, state.character)).toBeGreaterThan(fightOdds(troll, { ...state.character, fightBoost: undefined })!);
    // Spent once the battle is over and its fight's wheel has landed.
    const rng = createSeededRng(1);
    let fought = state;
    for (let i = 0; i < 80 && (fought.currentStepId === 'fight_troll' || fought.currentStepId?.startsWith('battle:')); i++) fought = spinAdventure(fought, config, w, rng).state;
    expect(fought.character.fightBoost).toBeUndefined();
  });
});
