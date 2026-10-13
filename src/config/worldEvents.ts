/**
 * What the world does on its own, between seasons. After each of the player's adventures the
 * world may roll one of these (state/worldTurn.ts): most seasons pass quietly, some bring a
 * plague, a comet, a festival, or word of the Demon Lord's march.
 *
 * An event can move threat, leave an omen for a few seasons, or bring a new hero of the
 * world's own into it. Omens bend the wheels through `omenScaling` on the options they touch:
 *
 *   plague     disasters ×2, quiet roads ×0.5               festival   tournaments ×3, contests ×2
 *   comet      powers ×2.5, mastery ×2                       war        war ×3, dark champions ×2
 *   restless   graves ×2, the undead ×2                      bandits    ambushes ×2.5
 *   dragon     lairs ×1.5, wyverns ×2                        eclipse    the Abyss ×2, temptations ×2
 *   peace      quiet roads ×1.5, disasters ×0.5
 */
import type { WorldEventDef } from '../engine/types';
import { isSingletonClaimed } from '../engine/world';
import { SINGLETON } from './common';

/** The chance, each season, that the world does something on its own. */
export const WORLD_EVENT_CHANCE = 0.4;

export const OMENS = {
  plague: 'plague',
  comet: 'comet',
  festival: 'festival',
  war: 'war',
  restless: 'restless_dead',
  bandits: 'bandits',
  dragon: 'dragon',
  eclipse: 'eclipse',
  peace: 'peace',
} as const;

const demonLordReigns = (world: Parameters<NonNullable<WorldEventDef['condition']>>[0]) => isSingletonClaimed(world, SINGLETON.demonLord);

export const WORLD_EVENTS: WorldEventDef[] = [
  {
    id: 'plague',
    text: 'A plague crept from village to village. The roads emptied, and the wells were watched.',
    baseWeight: 10,
    threatScaling: 0.1,
    threat: 0.5,
    omen: { id: OMENS.plague, label: 'Plague', description: 'Disasters twice as likely, quiet roads half as.', seasons: 3 },
    tone: 'ember',
  },
  {
    id: 'comet',
    text: 'A comet hung in the sky for a season. Magic ran wild, and every hedge-wizard swore it spoke to them.',
    baseWeight: 7,
    omen: { id: OMENS.comet, label: 'Comet', description: 'New powers and mastery come far more easily.', seasons: 4 },
    tone: 'gold',
  },
  {
    id: 'festival',
    text: 'The harvest came in heavy, and every town held a festival: banners, ale, and a tournament in every square.',
    baseWeight: 10,
    threatScaling: -0.08,
    threat: -0.5,
    omen: { id: OMENS.festival, label: 'Festival season', description: 'Tournaments and contests everywhere.', seasons: 2 },
    tone: 'moss',
  },
  {
    id: 'demon_march',
    text: 'The Demon Lord’s banners crossed the border. Villages burned, and the kingdoms called their armies.',
    baseWeight: 12,
    threatScaling: 0.1,
    condition: demonLordReigns,
    threat: 1.5,
    omen: { id: OMENS.war, label: 'War with the Abyss', description: 'War, envoys and dark champions far likelier.', seasons: 3 },
    tone: 'ember',
  },
  {
    id: 'restless_dead',
    text: 'The dead would not stay down. Graves stood open in the morning, and something walked the barrows.',
    baseWeight: 6,
    threatScaling: 0.15,
    threat: 1,
    omen: { id: OMENS.restless, label: 'The restless dead', description: 'Graves and the undead come calling twice as often.', seasons: 3 },
    tone: 'ember',
  },
  {
    id: 'bandit_winter',
    text: 'A hard winter drove hungry men to the roads with knives.',
    baseWeight: 9,
    threat: 0.5,
    omen: { id: OMENS.bandits, label: 'Bandit winter', description: 'Ambushes and outlaws on every road.', seasons: 3 },
    tone: 'ember',
  },
  {
    id: 'dragon_sighted',
    text: 'A dragon was seen over the mountains. Herds went missing, and the bounty boards filled.',
    baseWeight: 5,
    threat: 0.5,
    omen: { id: OMENS.dragon, label: 'A dragon abroad', description: 'Lairs and winged beasts on every hunt.', seasons: 3 },
    tone: 'ember',
  },
  {
    id: 'eclipse',
    text: 'The sun went black at noon. Things in the dark took it as an invitation.',
    baseWeight: 4,
    threatScaling: 0.1,
    threat: 0.5,
    omen: { id: OMENS.eclipse, label: 'Eclipse', description: 'The Abyss answers more readily, and temptations multiply.', seasons: 2 },
    tone: 'ember',
  },
  {
    id: 'golden_age',
    text: 'Peace took hold. Fields were sown, roads were mended, and children grew up never having seen a war.',
    baseWeight: 8,
    threatScaling: 0.12, // the darker it has been, the more it is welcomed
    condition: (world) => world.threatLevel >= 1.5 && !demonLordReigns(world),
    threat: -1.5,
    omen: { id: OMENS.peace, label: 'Peace', description: 'Quiet roads, and fewer disasters.', seasons: 4 },
    tone: 'moss',
  },
  {
    id: 'new_hero',
    text: 'Word came of a new hero setting out.',
    baseWeight: 12,
    newHero: true,
  },
];
