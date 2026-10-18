/**
 * Boss battles: fair odds, the Crit Cascade, spells both ways, health in and out, and the
 * fight's own wheel deciding how it ended.
 */
import { describe, expect, it } from 'vitest';
import { BATTLE_CONFIG } from '../config/battle';
import { GAME_CONFIG as SAMPLE_CONFIG } from '../config/gameConfig';
import { castInBattle, getAdventureStep, spinAdventure, startAdventure, type AdventureState } from './adventure';
import {
  BATTLE_POOL,
  applyClash,
  autoCast,
  cascadeOdds,
  castSpell,
  createClashStep,
  heroStrike,
  heroUnits,
  rollCascade,
  startBattle,
  weaponDamage,
  type BattleState,
} from './battle';
import { createCharacter } from './character';
import { currentHp, hpFraction, maxHp, withHpFraction } from './hp';
import { attackMult, defenseMult, fightMatchup, matchupOf } from './matchup';
import { fightOdds } from './odds';
import { calculatePowerRating, calculateWinProbability } from './power';
import { createSeededRng, type Rng } from './rng';
import { rollWeightedOption } from './roll';
import { plainArchetypes, plainItem } from './testConfig';
import type { Character, DamageType, Foe, GameConfig, SpellMode, Trait, World } from './types';
import { createWorld, placeCharacter } from './world';

const GAME_CONFIG: GameConfig = plainArchetypes({ ...SAMPLE_CONFIG, adventure: { ...SAMPLE_CONFIG.adventure, roadHome: undefined } });

function soul(seed: number, patch: Partial<Character> = {}): Character {
  const { rules: _rules, ...plain } = createCharacter(GAME_CONFIG, { name: `Soul ${seed}`, rng: createSeededRng(seed), now: 0 });
  return { ...plain, status: 'alive', role: 'hero', traits: [], weapon: null, armor: null, meters: {}, ...patch };
}
const worldOf = (...chars: Character[]): World => chars.reduce((w, c) => placeCharacter(w, c), createWorld({ rng: createSeededRng(1), now: 0 }));
const trait = (id: string): Trait => GAME_CONFIG.traits[id] ?? { id, name: id, description: '', power: 30, scalesWith: ['arcana'] };
/** A foe with no weaknesses, resistances or moves: even matchups. */
const plainFoe = (power: number): Foe => ({ name: 'The Test', power });

/** Spin a battle out on its own, as the adventure would. */
function fightOut(start: BattleState, char: Character, mode: SpellMode, rng: Rng): BattleState {
  let battle = start;
  while (!battle.verdict && battle.round < 200) {
    if (mode === 'choose') {
      const spell = autoCast(BATTLE_CONFIG, battle, char);
      if (spell) {
        battle = castSpell(BATTLE_CONFIG, battle, char, spell, rng);
        continue;
      }
    }
    const step = createClashStep(BATTLE_CONFIG, battle, char, mode, maxHp(char));
    const { winner } = rollWeightedOption(step.options, createWorld({ rng: createSeededRng(2), now: 0 }), char, rng);
    battle = applyClash(BATTLE_CONFIG, battle, char, { ...winner.option.clash!, label: winner.option.label }, rng);
  }
  return battle;
}

function winRate(char: Character, foe: Foe, mode: SpellMode, n: number, seed: number): number {
  const rng = createSeededRng(seed);
  let won = 0;
  const start = startBattle(BATTLE_CONFIG, "test", foe, char, mode);
  for (let i = 0; i < n; i++) if (fightOut(start, char, mode, rng).verdict === "win") won++;
  return won / n;
}

