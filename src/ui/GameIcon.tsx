/**
 * Item and foe art from game-icons.net (CC BY 3.0, credited in the footer): which icon a
 * weapon, a suit of armour or a foe is drawn with, and the component that draws it.
 */
import type { Foe, GearItem, GearKind } from '../engine/types';
import { GAME_ICON_PATHS, type GameIconId } from './gameIconPaths';

/** By gear base (`GearItem.base`). */
const BASE_ICONS: Record<string, GameIconId> = {
  dagger: 'plain-dagger',
  shortsword: 'gladius',
  longsword: 'broadsword',
  rapier: 'stiletto',
  greatsword: 'two-handed-sword',
  spear: 'thrown-spear',
  glaive: 'glaive',
  axe: 'battle-axe',
  mace: 'flanged-mace',
  club: 'wood-club',
  warhammer: 'warhammer',
  scythe: 'scythe',
  bow: 'pocket-bow',
  crossbow: 'crossbow',
  staff: 'wizard-staff',
  wand: 'fairy-wand',
  tome: 'spell-book',
  robes: 'robe',
  gambeson: 'leather-vest',
  leather: 'leather-armor',
  cloak: 'cloak',
  hide: 'fur-shirt',
  mail: 'chain-mail',
  scale: 'scale-mail',
  plate: 'breastplate',
};

export function gearIcon(item: GearItem | null, kind: GearKind): GameIconId {
  if (!item) return kind === 'weapon' ? 'fist' : 'shirt';
  return BASE_ICONS[item.base] ?? (kind === 'weapon' ? 'broadsword' : 'breastplate');
}

/** Foes are matched by name, first match wins: many are made on the spot (a rival, a ruler). */
const FOE_ICONS: [RegExp, GameIconId][] = [
  [/goblin/, 'goblin-head'],
  [/brood|spider/, 'spider-alt'],
  [/troll/, 'troll'],
  [/guardian|golem|statue/, 'rock-golem'],
  [/wight|ghost|spirit|barrow/, 'ghost'],
  [/wyvern/, 'wyvern'],
  [/dragon|wyrm|drake/, 'dragon-head'],
  [/man-eater|beast|wolf/, 'wolf-head'],
  [/duelist/, 'fencer'],
  [/mage|sorcer|witch|warlock/, 'wizard-face'],
  [/tournament|champion|knight/, 'mounted-knight'],
  [/usurper|ruler|king|queen|crown/, 'crowned-skull'],
  [/host|army|war|company|siege|besieg/, 'knight-banner'],
  [/breach|horror|thing/, 'tentacles-skull'],
  [/demon|devil|abyss/, 'devil-mask'],
  [/titan|giant/, 'giant'],
  [/death|reaper/, 'grim-reaper'],
  [/bandit|outlaw|pursuer|hunter|assassin/, 'hood'],
  [/lieutenant|dark champion/, 'barbarian'],
  [/rival|hero|legend/, 'swordman'],
];

export function foeIcon(foe: Pick<Foe, 'name'>): GameIconId {
  const name = foe.name.toLowerCase();
  return FOE_ICONS.find(([re]) => re.test(name))?.[1] ?? 'crossed-swords';
}

export function GameIcon({ icon, size = 24, className, title }: { icon: GameIconId; size?: number; className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      dangerouslySetInnerHTML={{ __html: GAME_ICON_PATHS[icon] }}
    />
  );
}

/** The CC BY credit, in small print. */
export function GameIconsCredit({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[0.65rem] leading-snug text-ash/80 ${className}`}>
      Item and foe icons by Lorc, Delapouite &amp; contributors from{' '}
      <a href="https://game-icons.net" target="_blank" rel="noreferrer" className="underline decoration-dotted hover:text-vellum">
        game-icons.net
      </a>
      , used under{' '}
      <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer" className="underline decoration-dotted hover:text-vellum">
        CC BY 3.0
      </a>
      .
    </p>
  );
}
