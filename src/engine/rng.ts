/**
 * Randomness is always injected, never reached for directly. Every engine function
 * that rolls takes an `Rng`, so a seed makes an entire run reproducible:
 * tests, shareable world seeds, and replays all fall out of this for free.
 */

/** A source of uniform random numbers in [0, 1). `Math.random` qualifies. */
export type Rng = () => number;

export const defaultRng: Rng = Math.random;

/**
 * Deterministic RNG (mulberry32). Same seed, same sequence.
 * Fast, 32-bit state, and statistically good enough for game rolls.
 */
export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A short random id drawn from `rng`, e.g. "chr_0k3j9x2m7abq". About 62 bits of entropy. */
export function createId(prefix: string, rng: Rng = defaultRng): string {
  const chunk = () => Math.floor(rng() * 36 ** 6).toString(36).padStart(6, '0');
  return `${prefix}_${chunk()}${chunk()}`;
}

/** Any text as a 32-bit seed (FNV-1a): "daily-2026-10-12" or a seed a player typed. */
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The RNG for a seeded run: the same text always rolls the same way. */
export function seededFrom(text: string): Rng {
  return createSeededRng(hashSeed(text));
}