describe('damage matchups', () => {
  const troll: Foe = { name: 'Troll', power: 300, weak: ['fire'], resists: ['bludgeoning'], immune: ['poison'], strikes: 'bludgeoning' };
  const armed = (damage: DamageType) => soul(1, { weapon: { ...plainItem('weapon', 3), damage } });

  it('ranks immune over resisted over weak', () => {
    expect(matchupOf('fire', troll)).toBe('weak');
    expect(matchupOf('bludgeoning', troll)).toBe('resisted');
    expect(matchupOf('poison', troll)).toBe('immune');
    expect(matchupOf('holy', troll)).toBe('neutral');
    expect(matchupOf('fire', { ...troll, immune: ['fire'] })).toBe('immune');
  });

  it('multiplies hits by the matchup, and turns blows with the right armour', () => {
    expect(attackMult(armed('fire'), troll)).toBe(1.3);
    expect(attackMult(armed('poison'), troll)).toBe(0.5);
    expect(attackMult(soul(1), troll)).toBe(0.75); // fists are bludgeoning
    const plated = soul(1, { armor: { ...plainItem('armor', 3), resists: 'bludgeoning' } });
    expect(defenseMult(plated, 'bludgeoning')).toBe(0.7);
    expect(defenseMult(plated, 'fire')).toBe(1);
    expect(fightMatchup(plated, troll)).toBeCloseTo(0.75 * 1.15);
  });

  it('bends a one-spin fight’s odds', () => {
    const step = getAdventureStep(GAME_CONFIG, 'fight_troll', { cast: null, character: armed('fire') });
    expect(step.foe?.weak).toContain('fire');
    const fire = fightOdds(step, armed('fire'))!;
    const holy = fightOdds(step, armed('holy'))!;
    const cp = calculatePowerRating(armed('holy'));
    expect(holy).toBeCloseTo(calculateWinProbability(cp, step.foe!.power));
    expect(fire).toBeCloseTo(calculateWinProbability(cp * 1.3, step.foe!.power));
  });
});

describe('health', () => {
  it('is the Wounds meter read the other way round', () => {
    const hero = soul(2);
    expect(hpFraction(hero)).toBe(1);
    expect(currentHp(hero)).toBe(maxHp(hero));
    const hurt = { ...hero, meters: { wounds: 1 } };
    expect(hpFraction(hurt)).toBeCloseTo(2 / 3);
    expect(withHpFraction(hero, 0.5).meters?.wounds).toBeCloseTo(1.5);
    expect(currentHp(withHpFraction(hero, 0))).toBe(0);
  });

  it('grows with Vitality and armour', () => {
    const hero = soul(2);
    expect(maxHp({ ...hero, stats: { ...hero.stats, vitality: 15 } })).toBeGreaterThan(maxHp(hero));
    expect(maxHp({ ...hero, armor: plainItem('armor', 5) })).toBe(maxHp(hero) + 30);
  });
});

