/**
 * Dynasties: a hero whose story has ended, and whose name meant something, can have an heir.
 * The heir is a new soul rolled as usual, born into their parent's house:
 *
 *   - they carry the house's name, whatever the wheels would have called them;
 *   - the Wheel of Ancestry leans hard toward the parent's ancestry (config/races.ts), so a
 *     dwarf's child is almost always a dwarf (a different roll means they were taken in);
 *   - one point is banked in the parent's best stat, hammered in when that stat is rolled;
 *   - the name opens a few doors: a tenth of the parent's fame, up to HEIR_FAME_CAP.
 *
 * One heir per parent, so a house is a line, generation after generation.
 */
import { STAT_KEYS, type Character, type World } from './types';

/** The least fame worth inheriting: Known. */
export const HEIR_MIN_FAME = 6;
/** The most fame an heir starts with. */
export const HEIR_FAME_CAP = 10;

/** Everyone the world remembers. */
const everyone = (world: World) => [...world.roster, ...world.graveyard, ...world.hallOfFame];

/** The house a character heads or belongs to: their house, or their family name, or their own name. */
export function houseOf(char: Character): string {
  if (char.lineage) return char.lineage.house;
  const words = char.name.trim().split(/\s+/);
  return words.length > 1 ? words.at(-1)! : (words[0] ?? 'Nameless');
}

/** Their heir, if they have one. */
export function heirOf(world: World, parent: Character): Character | undefined {
  return everyone(world).find((c) => c.lineage?.parentId === parent.id);
}

/**
 * Whether this character can still name an heir: their story is over, they were not lost to
 * banditry or the Abyss, their name means something, and they have no heir yet.
 */
export function canNameHeir(world: World, char: Character): boolean {
  const over = char.status !== 'alive' || char.role !== 'hero';
  const lost = char.role === 'outlaw' || char.role === 'minion' || char.role === 'demonLord';
  return over && !lost && char.status !== 'rolling' && char.fame >= HEIR_MIN_FAME && !heirOf(world, char);
}

/** The stat a parent was best at: the one their heir has a head start in. */
export function bestStat(char: Character) {
  return STAT_KEYS.reduce((best, k) => (char.stats[k] > char.stats[best] ? k : best), STAT_KEYS[0]);
}

/** A fresh soul, made the heir of `parent`: their house, a banked point, a little fame. */
export function asHeir(soul: Character, parent: Character): Character {
  const ancestry = parent.history.find((r) => r.stepId === 'ancestry')?.optionId;
  const stat = bestStat(parent);
  return {
    ...soul,
    lineage: {
      house: houseOf(parent),
      generation: (parent.lineage?.generation ?? 1) + 1,
      parentId: parent.id,
      ...(ancestry && { ancestry }),
    },
    statBonus: { ...soul.statBonus, [stat]: soul.statBonus[stat] + 1 },
    fame: Math.min(HEIR_FAME_CAP, Math.round(parent.fame / 10)),
  };
}

/** A house, founder first: everyone in the line, by generation. */
export interface House {
  name: string;
  members: Character[];
}

/** Every house in the world: lines with at least one heir in them, founders first. */
export function housesOf(world: World): House[] {
  const all = everyone(world);
  const heirs = all.filter((c) => c.lineage);
  const founders = all.filter((c) => !c.lineage && heirs.some((h) => h.lineage!.parentId === c.id));
  return founders.map((founder) => {
    const members = [founder];
    for (let next = heirOf(world, founder); next; next = heirOf(world, next)) members.push(next);
    return { name: houseOf(founder), members };
  });
}
