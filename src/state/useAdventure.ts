/**
 * React wrapper around one adventure at a time. As in creation, the engine call that
 * picks each winner runs in the event handler, so state updaters stay pure (StrictMode safe).
 *
 * The world is written the moment the final wheel LANDS, not when the player clicks on.
 * A death is a death: walking away from the reveal can't undo it.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { chooseAdventure, getAdventureStep, spinAdventure, startAdventure, type AdventureState } from '../engine/adventure';
import { EngineError } from '../engine/errors';
import { getStep } from '../engine/generation';
import { defaultRng, seededFrom, type Rng } from '../engine/rng';
import type { Character, GameConfig, World } from '../engine/types';
import type { SpinRequest } from '../ui/wheel/SpinWheel';
import { advance, createFlowSession, settleSpin, startSpin, viewFlow, type SpinSession } from './generationSession';
import type { CommitResult } from './useWorld';

export type AdventureSession = SpinSession<AdventureState>;

export function useAdventure(config: GameConfig, world: World, finish: (state: AdventureState) => CommitResult) {
  const [session, setSession] = useState<AdventureSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The final state already written to the world, so a repeated settle can't write it twice. */
  const committed = useRef<AdventureState | null>(null);
  /** A seeded hero's adventure draws from its own stream (`seed:n`), so it can be replayed. */
  const rng = useRef<Rng>(defaultRng);

  // The wheel as the hero faces it: whoever this wheel has cast, and the outcomes only they bring.
  const state = session?.state;
  const lookupStep = useCallback(
    (stepId: string) => (state ? getAdventureStep(config, stepId, state) : getStep(config, stepId)),
    [config, state],
  );
  const view = useMemo(
    () => (session ? viewFlow(session, config, lookupStep, world) : null),
    [session, config, lookupStep, world],
  );

  /** The request the wheel animates. Same object for the whole spin, a new one per spin. */
  const phase = session?.phase;
  const spinCount = session?.spinCount ?? 0;
  const pending = session?.pending ?? null;
  const spinRequest = useMemo<SpinRequest | null>(
    () => (phase === 'spinning' && pending ? { id: spinCount, targetIndex: pending.roll.winner.index } : null),
    [phase, spinCount, pending],
  );

  const embark = useCallback(
    (hero: Character) => {
      try {
        committed.current = null;
        rng.current = hero.seed ? seededFrom(`${hero.seed}:${hero.adventures.length}`) : defaultRng;
        setSession(createFlowSession(startAdventure(config, hero)));
        setError(null);
      } catch (err) {
        setError(describe(err));
      }
    },
    [config],
  );

  const spin = useCallback(() => {
    if (!session || session.phase !== 'ready') return;
    try {
      const outcome = spinAdventure(session.state, config, world, rng.current);
      setError(null);
      setSession((s) => (s ? startSpin(s, outcome) : s));
    } catch (err) {
      setError(describe(err));
    }
  }, [session, config, world]);

  /** A decision on a choice wheel: no spin, the chosen option is revealed at once. */
  const choose = useCallback(
    (optionId: string) => {
      if (!session || session.phase !== 'ready') return;
      try {
        const outcome = chooseAdventure(session.state, config, world, optionId, rng.current);
        if (outcome.state.currentStepId === null) {
          committed.current = outcome.state;
          const result = finish(outcome.state);
          if (!result.ok) {
            setError(result.message);
            setSession(null);
            return;
          }
        }
        setError(null);
        setSession((s) => (s ? settleSpin(startSpin(s, outcome), s.spinCount + 1) : s));
      } catch (err) {
        setError(describe(err));
      }
    },
    [session, config, world, finish],
  );

  const settle = useCallback(
    (spinId: number) => {
      const landed = session?.phase === 'spinning' && spinId === session.spinCount ? session.pending?.state : undefined;
      if (landed && landed.currentStepId === null && committed.current !== landed) {
        committed.current = landed;
        const result = finish(landed);
        if (!result.ok) {
          setError(result.message);
          setSession(null);
          return;
        }
      }
      setSession((s) => (s ? settleSpin(s, spinId) : s));
    },
    [session, finish],
  );

  const next = useCallback(() => setSession((s) => (s ? advance(s) : s)), []);

  /** Back to choosing a hero. Only offered once the adventure is over (or on reset). */
  const leave = useCallback(() => {
    setSession(null);
    setError(null);
  }, []);

  return { session, view, spinRequest, error, embark, spin, choose, settle, next, leave };
}

function describe(err: unknown): string {
  if (err instanceof EngineError && err.code === 'NO_ELIGIBLE_OPTIONS') {
    return 'Every slice on this wheel is locked. Change the world, or give this wheel an option with no conditions.';
  }
  return err instanceof Error ? err.message : String(err);
}