describe('the Crit Cascade', () => {
  it('multiplies every wheel it lands, chains at most four deep, and its odds sum to 1', () => {
    const odds = cascadeOdds(BATTLE_CONFIG);
    expect([...odds.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(Math.max(...odds.keys())).toBe(2 * 2 * 2 * 10);
    const rng = createSeededRng(9);
    let deepest = 0;
    for (let i = 0; i < 3000; i++) {
      const rolls = rollCascade(BATTLE_CONFIG, rng);
      deepest = Math.max(deepest, rolls.length);
      expect(rolls.length).toBeLessThanOrEqual(BATTLE_CONFIG.cascadeDepth);
      expect(rolls.slice(0, -1).every((r) => r.id === 'chain')).toBe(true);
      expect(rolls.at(-1)!.id === 'chain').toBe(false);
    }
    expect(deepest).toBe(4);
  });

  it('hits for the base times the product of the multipliers', () => {
    const hero = soul(3);
    const battle = startBattle(BATTLE_CONFIG, 'x', plainFoe(200), hero, 'auto');
    const after = applyClash(BATTLE_CONFIG, battle, hero, { kind: 'crit', label: 'CRITICAL!', toFoe: 2 }, createSeededRng(4));
    const mult = after.last!.cascade!.reduce((m, r) => m * r.mult, 1);
    expect(after.last!.mult).toBe(mult);
    expect(after.foeHp).toBe(Math.max(0, BATTLE_POOL - 2 * mult));
  });
});

describe('fair odds', { timeout: 60_000 }, () => {
  // A hero at full health, at even matchups, wins about as often as Combat Power says.
  const ratios = [0.3, 0.6, 1, 1.8, 3];
  for (const mode of ['auto', 'choose'] as const) {
    for (const [i, ratio] of ratios.entries()) {
      it(`matches CP odds within 3% at CP ratio ${ratio} (${mode}, with spells)`, () => {
        const hero = soul(10 + i, { traits: [trait('fireball'), trait('healing_light'), trait('divine_shield')] });
        const cp = calculatePowerRating(hero);
        const foe = plainFoe(Math.round(cp / ratio));
        const expected = calculateWinProbability(cp, foe.power);
        expect(Math.abs(winRate(hero, foe, mode, 2500, 100 + i) - expected)).toBeLessThan(0.03);
      });
    }
  }

  it('matches CP odds without spells, and the right weapon tips them', () => {
    const hero = soul(20, { weapon: { ...plainItem('weapon', 3), damage: 'fire' } });
    const cp = calculatePowerRating(hero);
    const foe = plainFoe(cp);
    expect(Math.abs(winRate(hero, foe, 'auto', 2500, 7) - 0.5)).toBeLessThan(0.03);
    expect(winRate(hero, { ...foe, weak: ['fire'] }, 'auto', 2500, 8)).toBeGreaterThan(0.56);
    expect(winRate(hero, { ...foe, immune: ['fire'] }, 'auto', 2500, 9)).toBeLessThan(0.4);
  });

  it('is harder for a hero who comes in hurt', () => {
    const hero = soul(21);
    const foe = plainFoe(calculatePowerRating(hero));
    expect(winRate(withHpFraction(hero, 0.34), foe, 'auto', 2000, 11)).toBeLessThan(0.4);
  });
});

describe('spells', () => {
  const caster = soul(30, { traits: [trait('fireball'), trait('healing_light')] });
  const foe: Foe = { name: 'Wights', power: 300, weak: ['fire'] };

  it('auto: are slices that stay on the wheel', () => {
    const battle = startBattle(BATTLE_CONFIG, 'x', foe, caster, 'auto');
    const step = createClashStep(BATTLE_CONFIG, battle, caster, 'auto', maxHp(caster));
    const fireball = step.options.find((o) => o.clash?.spellId === 'fireball')!;
    expect(fireball.clash?.matchup).toBe('weak');
    const after = applyClash(BATTLE_CONFIG, battle, caster, { ...fireball.clash!, label: fireball.label }, createSeededRng(1));
    expect(after.foeHp).toBe(BATTLE_POOL - 8);
    expect(createClashStep(BATTLE_CONFIG, after, caster, 'auto', maxHp(caster)).options.some((o) => o.clash?.spellId === 'fireball')).toBe(true);
  });

  it('choose: are charges, not slices; a cast spends one and takes no spin', () => {
    const battle = startBattle(BATTLE_CONFIG, 'x', foe, caster, 'choose');
    expect(createClashStep(BATTLE_CONFIG, battle, caster, 'choose', maxHp(caster)).options.some((o) => o.clash?.spellId)).toBe(false);
    const cast = castSpell(BATTLE_CONFIG, battle, caster, 'fireball', createSeededRng(1));
    expect(cast.foeHp).toBe(BATTLE_POOL - 8); // 6 × 1.3, a weakness
    expect(cast.round).toBe(battle.round);
    expect(cast.last?.cast).toBe(true);
    expect(() => castSpell(BATTLE_CONFIG, cast, caster, 'fireball', createSeededRng(1))).toThrow();
  });

  it('an Archmage casts each twice', () => {
    const archmage = { ...caster, rules: { noWeapon: true, spellMultiplier: 2 } };
    let battle = startBattle(BATTLE_CONFIG, 'x', foe, archmage, 'choose');
    battle = castSpell(BATTLE_CONFIG, battle, archmage, 'fireball', createSeededRng(1));
    battle = castSpell(BATTLE_CONFIG, battle, archmage, 'fireball', createSeededRng(1));
    expect(() => castSpell(BATTLE_CONFIG, battle, archmage, 'fireball', createSeededRng(1))).toThrow();
  });

  it('a ward shrinks the foe’s side of the next wheel', () => {
    const warder = soul(31, { traits: [trait('divine_shield')] });
    const battle = startBattle(BATTLE_CONFIG, 'x', foe, warder, 'choose');
    const foeShare = (b: BattleState) =>
      createClashStep(BATTLE_CONFIG, b, warder, 'choose', maxHp(warder)).options.filter((o) => o.clash?.toHero).reduce((s, o) => s + o.baseWeight, 0);
    const warded = castSpell(BATTLE_CONFIG, battle, warder, 'divine_shield', createSeededRng(1));
    expect(foeShare(warded)).toBeCloseTo(foeShare(battle) / 2);
  });
});

describe('in an adventure', () => {
  const strongHero = () => soul(40, { stats: { might: 30, agility: 30, intellect: 10, arcana: 10, vitality: 30 }, weapon: plainItem('weapon', 9), fame: 500 });
  const at = (hero: Character, stepId: string, spellMode: SpellMode = 'auto'): AdventureState => ({ ...startAdventure(GAME_CONFIG, hero, { spellMode }), character: hero, currentStepId: stepId });
  /** Arrive at a fight the way the road does: a spin that leads there. */
  function arrive(hero: Character, fightId: string, spellMode: SpellMode = 'auto'): AdventureState {
    const rigged = { ...GAME_CONFIG, steps: { ...GAME_CONFIG.steps, road_in: { id: 'road_in', title: 'Road', options: [{ id: 'go', label: 'Go', baseWeight: 1, nextStepId: fightId }] } } };
    return spinAdventure(at(hero, 'road_in', spellMode), rigged, worldOf(hero), createSeededRng(1)).state;
  }

  it('a battle fight begins with its Clash wheels, and ends on its own wheel with one side on it', () => {
    const hero = strongHero();
    let state = arrive(hero, 'fight_dragon');
    expect(state.currentStepId).toBe('battle:fight_dragon');
    expect(state.battle?.foe.name).toBe('Elder Dragon');
    const world = worldOf(hero);
    const rng = createSeededRng(5);
    let rounds = 0;
    while (state.currentStepId?.startsWith('battle:')) {
      state = spinAdventure(state, GAME_CONFIG, world, rng).state;
      rounds++;
    }
    expect(rounds).toBeGreaterThan(1);
    expect(state.currentStepId).toBe('fight_dragon');
    const verdict = state.battle!.verdict!;
    const wheel = getAdventureStep(GAME_CONFIG, 'fight_dragon', state);
    expect(wheel.options.every((o) => o.fight === verdict)).toBe(true);
    if (verdict === 'lose') expect(wheel.options.every((o) => !o.meters?.wounds)).toBe(true);
    const after = spinAdventure(state, GAME_CONFIG, world, rng).state;
    expect(after.battle ?? null).toBeNull();
    expect(after.rolls.at(-1)?.note).toMatch(/round battle/);
  });

  it('an ordinary fight is a short battle: a low-health foe, and a third of the hero at stake', () => {
    const state = arrive(strongHero(), 'fight_troll');
    expect(state.currentStepId).toBe('battle:fight_troll');
    expect(state.battle!.boss).toBe(false);
    expect(state.battle!.foePool).toBeLessThan(BATTLE_POOL);
    expect(state.battle!.heroPool).toBe(BATTLE_POOL / 3);
  });

  it('a lost ordinary fight costs the third it could take', () => {
    const hero = soul(3);
    const world = worldOf(hero);
    const rng = createSeededRng(9);
    for (let n = 0; n < 40; n++) {
      let state = arrive(hero, 'fight_troll');
      const before = hpFraction(state.character);
      while (state.currentStepId?.startsWith('battle:')) state = spinAdventure(state, GAME_CONFIG, world, rng).state;
      if (state.battle!.verdict !== 'lose') continue;
      expect(hpFraction(state.character)).toBeCloseTo(Math.max(1 / 6, before - 1 / 3), 1);
      return;
    }
    throw new Error('never lost to the troll');
  });

  it('the hero leaves a battle with the health it left them', () => {
    const hero = strongHero();
    let state = arrive(hero, 'fight_wyvern');
    const world = worldOf(hero);
    const rng = createSeededRng(6);
    while (state.currentStepId?.startsWith('battle:')) state = spinAdventure(state, GAME_CONFIG, world, rng).state;
    const left = state.battle!.verdict === 'win' ? heroUnits(state.battle!) / BATTLE_POOL : 1 / 6;
    expect(hpFraction(state.character)).toBeCloseTo(left, 2);
  });

  it('Iron Will gets them up at 1, once a fight', () => {
    const hero = soul(41, { traits: [GAME_CONFIG.traits['iron_will']!] });
    const battle = startBattle(BATTLE_CONFIG, 'x', plainFoe(200), hero, 'auto');
    const blow = { kind: 'foe_strike' as const, label: 'Hit', toHero: BATTLE_POOL * 2 };
    const once = applyClash(BATTLE_CONFIG, battle, hero, blow, createSeededRng(1));
    expect(once).toMatchObject({ heroHp: 1, ironWillUsed: true });
    expect(once.verdict).toBeUndefined();
    expect(once.last?.ironWill).toBe(true);
    const twice = applyClash(BATTLE_CONFIG, once, hero, blow, createSeededRng(1));
    expect(twice.verdict).toBe('lose');
    const plain = soul(41);
    expect(applyClash(BATTLE_CONFIG, startBattle(BATTLE_CONFIG, 'x', plainFoe(200), plain, 'auto'), plain, blow, createSeededRng(1)).verdict).toBe('lose');
  });

  it('death cheats still board up the fatal slice after a lost battle', () => {
    const hero = soul(41, { traits: [GAME_CONFIG.traits['phylactery_spark']!] });
    let state = arrive(hero, 'fight_dragon');
    state = { ...state, battle: { ...state.battle!, heroHp: 0, verdict: 'lose' }, currentStepId: 'fight_dragon' };
    const world = worldOf(hero);
    for (let i = 0; i < 20; i++) expect(spinAdventure(state, GAME_CONFIG, world, createSeededRng(i)).state.character.status).toBe('alive');
  });

  it('choose mode: casting needs a battle, and can end one', () => {
    const caster = { ...strongHero(), traits: [trait('wish')] };
    const state = arrive(caster, 'fight_wyvern', 'choose');
    expect(() => castInBattle(at(caster, 'fight_troll', 'choose'), GAME_CONFIG, 'wish')).toThrow();
    const nearly = { ...state, battle: { ...state.battle!, foeHp: 3 } };
    const after = castInBattle(nearly, GAME_CONFIG, 'wish', createSeededRng(1));
    expect(after.battle?.verdict).toBe('win');
    expect(after.currentStepId).toBe('fight_wyvern');
  });
});

describe('a blow scales with the stat it is struck with', () => {
  const sword = (power: number) => ({ id: 's', kind: 'weapon' as const, base: 'longsword', name: 'Sword', rarity: 'common' as const, power, stat: 'might' as const, damage: 'slashing' as const, abilities: [] });
  it('as the weapon’s Combat Power does: more for the strong, much less for the weak', () => {
    const at = (might: number) => heroStrike({ ...soul(5), weapon: sword(10), stats: { ...soul(5).stats, might } });
    expect(at(10)).toBe(7);
    expect(at(22)).toBe(Math.round(7 * 1.6));
    expect(at(3)).toBe(Math.round(7 * 0.44));
    expect(weaponDamage({ ...soul(5), weapon: sword(10), stats: { ...soul(5).stats, might: 22 } })).toBe(Math.round(7 * 1.6) * 5);
  });
  it('never strikes for nothing', () => {
    expect(heroStrike({ ...soul(5), weapon: null, stats: { might: 1, agility: 1, intellect: 1, arcana: 1, vitality: 1 } })).toBeGreaterThanOrEqual(1);
  });
});
