/**
 * React wrapper around the generation session. The engine call that picks the winner
 * happens here, in the event handler, so state updaters stay pure (StrictMode safe).
 *
 * A soul can be rolled from a seed (the Daily Soul, or one a player typed): every spin then
 * draws from that seed, so the same seed rolls the same soul. The character's id stays
 * random, so rolling a seed twice never puts two souls with one id in the world.
 *
 * A soul can also be someone's heir (engine/lineage.ts): born into their house.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { EngineError } from '../engine/errors';
import { chooseCurrentStep, decideCurrentStep, spinCurrentStep } from '../engine/generation';
import { asHeir } from '../engine/lineage';
import { defaultRng, seededFrom, type Rng } from '../engine/rng';
import type { Character, GameConfig, World } from '../engine/types';
import type { SpinRequest, UpgradeRequest } from '../ui/wheel/SpinWheel';
import { advance, createSession, finishUpgrade, pickSpin, settleSpin, smashSpin, startSpin, viewSession, type Side } from './generationSession';

/** How a new soul begins, beyond chance: from a seed, or as someone's heir. */
export interface SoulStart {
  seed?: string;
  /** The day, when this is that day's Daily Soul. */
  daily?: string;
  /** The parent, when this soul is born into their house. */
  heirOf?: Character;
}

/** A new soul, unnamed until its last wheel: the name and title come from what it rolls. */
function freshSession(config: GameConfig, from: SoulStart | null = null) {
  const session = createSession(config);
  if (!from) return session;
  let character = session.state.character;
  if (from.seed) character = { ...character, seed: from.seed, ...(from.daily && { daily: from.daily }) };
  if (from.heirOf) character = asHeir(character, from.heirOf);
  return { ...session, state: { ...session.state, character } };
}

export function useCharacterGeneration(config: GameConfig, world: World) {
  const [session, setSession] = useState(() => freshSession(config));
  const [error, setError] = useState<string | null>(null);
  /** Where this soul's spins come from: a seed's own stream, or chance. */
  const rng = useRef<Rng>(defaultRng);

  const view = useMemo(() => viewSession(session, config, world), [session, config, world]);

  /** The request the wheel animates. Same object for the whole spin, a new one per spin. */
  const pending = session.pending;
  const spinRequest = useMemo<SpinRequest | null>(
    () =>
      session.phase === 'spinning' && pending
        ? { id: session.spinCount, targetIndex: pending.roll.winner.index }
        : null,
    [session.phase, session.spinCount, pending],
  );
  /** A Wise soul's second wheel: the same spin, its own target. */
  const right = session.wise?.right;
  const altSpinRequest = useMemo<SpinRequest | null>(
    () => (session.phase === 'spinning' && right ? { id: session.spinCount, targetIndex: right.roll.winner.index } : null),
    [session.phase, session.spinCount, right],
  );

  /** The bump the wheel plays after landing, while `upgrading`. Same object for the whole bump. */
  const upgradeRequest = useMemo<UpgradeRequest | null>(
    () =>
      session.phase === 'upgrading' && pending?.bump
        ? {
            id: session.spinCount,
            path: pending.bump.path,
            overflow: pending.bump.overflow,
            direction: pending.bump.stages < 0 ? -1 : 1,
            effect: pending.step.upgradeEffect,
          }
        : null,
    [session.phase, session.spinCount, pending],
  );

  const spin = useCallback(() => {
    if (session.phase !== 'ready') return;
    try {
      const outcome = spinCurrentStep(session.state, config, world, rng.current);
      setError(null);
      setSession((s) => startSpin(s, outcome));
    } catch (err) {
      setError(describe(err));
    }
  }, [session, config, world]);

  /** A decision on a choice wheel (Keep or Take): no spin, the chosen option is revealed at once. */
  const choose = useCallback(
    (optionId: string) => {
      if (session.phase !== 'ready') return;
      try {
        const outcome = chooseCurrentStep(session.state, config, world, optionId, rng.current);
        setError(null);
        setSession((s) => settleSpin(startSpin(s, outcome), s.spinCount + 1));
      } catch (err) {
        setError(describe(err));
      }
    },
    [session, config, world],
  );

  /** An Ancient's decree: the wheel turns to the slice they named. */
  const decree = useCallback(
    (index: number) => {
      if (session.phase !== 'ready') return;
      try {
        const outcome = decideCurrentStep(session.state, config, world, index, 'decree', rng.current);
        setError(null);
        setSession((s) => startSpin(s, outcome));
      } catch (err) {
        setError(describe(err));
      }
    },
    [session, config, world],
  );

  /** A Brute's Smash: the wheel stopped dead on slice `index`, and that is the roll. */
  const smash = useCallback(
    (spinId: number, index: number) => {
      if (session.phase !== 'spinning' || spinId !== session.spinCount) return;
      try {
        const outcome = decideCurrentStep(session.state, config, world, index, 'smash', rng.current);
        setSession((s) => smashSpin(s, spinId, outcome));
      } catch (err) {
        setError(describe(err));
      }
    },
    [session, config, world],
  );

  const settle = useCallback((spinId: number) => setSession((s) => settleSpin(s, spinId)), []);
  const settleAlt = useCallback((spinId: number) => setSession((s) => settleSpin(s, spinId, 'right')), []);
  /** A Wise soul keeps one of their two rolls. */
  const pick = useCallback((side: Side) => setSession((s) => pickSpin(s, side)), []);
  const upgraded = useCallback((spinId: number) => setSession((s) => finishUpgrade(s, spinId)), []);
  const next = useCallback(() => setSession(advance), []);
  /** A new soul: by chance, from a seed, or as someone's heir. */
  const restart = useCallback(
    (from: SoulStart | null = null) => {
      setError(null);
      rng.current = from?.seed ? seededFrom(from.seed) : defaultRng;
      setSession(freshSession(config, from));
    },
    [config],
  );

  return { session, view, spinRequest, altSpinRequest, upgradeRequest, error, spin, choose, decree, smash, settle, settleAlt, pick, upgraded, next, restart };
}

function describe(err: unknown): string {
  if (err instanceof EngineError && err.code === 'NO_ELIGIBLE_OPTIONS') {
    return 'Every slice on this wheel is locked. Change the world, or give this wheel an option with no conditions.';
  }
  return err instanceof Error ? err.message : String(err);
}
