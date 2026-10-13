export type EngineErrorCode =
  /** Every option on a wheel is locked or has zero weight. */
  | 'NO_ELIGIBLE_OPTIONS'
  /** A `nextStepId` or `entryStepId` points at a wheel that does not exist. */
  | 'UNKNOWN_STEP'
  /** An option grants a trait id that is not in `GameConfig.traits`. */
  | 'UNKNOWN_TRAIT'
  /** An option sets a race id that is not in `GameConfig.races`. */
  | 'UNKNOWN_RACE'
  /** An option sets a personality id that is not in `GameConfig.personalities`. */
  | 'UNKNOWN_PERSONALITY'
  | 'UNKNOWN_ARCHETYPE'
  /** The character is not in the world's roster (it left play, or the world was reset). */
  | 'UNKNOWN_CHARACTER'
  /** Tried to spin after `nextStepId` was already null. */
  | 'GENERATION_COMPLETE'
  /** The graph looped more than `MAX_GENERATION_STEPS` times. */
  | 'STEP_LIMIT'
  /** A one-of-a-kind role was claimed by someone else while this character was rolling. */
  | 'SINGLETON_CONFLICT'
  /** A new hero was committed while the player's last hero is still alive: one life at a time. */
  | 'HERO_ALIVE'
  /** The character is in the wrong lifecycle state for this operation. */
  | 'INVALID_STATUS'
  /** A choice that isn't on this wheel, is locked, or a wheel that is spun rather than chosen. */
  | 'INVALID_CHOICE';

/**
 * The only error type the engine throws. Switch on `code` in the UI rather than
 * parsing messages.
 */
export class EngineError extends Error {
  readonly code: EngineErrorCode;

  constructor(code: EngineErrorCode, message: string) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
  }
}
