import type { GearConfig } from '../../engine/types';
import { GEAR_ABILITIES } from './abilities';
import { GEAR_BASES, GEAR_MATERIALS, LEGEND_NAMES } from './bases';
import { lootFor } from './loot';
import { UNIQUE_GEAR } from './uniques';

export { GEAR_ABILITY_TRAITS, GEAR_DEATH_CHEATS } from './abilities';
export { LOOT_TABLES, lootFor } from './loot';

export const GEAR_CONFIG: GearConfig = {
  bases: GEAR_BASES,
  abilities: GEAR_ABILITIES,
  uniques: UNIQUE_GEAR,
  materials: GEAR_MATERIALS,
  legendNames: LEGEND_NAMES,
  lootFor,
  damageColors: {
    slashing: '#8a94a4',
    piercing: '#9a8a6a',
    bludgeoning: '#7a6a5a',
    fire: '#c2410c',
    frost: '#5aa9d6',
    lightning: '#c9b23c',
    holy: '#e8c86a',
    shadow: '#5a3a7a',
    arcane: '#7c5ae0',
    poison: '#4d8a3a',
  },
  spoilsWheel: {
    title: 'Spoils of Victory',
    nothing: 'Nothing Worth Taking',
    nothingDescription: 'They searched the fallen. Nothing better than what they carry.',
  },
};
