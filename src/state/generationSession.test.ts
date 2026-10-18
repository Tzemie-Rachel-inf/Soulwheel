import { plainArchetypes } from '../engine/testConfig';
import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../config/gameConfig';
import { getAdventureStep, spinAdventure, startAdventure } from '../engine/adventure';
import { rollFullCharacter, spinCurrentStep } from '../engine/generation';
import { createSeededRng } from '../engine/rng';
import type { ArchetypeRules } from '../engine/types';
import { commitCharacter, createWorld } from '../engine/world';
import {
  advance,
  createFlowSession,
  createSession,
  finishUpgrade,
  pickSpin,
  smashSpin,
  settleSpin,
  startSpin,
  viewFlow,
  viewSession,
  type GenerationSession,
} from './generationSession';

const world = createWorld({ rng: createSeededRng(1), now: 0 });

function spinOnce(session: GenerationSession, seed: number, config = GAME_CONFIG): GenerationSession {
  const outcome = spinCurrentStep(session.state, config, world, createSeededRng(seed));
  return startSpin(session, outcome);
}

/**
 * The wheel stops, and any ladder bump plays out: spinning → (upgrading →) revealing. A Wise
 * soul's two wheels both stop, and they keep the first.
 */
function land<S extends GenerationSession>(session: S, spinId: number): S {
  const settled = settleSpin(settleSpin(session, spinId), spinId, 'right');
  return finishUpgrade(settled.phase === 'picking' ? pickSpin(settled, 'left') : settled, spinId) as S;
}

describe('generation session', () => {
  it('spins a Wise soul two wheels, waits for both, and goes on with the one they keep', () => {
    const base = createSession(GAME_CONFIG, { rng: createSeededRng(2), now: 0 });
    const wise = { ...base, state: { ...base.state, character: { ...base.state.character, rules: { rollTwice: true } } } };
    let s = spinOnce(wise, 3);
    expect(s.wise).toBeDefined();
    s = settleSpin(s, s.spinCount);
    expect(s.phase).toBe('spinning'); // the second wheel is still turning
    s = settleSpin(s, s.spinCount, 'right');
    expect(s.phase).toBe('picking');
    const view = viewSession(s, GAME_CONFIG, world);
    expect(view.wise?.right.winnerIndex).toBe(s.wise!.right.roll.winner.index);
    s = finishUpgrade(pickSpin(s, 'right'), s.spinCount);
    expect(s.phase).toBe('revealing');
    expect(s.pending).toBe(s.wise!.right);
    s = advance(s);
    expect(s.wise).toBeUndefined();
    expect(s.state).toBe(s.last!.state);
  });

  it('shows the wheel exactly as the soul will spin it: a Broken soul’s cracks, a Martial soul’s training', () => {
    const base = createSession(GAME_CONFIG, { rng: createSeededRng(2), now: 0 });
    const cases: [ArchetypeRules, string][] = [
      [{ shatter: true }, 'fate'],
      [{ replaceSteps: { steps: ['arcane_powers'], with: 'martial_training' } }, 'arcane_powers'],
    ];
    for (const [rules, stepId] of cases) {
      const s = { ...base, state: { ...base.state, currentStepId: stepId, stepsTaken: 5, character: { ...base.state.character, rules } } };
      const shown = viewSession(s, GAME_CONFIG, world).slices.map((sl) => sl.option.id);
      const spun = spinCurrentStep(s.state, GAME_CONFIG, world, createSeededRng(1)).roll.slices.map((sl) => sl.option.id);
      expect(shown).toEqual(spun);
    }
  });

  it('lets a Smash end a spin at once, with the result it decided', () => {
    let s = spinOnce(createSession(GAME_CONFIG, { rng: createSeededRng(2), now: 0 }), 3);
    const smashed = { ...s.pending!, roll: { ...s.pending!.roll, winner: s.pending!.roll.slices[0]! } };
    expect(smashSpin(s, s.spinCount + 1, smashed)).toBe(s); // a stale spin is ignored
    s = smashSpin(s, s.spinCount, smashed);
    expect(s.phase).toBe('revealing');
    expect(viewSession(s, GAME_CONFIG, world).winnerIndex).toBe(0);
  });

  it('decides the winner before the wheel moves, but shows it only after landing', () => {
    let s = createSession(GAME_CONFIG, { rng: createSeededRng(2), now: 0 });
    const before = viewSession(s, GAME_CONFIG, world);
    expect(before.canSpin).toBe(true);
    expect(before.winnerIndex).toBeNull();

    s = spinOnce(s, 3);
    const spinning = viewSession(s, GAME_CONFIG, world);
    expect(s.phase).toBe('spinning');
    expect(spinning.winnerIndex).toBe(s.pending?.roll.winner.index ?? -1);
    expect(spinning.character.history).toHaveLength(0); // not revealed yet
    expect(spinning.canSpin).toBe(false);

    s = settleSpin(s, s.spinCount);
    const revealing = viewSession(s, GAME_CONFIG, world);
    expect(s.phase).toBe('revealing');
    expect(revealing.character.history).toHaveLength(1);
    expect(revealing.previous?.history).toHaveLength(0);
  });

  it('plays a ladder bump between landing and the reveal, then shows where it moved the result', () => {
    const banked = createSession(GAME_CONFIG, { rng: createSeededRng(6), now: 0 });
    const human = { ...banked.state.character, race: 'human', statBonus: { ...banked.state.character.statBonus, might: 2 } };
    let s: GenerationSession = { ...banked, state: { ...banked.state, character: human, currentStepId: 'stat_might_human' } };
    // Land somewhere in the middle, so two positions up stays on the wheel.
    s = startSpin(s, spinCurrentStep(s.state, GAME_CONFIG, world, () => 0.5));
    const bump = s.pending!.bump!;
    expect(bump.stages).toBe(2);

    s = settleSpin(s, s.spinCount);
    expect(s.phase).toBe('upgrading');
    const upgrading = viewSession(s, GAME_CONFIG, world);
    expect(upgrading.winnerIndex).toBe(bump.from); // still where the wheel landed
    expect(upgrading.character.history).toHaveLength(0);
    expect(finishUpgrade(s, s.spinCount - 1).phase).toBe('upgrading'); // stale ids ignored

    s = finishUpgrade(s, s.spinCount);
    const revealed = viewSession(s, GAME_CONFIG, world);
    expect(s.phase).toBe('revealing');
    expect(revealed.winnerIndex).toBe(bump.to);
    expect(revealed.character.stats.might).toBe(revealed.slices[bump.to]!.option.setStats!.might);
  });

  it('ignores a settle from a stale spin', () => {
    const s = spinOnce(createSession(GAME_CONFIG, { now: 0 }), 4);
    expect(settleSpin(s, s.spinCount - 1).phase).toBe('spinning');
  });

  it('follows nextStepId all the way to complete', () => {
    let s = createSession(GAME_CONFIG, { rng: createSeededRng(5), now: 0 });
    let seed = 10;
    while (s.phase !== 'complete') {
      s = spinOnce(s, seed++);
      s = land(s, s.spinCount);
      s = advance(s);
    }
    const view = viewSession(s, GAME_CONFIG, world);
    expect(s.state.currentStepId).toBeNull();
    expect(view.step?.id).toBe(s.last?.step.id ?? 'missing');
    expect(view.character.history.length).toBeGreaterThan(1);
  });

  it('shows locked slices with live odds while ready', () => {
    let lordWorld = world;
    for (let seed = 0; !lordWorld.activeSingletons['demon_lord']; seed++) {
      let s = createSession(GAME_CONFIG, { rng: createSeededRng(seed), now: 0 });
      while (s.phase !== 'complete') s = advance(land(spinOnce(s, seed * 31 + s.spinCount), s.spinCount + 1));
      if (s.state.character.role === 'demonLord') lordWorld = commitCharacter(world, s.state.character);
    }
    // Spin past Ancestry and the race's wheels to reach Fate, then look at it in the Demon Lord's world.
    // A soul with no archetype: a Realist would never see the rarest slice at all.
    const plain = plainArchetypes(GAME_CONFIG);
    let s = createSession(plain, { now: 0 });
    for (let seed = 1; s.state.currentStepId !== 'fate'; seed++) s = advance(land(spinOnce(s, seed, plain), s.spinCount + 1));
    const view = viewSession(s, plain, lordWorld);
    expect(view.step?.id).toBe('fate');
    const lord = view.slices.find((sl) => sl.option.id === 'demon_lord');
    expect(lord?.locked).toBe(true);
    expect(lord?.probability).toBe(0);
  });

  it('refuses to spin twice at once', () => {
    const s = spinOnce(createSession(GAME_CONFIG, { now: 0 }), 6);
    expect(spinOnce(s, 7)).toBe(s);
  });
});

