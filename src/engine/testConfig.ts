/**
 * For tests about everything but archetypes: a config whose Wheel of Archetypes has one slice,
 * an archetype with no rules, so a rolled soul spins, bets and fights like anyone. Tests only.
 */
import type { GameConfig, GearItem, GearKind, StatKey } from './types';

export function plainArchetypes(config: GameConfig): GameConfig {
  const wheel = config.steps['archetype'];
  if (!wheel) return config;
  return {
    ...config,
    archetypes: { ...config.archetypes, plain: { id: 'plain', name: 'Plain', rarity: 'common', description: 'Fate treats them like anyone.' } },
    steps: {
      ...config.steps,
      archetype: { ...wheel, options: [{ id: 'plain', label: 'Plain', baseWeight: 1, setArchetype: 'plain', nextStepId: 'fate' }] },
    },
  };
}

/** A plain weapon or armour of this power, with no abilities, for tests: wielded with Might, worn with Vitality, unless told otherwise. */
export function plainItem(kind: GearKind, power: number, stat: StatKey = kind === 'weapon' ? 'might' : 'vitality'): GearItem {
  return { id: `test_${kind}_${power}_${stat}`, kind, name: `Test ${kind} ${power}`, base: kind === 'weapon' ? 'longsword' : 'mail', rarity: 'common', power, stat, abilities: [] };
}
