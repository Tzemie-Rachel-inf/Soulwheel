/**
 * The persistent World, kept in React state and mirrored to localStorage. Every change it
 * makes also goes into the world's chronicle (chronicle.ts).
 *
 * Engine calls that can throw (commitCharacter) run in the event handler, never
 * inside a state updater, so a rejected commit becomes a message instead of a crash.
 */
import { useCallback, useEffect, useState } from 'react';
import { completeAdventure, type AdventureState } from '../engine/adventure';
import { EngineError } from '../engine/errors';
import { loadWorld, saveWorld, type StorageLike } from '../engine/persistence';
import type { Character, GameConfig, World } from '../engine/types';
import { commitCharacter, createWorld } from '../engine/world';
import { backfillChronicle, chronicleAdventure, chronicleArrival } from './chronicle';
import { worldTurn } from './worldTurn';

/** localStorage can be missing or throw (private windows, sandboxed frames). Treat that as "no storage". */
function getStorage(): StorageLike | null {
  try {
    const storage = window.localStorage;
    storage.getItem('__probe__');
    return storage;
  } catch {
    return null;
  }
}

export type CommitResult = { ok: true; world: World } | { ok: false; message: string };

/**
 * Whether the world is reaching the browser's storage. 'unavailable': there is none to write to
 * (a private window, blocked site data); 'failed': the last save was refused (storage full, most
 * likely, as a long world's graveyard and chronicle grow). Either way the world keeps running,
 * but only in this tab.
 */
export type SaveStatus = 'saved' | 'unavailable' | 'failed';

export function useWorld(config: GameConfig) {
  const [world, setWorld] = useState<World>(() => {
    const storage = getStorage();
    const loaded = storage && loadWorld(storage, config);
    return loaded ? backfillChronicle(loaded, config) : createWorld();
  });

  const [saveStatus, setSaveStatus] = useState<SaveStatus>(() => (getStorage() ? 'saved' : 'unavailable'));
  /** Bumped to try a refused save again. */
  const [saveAttempt, setSaveAttempt] = useState(0);

  // Every change is written at once. When it can't be, the world keeps running in memory, and the
  // player is told (see SaveWarning): closing the tab would otherwise end their hero's life silently.
  useEffect(() => {
    const storage = getStorage();
    let status: SaveStatus = 'unavailable';
    if (storage) {
      try {
        saveWorld(world, storage);
        status = 'saved';
      } catch {
        status = 'failed';
      }
    }
    setSaveStatus((was) => (was === status ? was : status));
  }, [world, saveAttempt]);

  const retrySave = useCallback(() => setSaveAttempt((n) => n + 1), []);

  /** Place a finished character in the world. Writes any one-of-a-kind roles it claimed. */
  const commit = useCallback(
    (character: Character): CommitResult => {
      try {
        const next = chronicleArrival(commitCharacter(world, character), character, config);
        setWorld(next);
        return { ok: true, world: next };
      } catch (err) {
        const message =
          err instanceof EngineError && err.code === 'SINGLETON_CONFLICT'
            ? 'Someone else claimed one of this character’s one-of-a-kind roles first. Discard and roll again.'
            : err instanceof Error
              ? err.message
              : String(err);
        return { ok: false, message };
      }
    },
    [world, config],
  );

  /** Write a finished adventure: the hero comes home changed, or leaves for the graveyard or hall of fame. */
  const finishAdventure = useCallback(
    (state: AdventureState): CommitResult => {
      try {
        // The season passes, and while the hero rests the world takes its own turn.
        const before = world.roster.find((c) => c.id === state.character.id);
        const next = worldTurn(chronicleAdventure(world, completeAdventure(world, state), state.character.id, config), config, before);
        setWorld(next);
        return { ok: true, world: next };
      } catch (err) {
        const message =
          err instanceof EngineError && err.code === 'UNKNOWN_CHARACTER'
            ? `${state.character.name} is no longer in this world, so the adventure was lost.`
            : err instanceof Error
              ? err.message
              : String(err);
        return { ok: false, message };
      }
    },
    [world, config],
  );

  const setThreatLevel = useCallback((threatLevel: number) => {
    setWorld((w) => ({ ...w, threatLevel }));
  }, []);

  const resetWorld = useCallback(() => setWorld(createWorld()), []);

  return { world, commit, finishAdventure, setThreatLevel, resetWorld, saveStatus, retrySave };
}
