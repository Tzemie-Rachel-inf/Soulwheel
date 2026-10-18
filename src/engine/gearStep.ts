/**
 * The Keep / Take choice: an item found for a slot that is already filled waits in the hero's
 * `gearOffers`, and this wheel (a choice, never spun) asks them to keep what they have or take
 * it. Shared by creation and adventures, so a new weapon is picked up the same way everywhere.
 */
import { GEAR_KIND_LABEL, gearStat, offerIsBetter, pendingOffer, slotOf } from './gear';
import type { Character, GameConfig, GearItem, WheelStep } from './types';

/** The Keep / Take choice, for an item offered while that slot is filled. Built on the spot, from the hero's `gearOffers`. */
export const GEAR_STEP_ID = 'gear:choose';

/** True for the Keep / Take choice. */
export function isGearStep(stepId: string): boolean {
  return stepId === GEAR_STEP_ID;
}

/** A line saying what an item is: 'Rare weapon · power 4 · Agility · piercing'. With a bearer, the stat is the one they would use it with. */
export function describeGear(item: GearItem, bearer?: Character): string {
  const element = item.kind === 'weapon' ? item.damage : item.resists && `turns ${item.resists}`;
  const used = bearer ? gearStat(item, bearer) : item.stat;
  const stat = used[0]!.toUpperCase() + used.slice(1);
  return [`${item.rarity[0]!.toUpperCase()}${item.rarity.slice(1)} ${GEAR_KIND_LABEL[item.kind]}`, `power ${item.power}`, stat, element].filter(Boolean).join(' · ');
}

/**
 * The Keep / Take choice for the oldest item offered: keep what they have, or take it. A hero
 * left to themselves (an autoplay) takes whichever makes them stronger.
 */
export function createGearStep(config: GameConfig, char: Character): WheelStep {
  const offer = pendingOffer(char);
  const current = offer && slotOf(char, offer.kind);
  const better = offer ? offerIsBetter(char, offer, config) : false;
  const kind = offer ? GEAR_KIND_LABEL[offer.kind] : 'gear';
  return {
    id: GEAR_STEP_ID,
    title: `A New ${kind[0]!.toUpperCase()}${kind.slice(1)}`,
    subtitle: offer ? `${offer.name}, or ${current?.name ?? 'what they have'}?` : undefined,
    choice: true,
    fixed: true,
    options: [
      {
        id: 'keep',
        label: `Keep ${current?.name ?? 'Theirs'}`,
        description: current ? `${describeGear(current, char)}. ${offer?.name ?? 'The new one'} is left behind.` : 'Leave it.',
        baseWeight: better ? 1 : 99,
        rarity: current?.rarity ?? 'common',
        nextStepId: null,
        color: '#5f6a7a',
        icon: offer?.kind === 'armor' ? 'Shield' : 'Sword',
      },
      {
        id: 'take',
        label: `Take ${offer?.name ?? 'It'}`,
        description: offer ? `${describeGear(offer, char)}. ${current?.name ?? 'The old one'} is left behind.` : 'Take it.',
        baseWeight: better ? 99 : 1,
        rarity: offer?.rarity ?? 'common',
        nextStepId: null,
        color: '#c9a24c',
        icon: offer?.kind === 'armor' ? 'ShieldCheck' : 'Swords',
      },
    ],
  };
}