describe('adventure session', () => {
  it('runs the same spin–reveal loop, ending when the road does, with fame earned on the way', () => {
    const rng = createSeededRng(80);
    let world = createWorld({ rng: createSeededRng(81), now: 0 });
    let rolled = rollFullCharacter(GAME_CONFIG, world, rng, { now: 0 }).character;
    while (rolled.role !== 'hero') rolled = rollFullCharacter(GAME_CONFIG, world, rng, { now: 0 }).character;
    world = commitCharacter(world, rolled);
    const hero = world.roster[0]!;

    for (let attempt = 0; attempt < 200; attempt++) {
      let s = createFlowSession(startAdventure(GAME_CONFIG, hero));
      const lookup = (id: string) => getAdventureStep(GAME_CONFIG, id, s.state);
      expect(viewFlow(s, GAME_CONFIG, lookup, world).step?.id).toBe('crossroads');

      const seen: string[] = [];
      while (s.phase !== 'complete') {
        s = startSpin(s, spinAdventure(s.state, GAME_CONFIG, world, rng));
        const spinning = viewFlow(s, GAME_CONFIG, lookup, world);
        expect(spinning.character).toBe(s.state.character); // nothing revealed mid-spin
        seen.push(spinning.step?.id ?? '?');
        s = advance(finishUpgrade(settleSpin(s, s.spinCount), s.spinCount));
      }
      if (s.state.character.status === 'fallen' || s.state.fameEarned <= 0) continue;

      // The finished screen keeps showing the last wheel spun; there is no retirement wheel after it.
      const wheel = viewFlow(s, GAME_CONFIG, lookup, world);
      expect(wheel.step?.id).toBe(seen.at(-1));
      expect(s.state.currentStepId).toBeNull();
      expect(s.state.character.fame).toBeGreaterThanOrEqual(hero.fame + s.state.fameEarned); // (fame never drops below 0)
      return;
    }
    throw new Error('no survivor in 200 adventures');
  });
});
