/**
 * Feats: achievements earned across every world. Each one is a test over the world's
 * characters, living and gone; the first time one passes, it is written into the profile
 * (profile.ts) with who earned it, and stays earned through any reset.
 *
 * Tests read only what characters already remember (their rolls, adventures, traits, fate),
 * so a world from before feats existed can still earn them the moment it loads.
 */
import { weaponPower } from '../engine/gear';
import { calculatePowerRating } from '../engine/power';
import { fameStanding } from '../engine/fame';
import { STAT_KEYS, type Character, type GameConfig, type World } from '../engine/types';
import type { Profile } from './profile';

export interface Feat {
  id: string;
  name: string;
  description: string;
  /** lucide-react icon name, from ui/icons. */
  icon: string;
  /** Who earned it in this world, or null if no one has (yet). For progress feats, `progress`. */
  earnedBy: (ctx: FeatContext) => Character | true | null;
  /** For feats that count toward a total: [have, need]. */
  progress?: (ctx: FeatContext) => [number, number];
}

export interface FeatContext {
  world: World;
  config: GameConfig;
  profile: Profile;
  /** Every soul the player rolled that the world remembers, oldest first. The world's own rivals earn nothing. */
  everyone: Character[];
  /** Those of them who set out on a road. */
  heroes: Character[];
  /** The player's souls in the graveyard and the Hall of Fame. */
  graves: Character[];
  hallOfFame: Character[];
}

const tierAt = (ctx: FeatContext, c: Character) => fameStanding(ctx.config.fame.tiers, c.fame).tier.name;
const reached = (tier: string) => (ctx: FeatContext) =>
  ctx.heroes.find((c) => ctx.config.fame.tiers.findIndex((t) => t.name === tierAt(ctx, c)) >= ctx.config.fame.tiers.findIndex((t) => t.name === tier)) ?? null;
const allRolls = (c: Character) => [...c.history, ...c.adventures.flatMap((a) => a.rolls)];

