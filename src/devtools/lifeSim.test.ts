/** The life simulation, as a quick smoke test. The full report: scripts/life-sim.test.ts. */
import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../config/gameConfig';
import { simulateLives, summarize } from './lifeSim';

describe('life simulation', () => {
  it('lives a few heroes from creation to the end of their story', () => {
    const lives = simulateLives(GAME_CONFIG, { worlds: 2, heroesPerWorld: 3, seed: 11 });
    expect(lives.length).toBe(6);
    for (const life of lives) {
      expect(life.adventures).toBeGreaterThan(0);
      expect(life.spins).toBeGreaterThanOrEqual(life.adventures * 2);
    }
    const summary = summarize(lives);
    expect(summary.lives).toBe(6);
    expect(summary.veryInteresting).toBeLessThanOrEqual(6);
  });
});
