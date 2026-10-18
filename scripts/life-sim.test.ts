/**
 * The full life-simulation report, on demand (skipped otherwise):
 *
 *   LIFE_SIM_OUT=report.json LIFE_SIM_LIVES=500 npx vitest run scripts/life-sim.test.ts
 *
 * LIFE_SIM_SPELLS=auto or choose picks how boss battles cast spells, to compare the two.
 *
 * Heroes live 25 to a world, so later heroes meet earlier ones. LIFE_SIM_SEED picks the run.
 */
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { GAME_CONFIG } from '../src/config/gameConfig';
import { simulateLives, summarize } from '../src/devtools/lifeSim';

const out = process.env.LIFE_SIM_OUT;

it.runIf(Boolean(out))('writes the life-simulation report', () => {
  const total = Number(process.env.LIFE_SIM_LIVES ?? 500);
  const perWorld = 25;
  const seed = Number(process.env.LIFE_SIM_SEED ?? 2026);
  // LIFE_SIM_SPELLS=auto|choose: how boss battles cast spells.
  const spells = process.env.LIFE_SIM_SPELLS;
  const spellMode = spells === 'auto' || spells === 'choose' ? spells : undefined;
  const lives = simulateLives(GAME_CONFIG, { worlds: Math.ceil(total / perWorld), heroesPerWorld: perWorld, seed, ...(spellMode && { spellMode }) }).slice(0, total);
  writeFileSync(out!, JSON.stringify({ summary: summarize(lives), lives }, null, 1));
}, 600_000);
