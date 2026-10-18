/**
 * The shapes gear comes in. A base sets the stat it is used with and the damage it deals (a
 * weapon) or turns (armour); materials and abilities make the rest of it.
 */
import type { GearBase } from '../../engine/types';

const base = (b: GearBase): [string, GearBase] => [b.id, b];

export const GEAR_BASES: Record<string, GearBase> = Object.fromEntries([
  // Weapons
  base({ id: 'dagger', kind: 'weapon', name: 'Dagger', stat: 'agility', damage: 'piercing', icon: 'Slice' }),
  base({ id: 'shortsword', kind: 'weapon', name: 'Shortsword', stat: 'agility', damage: 'slashing', icon: 'Sword' }),
  base({ id: 'longsword', kind: 'weapon', name: 'Longsword', stat: 'might', damage: 'slashing', icon: 'Sword' }),
  base({ id: 'rapier', kind: 'weapon', name: 'Rapier', stat: 'agility', damage: 'piercing', icon: 'Sword' }),
  base({ id: 'greatsword', kind: 'weapon', name: 'Greatsword', stat: 'might', damage: 'slashing', icon: 'Sword' }),
  base({ id: 'spear', kind: 'weapon', name: 'Spear', stat: 'agility', damage: 'piercing', icon: 'Crosshair' }),
  base({ id: 'glaive', kind: 'weapon', name: 'Glaive', stat: 'agility', damage: 'slashing', icon: 'Axe' }),
  base({ id: 'axe', kind: 'weapon', name: 'War Axe', stat: 'might', damage: 'slashing', icon: 'Axe' }),
  base({ id: 'mace', kind: 'weapon', name: 'Mace', stat: 'might', damage: 'bludgeoning', icon: 'Gavel' }),
  base({ id: 'club', kind: 'weapon', name: 'Club', stat: 'might', damage: 'bludgeoning', icon: 'Gavel' }),
  base({ id: 'warhammer', kind: 'weapon', name: 'Warhammer', stat: 'might', damage: 'bludgeoning', icon: 'Hammer' }),
  base({ id: 'scythe', kind: 'weapon', name: 'Scythe', stat: 'might', damage: 'slashing', icon: 'Slice' }),
  base({ id: 'bow', kind: 'weapon', name: 'Longbow', stat: 'agility', damage: 'piercing', icon: 'Target' }),
  base({ id: 'crossbow', kind: 'weapon', name: 'Crossbow', stat: 'intellect', damage: 'piercing', icon: 'Target' }),
  base({ id: 'staff', kind: 'weapon', name: 'Staff', stat: 'arcana', damage: 'arcane', icon: 'WandSparkles' }),
  base({ id: 'wand', kind: 'weapon', name: 'Wand', stat: 'arcana', damage: 'arcane', icon: 'Wand' }),
  base({ id: 'tome', kind: 'weapon', name: 'Battle Tome', stat: 'intellect', damage: 'arcane', icon: 'BookOpen' }),
  // Armour
  base({ id: 'robes', kind: 'armor', name: 'Robes', stat: 'arcana', damage: 'arcane', icon: 'Sparkles' }),
  base({ id: 'gambeson', kind: 'armor', name: 'Gambeson', stat: 'vitality', damage: 'bludgeoning', icon: 'Shirt' }),
  base({ id: 'leather', kind: 'armor', name: 'Leathers', stat: 'agility', damage: 'slashing', icon: 'Shirt' }),
  base({ id: 'cloak', kind: 'armor', name: 'Cloak', stat: 'agility', damage: 'shadow', icon: 'Shirt' }),
  base({ id: 'hide', kind: 'armor', name: 'Hide Armour', stat: 'vitality', damage: 'frost', icon: 'PawPrint' }),
  base({ id: 'mail', kind: 'armor', name: 'Chainmail', stat: 'vitality', damage: 'slashing', icon: 'Shield' }),
  base({ id: 'scale', kind: 'armor', name: 'Scale Mail', stat: 'vitality', damage: 'piercing', icon: 'Layers' }),
  base({ id: 'plate', kind: 'armor', name: 'Plate', stat: 'might', damage: 'slashing', icon: 'ShieldCheck' }),
]);

/** Materials by power, 1–10. */
export const GEAR_MATERIALS = ['Rusted', 'Crude', 'Iron', 'Steel', 'Fine Steel', 'Mithril', 'Adamant', 'Dragonforged', 'Starmetal', 'Godforged'];

/** Proper names a legendary or mythical generated item may carry. */
export const LEGEND_NAMES = [
  'Gravesong', 'Oathkeeper', 'Nightfall', 'Emberheart', 'Widowmaker', 'Dawnbreaker', 'Hollowsong', 'Kingsbane',
  'Stormwake', 'Last Light', 'Mourncrest', 'Ironvow', 'Starfall', 'the Quiet End', 'Thornmother', 'Sunder',
];
