import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { GAME_CONFIG } from '../src/config/gameConfig';
import { validateGameConfig } from '../src/engine/validate';
it('validate', () => {
  const r = validateGameConfig(GAME_CONFIG);
  writeFileSync('scripts/validate-out.txt', [...r.errors.map((e) => 'E ' + e), ...r.warnings.map((w) => 'W ' + w)].join('\n'));
});
