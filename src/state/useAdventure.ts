/**
 * React wrapper around one adventure at a time. As in creation, the engine call that
 * picks each winner runs in the event handler, so state updaters stay pure (StrictMode safe).
 *
 * The world is written the moment the final wheel LANDS, not when the player clicks on.
 * A death is a death: walking away from the reveal can't undo it.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { castInBattle, chooseAdventure, decideAdventure, getAdventureStep, spinAdventure, startAdventure, type AdventureState } from '../engine/adventure';
import { EngineError } from '../engine/errors';
import { getStep } from '../engine/generation';
import { defaultRng, seededFrom, type Rng } from '../engine/rng';
import type { Character, GameConfig, SpellMode, World } from '../engine/types';
import type { SpinRequest } from '../ui/wheel/SpinWheel';
import { advance, createFlowSession, pickSpin, settleSpin, smashSpin, startSpin, viewFlow, type Side, type SpinSession } from './generationSession';
import type { CommitResult } from './useWorld';

export type AdventureSession = SpinSession<AdventureState>;

/** Where the playtest switch between the two ways of casting spells is remembered, per browser. */
const SPELL_MODE_KEY = 'chronicle.battleSpells';

function loadSpellMode(fallback: SpellMode): SpellMode {
  try {
    const saved = localStorage.getItem(SPELL_MODE_KEY);
    return saved === 'auto' || saved === 'choose' ? saved : fallback;
  } catch {
    return fallback;
  }
}

export function useAdventure(config: GameConfig, world: World, finish: (state: AdventureState) => CommitResult) {
  const [session, setSession] = useState<AdventureSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The final state already written to the world, so a repeated settle can't write it twice. */
  const committed = useRef<AdventureState | null>(null);
  /** A seeded hero's adventure draws from its own stream (`seed:n`), so it can be replayed. */
  const rng = useRef<Rng>(defaultRng);
  /** Boss battles: spells on the wheel, or cast by the player (a playtest switch; one is to be retired). */
  const [spellMode, setSpellModeState] = useState<SpellMode>(() => loadSpellMode(config.adventure.battleSpells ?? 'auto'));

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
  /** A Wise hero's second wheel: the same spin, its own target. */
  const right = session?.wise?.right;
  const altSpinRequest = useMemo<SpinRequest | null>(
    () => (phase === 'spinning' && right ? { id: spinCount, targetIndex: right.roll.winner.index } : null),
    [phase, spinCount, right],
  );

  /**
   * Write a final state to the world the moment it is decided (the last wheel lands, is smashed,
   * or is kept): false if the world refused it. A repeated call can't write it twice.
   */
  const commitIfOver = useCallback(
    (landed: AdventureState | undefined): boolean => {
      if (!landed || landed.currentStepId !== null || committed.current === landed) return true;
      committed.current = landed;
      const result = finish(landed);
      if (result.ok) return true;
      setError(result.message);
      setSession(null);
      return false;
    },
    [finish],
  );

  const embark = useCallback(
    (hero: Character) => {
      try {
        committed.current = null;
        rng.current = hero.seed ? seededFrom(`${hero.seed}:${hero.adventures.length}`) : defaultRng;
        setSession(createFlowSession(startAdventure(config, hero, { spellMode })));
        setError(null);
      } catch (err) {
        setError(describe(err));
      }
    },
    [config, spellMode],
  );

  /**
   * Switch how battles cast spells. Takes effect at once between spins; a battle under way keeps
   * the odds it was solved with, so the fairest test starts a fresh battle.
   */
  const setSpellMode = useCallback((mode: SpellMode) => {
    setSpellModeState(mode);
    try {
      localStorage.setItem(SPELL_MODE_KEY, mode);
    } catch {
      // Private windows: the switch still works for this visit.
    }
    setSession((s) => (s && s.phase === 'ready' ? { ...s, state: { ...s.state, spellMode: mode } } : s));
  }, []);

  /** In a choose-mode battle: cast a spell before the spin. No wheel turns. */
  const cast = useCallback(
    (spellId: string) => {
      if (!session || session.phase !== 'ready') return;
      try {
        const state = castInBattle(session.state, config, spellId, rng.current);
        setError(null);
        setSession((s) => (s && s.phase === 'ready' ? { ...s, state } : s));
      } catch (err) {
        setError(describe(err));
      }
    },
    [session, config],
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
      // A Wise hero's spin is decided when they keep one, not when it lands.
      const landed = session?.phase === 'spinning' && spinId === session.spinCount && !session.wise ? session.pending?.state : undefined;
      if (!commitIfOver(landed)) return;
      setSession((s) => (s ? settleSpin(s, spinId) : s));
    },
    [session, commitIfOver],
  );
  const settleAlt = useCallback((spinId: number) => setSession((s) => (s ? settleSpin(s, spinId, 'right') : s)), []);

  /** A Wise hero keeps one of their two rolls. */
  const pick = useCallback(
    (side: Side) => {
      if (session?.phase !== 'picking' || !session.wise) return;
      if (!commitIfOver(session.wise[side].state)) return;
      setSession((s) => (s ? pickSpin(s, side) : s));
    },
    [session, commitIfOver],
  );

  /** An Ancient's decree: the wheel turns to the slice they named. */
  const decree = useCallback(
    (index: number) => {
      if (!session || session.phase !== 'ready') return;
      try {
        const outcome = decideAdventure(session.state, config, world, index, 'decree', rng.current);
        setError(null);
        setSession((s) => (s ? startSpin(s, outcome) : s));
      } catch (err) {
        setError(describe(err));
      }
    },
    [session, config, world],
  );

  /** A Brute's Smash: the wheel stopped dead on slice `index`, and that is the roll. */
  const smash = useCallback(
    (spinId: number, index: number) => {
      if (!session || session.phase !== 'spinning' || spinId !== session.spinCount) return;
      try {
        const outcome = decideAdventure(session.state, config, world, index, 'smash', rng.current);
        if (!commitIfOver(outcome.state)) return;
        setSession((s) => (s ? smashSpin(s, spinId, outcome) : s));
      } catch (err) {
        setError(describe(err));
      }
    },
    [session, config, world, commitIfOver],
  );

  const next = useCallback(() => setSession((s) => (s ? advance(s) : s)), []);

  /** Back to choosing a hero. Only offered once the adventure is over (or on reset). */
  const leave = useCallback(() => {
    setSession(null);
    setError(null);
  }, []);

  return { session, view, spinRequest, altSpinRequest, error, embark, spin, decree, smash, choose, settle, settleAlt, pick, next, leave, cast, spellMode, setSpellMode };
}

function describe(err: unknown): string {
  if (err instanceof EngineError && err.code === 'NO_ELIGIBLE_OPTIONS') {
    return 'Every slice on this wheel is locked. Change the world, or give this wheel an option with no conditions.';
  }
  return err instanceof Error ? err.message : String(err);
}