export const FEATS: Feat[] = [
  { id: 'first_steps', name: 'First Steps', description: 'Come home from an adventure.', icon: 'Footprints', earnedBy: (x) => x.heroes.find((c) => c.adventures.some((a) => a.outcome === 'returned')) ?? null },
  { id: 'six_feet_under', name: 'Six Feet Under', description: 'Lose a hero to the road.', icon: 'Skull', earnedBy: (x) => x.graves[0] ?? null },
  { id: 'short_road', name: 'A Short Road', description: 'Die on the very first adventure.', icon: 'Hourglass', earnedBy: (x) => x.graves.find((c) => c.adventures.length === 1) ?? null },
  { id: 'hung_up_the_sword', name: 'Hung Up the Sword', description: 'Take a seat in the Hall of Fame.', icon: 'Trophy', earnedBy: (x) => x.hallOfFame.find((c) => c.status !== 'sealed') ?? null },
  { id: 'known', name: 'A Name in the Taverns', description: 'Reach Known fame.', icon: 'Beer', earnedBy: reached('Known') },
  { id: 'renowned', name: 'Bards Want the Details', description: 'Reach Renowned fame.', icon: 'Music', earnedBy: reached('Renowned') },
  { id: 'famous', name: 'Kingdoms Know the Name', description: 'Reach Famous fame.', icon: 'Flag', earnedBy: reached('Famous') },
  { id: 'mythic', name: 'More Story Than Person', description: 'Reach Mythic fame.', icon: 'Sparkles', earnedBy: reached('Mythic') },
  { id: 'seasoned', name: 'Seasoned', description: 'Live through ten adventures in one life.', icon: 'Route', earnedBy: (x) => x.heroes.find((c) => c.adventures.length >= 10) ?? null },
  { id: 'long_road', name: 'The Long Road', description: 'Live through twenty-five adventures in one life.', icon: 'Mountain', earnedBy: (x) => x.heroes.find((c) => c.adventures.length >= 25) ?? null },
  { id: 'heavy_head', name: 'Heavy Is the Head', description: 'Take a throne.', icon: 'Crown', earnedBy: (x) => x.everyone.find((c) => c.tags.includes('ruler') || c.traits.some((t) => t.id.startsWith('ruler_') || t.id === 'npc_monarch')) ?? null },
  { id: 'greater_love', name: 'Greater Love', description: 'Give a life so others could live.', icon: 'Sunrise', earnedBy: (x) => x.graves.find((c) => c.tags.includes('martyr')) ?? null },
  { id: 'bottled', name: 'Bottled Soul', description: 'Seal a soul inside a relic.', icon: 'Gem', earnedBy: (x) => x.hallOfFame.find((c) => c.status === 'sealed') ?? null },
  { id: 'gone_bad', name: 'Gone Bad', description: 'Watch a hero turn outlaw, or kneel to the Abyss.', icon: 'UserX', earnedBy: (x) => x.heroes.find((c) => c.role === 'outlaw' || c.role === 'minion') ?? null },
  { id: 'throne_below', name: 'The Throne Below', description: 'Roll a Demon Lord.', icon: 'Flame', earnedBy: (x) => x.everyone.find((c) => c.role === 'demonLord' || c.history.some((r) => r.optionId === 'demon_lord')) ?? null },
  { id: 'divine_spark', name: 'Divine Spark', description: 'Roll a god.', icon: 'Sun', earnedBy: (x) => x.everyone.find((c) => c.history.some((r) => r.stepId === 'ancestry' && r.optionId === 'god')) ?? null },
  { id: 'transcendent', name: 'Less Something They Use', description: 'Master a power to Transcendent.', icon: 'WandSparkles', earnedBy: (x) => x.everyone.find((c) => c.traits.some((t) => t.rank === 'Transcendent')) ?? null },
  { id: 'past_the_ladder', name: 'Past the Ladder', description: 'Ascend a stat beyond 25.', icon: 'BicepsFlexed', earnedBy: (x) => x.everyone.find((c) => STAT_KEYS.some((k) => c.stats[k] > 25)) ?? null },
  { id: 'arms_of_legend', name: 'Arms of Legend', description: 'Carry a weapon of power 8 or higher.', icon: 'Sword', earnedBy: (x) => x.everyone.find((c) => weaponPower(c) >= 8) ?? null },
  { id: 'thousand_strong', name: 'A Thousand Strong', description: 'Reach 1,000 Combat Power.', icon: 'Zap', earnedBy: (x) => x.everyone.find((c) => calculatePowerRating(c) >= 1000) ?? null },
  { id: 'against_all_odds', name: 'Against All Odds', description: 'Land a slice with less than half a percent chance.', icon: 'Dices', earnedBy: (x) => x.everyone.find((c) => allRolls(c).some((r) => r.probability > 0 && r.probability < 0.005 && !r.chosen)) ?? null },
  { id: 'standing_on_graves', name: 'Standing on Graves', description: 'Meet someone from an earlier life on the road.', icon: 'Users', earnedBy: (x) => x.heroes.find((c) => c.adventures.some((a) => a.rolls.some((r) => r.cast))) ?? null },
  { id: 'crowded_graveyard', name: 'A Crowded Graveyard', description: 'Bury ten of your heroes in one world.', icon: 'Skull', earnedBy: (x) => x.graves[9] ?? null, progress: (x) => [Math.min(10, x.graves.length), 10] },
  { id: 'bloodline', name: 'Bloodline', description: 'Raise a house to its third generation.', icon: 'Sprout', earnedBy: (x) => x.everyone.find((c) => (c.lineage?.generation ?? 1) >= 3) ?? null },
  { id: 'daily_devotion', name: 'Daily Devotion', description: 'See a Daily Soul’s story to its end.', icon: 'CalendarDays', earnedBy: (x) => (x.profile.dailies.length > 0 ? true : null) },
  {
    id: 'every_kind',
    name: 'Every Kind of Soul',
    description: 'Roll every ancestry on the Wheel of Ancestry, across any worlds.',
    icon: 'Shapes',
    earnedBy: (x) => {
      const [have, need] = ancestryProgress(x);
      return have >= need ? true : null;
    },
    progress: (x) => ancestryProgress(x),
  },
];

function ancestryProgress(x: FeatContext): [number, number] {
  const all = x.config.steps['ancestry']?.options.map((o) => o.id) ?? [];
  return [all.filter((id) => x.profile.ancestries.includes(id)).length, all.length];
}

/** Every character the world remembers, oldest first, and those of them who set out as heroes. */
export function featContext(world: World, config: GameConfig, profile: Profile): FeatContext {
  const mine = (c: Character) => !c.worldBorn;
  const everyone = [...world.roster, ...world.graveyard, ...world.hallOfFame].filter(mine).sort((a, b) => a.createdAt - b.createdAt);
  return {
    world,
    config,
    profile,
    everyone,
    heroes: everyone.filter((c) => c.adventures.length > 0 || c.role === 'hero'),
    graves: world.graveyard.filter(mine),
    hallOfFame: world.hallOfFame.filter(mine),
  };
}

/** Ancestries rolled in this world that the profile hasn't counted yet. */
export function newAncestries(world: World, profile: Profile): string[] {
  const rolled = new Set(
    [...world.roster, ...world.graveyard, ...world.hallOfFame].filter((c) => !c.worldBorn).flatMap((c) => c.history.filter((r) => r.stepId === 'ancestry').map((r) => r.optionId)),
  );
  return [...rolled].filter((id) => !profile.ancestries.includes(id));
}

/** Feats this world has earned that the profile doesn't have yet, with who earned them. */
export function newlyEarned(ctx: FeatContext): { feat: Feat; by?: string }[] {
  return FEATS.flatMap((feat) => {
    if (ctx.profile.achievements[feat.id]) return [];
    const by = feat.earnedBy(ctx);
    if (!by) return [];
    return [{ feat, ...(by !== true && { by: by.name }) }];
  });
}
