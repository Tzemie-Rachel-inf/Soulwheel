/**
 * Stakes: meters that fill and fire, places that stay on the map, hooks that come back, identities
 * with rules of their own, and encounters spun the way the hero would meet them.
 */
import { describe, expect, it } from 'vitest';
import { GAME_CONFIG as SAMPLE_CONFIG } from '../config/gameConfig';
import type { GameConfig } from './types';
import { PLACE_KINDS } from '../config/stakes';
import { completeAdventure, getAdventureStep, metersOf, openPlaces, spinAdventure, startAdventure, type AdventureState } from './adventure';
import { applyEffects, createCharacter } from './character';
import { getStep } from './generation';
import { dealOptions } from './odds';
import { loadWorld, saveWorld, type StorageLike } from './persistence';
import { createSeededRng } from './rng';
import { resolveSlices } from './roll';
import type { Character, Place, World } from './types';
import { wheelsWithoutHype } from './validate';
import { createWorld, findCharacter, placeCharacter } from './world';

/** These tests walk single wheels, so a short adventure must end where its wheel says: no road home. */
const GAME_CONFIG: GameConfig = { ...SAMPLE_CONFIG, adventure: { ...SAMPLE_CONFIG.adventure, roadHome: undefined } };

function soul(seed: number, patch: Partial<Character> = {}): Character {
  return { ...createCharacter(GAME_CONFIG, { name: `Soul ${seed}`, rng: createSeededRng(seed), now: 0 }), status: 'alive', ...patch };
}
function worldOf(...chars: Character[]): World {
  return chars.reduce((w, c) => placeCharacter(w, c), createWorld({ rng: createSeededRng(1), now: 0 }));
}
/** The hero arriving at a wheel. */
const at = (hero: Character, stepId: string): AdventureState => ({ ...startAdventure(GAME_CONFIG, hero), character: hero, currentStepId: stepId });
/** Land on one option, as if the wheel had picked it. */
function land(state: AdventureState, world: World, optionId: string): AdventureState {
  const step = getStep(GAME_CONFIG, state.currentStepId!);
  const rigged = { ...GAME_CONFIG, steps: { ...GAME_CONFIG.steps, [step.id]: { ...step, options: step.options.filter((o) => o.id === optionId) } } };
  return spinAdventure(state, rigged, world, createSeededRng(3)).state;
}
const dealt = (hero: Character, stepId: string) => dealOptions(getStep(GAME_CONFIG, stepId), hero, GAME_CONFIG).map((o) => o.id);
const weights = (hero: Character, world: World, stepId: string) =>
  Object.fromEntries(resolveSlices(dealOptions(getStep(GAME_CONFIG, stepId), hero, GAME_CONFIG), world, hero).map((s) => [s.option.id, s.effectiveWeight]));
const place = (patch: Partial<Place> = {}): Place => ({ id: 'plc_test', name: 'the Weeping Stair', kind: 'ruin', depth: 1, foundBy: 'Aldric', foundById: 'chr_aldric', foundSeason: 0, visits: 1, ...patch });

describe('meters', () => {
  it('moves a meter within 0 and its max', () => {
    const hero = soul(1);
    const option = { id: 'x', label: 'x', baseWeight: 1, nextStepId: null };
    expect(applyEffects(hero, { ...option, meters: { wounds: 9 } }, 'road', GAME_CONFIG).meters).toEqual({ wounds: 3 });
    expect(applyEffects({ ...hero, meters: { wounds: 1 } }, { ...option, meters: { wounds: -5 } }, 'road', GAME_CONFIG).meters).toEqual({ wounds: 0 });
  });

  it('raises a vampire’s hunger with every adventure, and nobody else’s', () => {
    expect(startAdventure(GAME_CONFIG, soul(2, { race: 'vampire' })).character.meters?.hunger).toBe(1);
    expect(startAdventure(GAME_CONFIG, soul(2, { race: 'human' })).character.meters?.hunger).toBeUndefined();
    expect(metersOf(GAME_CONFIG, soul(2, { race: 'human' })).map((m) => m.meter.id)).toEqual(['wounds', 'notoriety']);
  });

  it('sends the hero to the trigger wheel as the road would end, and empties the meter', () => {
    const hurt = soul(3, { meters: { wounds: 3 } });
    const world = worldOf(hurt);
    const state = land(at(hurt, 'road'), world, 'drowned_library');
    expect(state.currentStepId).toBe('festering');
    expect(state.character.meters?.wounds).toBe(0);
    const after = land(state, world, 'scars_that_teach');
    expect(after.rolls.at(-1)).toMatchObject({ stepId: 'festering', event: 'Their wounds festered' });
    expect(after.currentStepId).toBeNull();
  });

  it('waits for the road to end, and never fires on a hero whose story is over', () => {
    const hurt = soul(4, { meters: { wounds: 3 } });
    const world = worldOf(hurt);
    expect(land(at(hurt, 'crossroads'), world, 'go_adventure').currentStepId).toBe('road');
    const fallen = land(at(hurt, 'disaster_outcome'), world, 'perished');
    expect(fallen.character.status).toBe('fallen');
    expect(fallen.currentStepId).toBeNull();
  });
});

describe('places', () => {
  it('puts what an explorer finds on the world’s map, with who found it', () => {
    const hero = soul(5);
    const world = worldOf(hero);
    const state = land(at(hero, 'explore'), world, 'uncharted_wilds');
    expect(state.character.expedition).toMatchObject({ kind: 'wild', depth: 1, isNew: true });
    expect(PLACE_KINDS.wild!.names).toContain(state.character.expedition!.name);

    const after = completeAdventure(world, state, 0);
    expect(after.places).toEqual([expect.objectContaining({ kind: 'wild', depth: 1, foundBy: 'Soul 5', foundById: hero.id, visits: 1 })]);
    const back = findCharacter(after, hero.id)!;
    expect(back.expedition).toBeUndefined();
    expect(back.adventures.at(-1)?.place).toMatchObject({ discovered: true, depth: 1 });
  });

  it('takes a hero back to a place someone found, deeper each time, and remembers it', () => {
    const hero = soul(6);
    const world = { ...worldOf(hero), places: [place()] };
    const arrived = land(at(hero, 'crossroads'), world, 'return_to_a_place');
    expect(arrived.currentStepId).toBe('place_return');
    expect(arrived.character.expedition).toMatchObject({ placeId: 'plc_test', isNew: false, depth: 1, foundBy: 'Aldric' });
    expect(getAdventureStep(GAME_CONFIG, 'place_return', arrived).title).toBe('Return to the Weeping Stair');

    const deeper = land(arrived, world, 'deeper');
    expect(deeper.rolls.at(-1)).toMatchObject({ place: 'the Weeping Stair', callback: 'Went back to the Weeping Stair, found by Aldric' });
    const after = completeAdventure(world, deeper, 0);
    expect(after.places?.[0]).toMatchObject({ depth: 2, visits: 2 });
  });

  it('closes a place for good when it comes down, and nobody returns to a closed place', () => {
    const hero = soul(7);
    const world = { ...worldOf(hero), places: [place()] };
    const collapsed = land(land(at(hero, 'crossroads'), world, 'return_to_a_place'), world, 'cave_in');
    const after = completeAdventure(world, collapsed, 0);
    expect(after.places?.[0]?.closed).toBe('Collapsed on Soul 7');
    expect(openPlaces(after)).toEqual([]);
    const crossroads = resolveSlices(getStep(GAME_CONFIG, 'crossroads').options, after, hero);
    expect(crossroads.find((s) => s.option.id === 'return_to_a_place')?.locked).toBe(true);
  });

  it('keeps the map in a save, and never an expedition', () => {
    const data = new Map<string, string>();
    const storage: StorageLike = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
    const hero = soul(8, { meters: { wounds: 2 }, expedition: { placeId: 'p', name: 'x', kind: 'ruin', depth: 1, isNew: true, foundBy: 'x' } });
    saveWorld({ ...worldOf(hero), places: [place()] }, storage);
    const loaded = loadWorld(storage)!;
    expect(loaded.places).toEqual([place()]);
    expect(loaded.roster[0]?.expedition).toBeUndefined();
    expect(loaded.roster[0]?.meters).toEqual({ wounds: 2 });
  });
});

describe('unfinished business', () => {
  it('deals a payoff only to those who carry the hook, and settles it', () => {
    expect(dealt(soul(9), 'road')).not.toContain('it_found_them');
    expect(dealt(soul(9, { tags: ['hook:followed'] }), 'road')).toContain('it_found_them');

    const mapped = soul(10, { tags: ['hook:map'] });
    const state = land(at(mapped, 'find_weapon'), worldOf(mapped), 'follow_the_map');
    expect(state.character.tags).not.toContain('hook:map');
    expect(state.rolls.at(-1)?.callback).toBe('They followed the old map');
    expect(state.currentStepId).toBe('map_cache');
  });

  it('brings any hook due at the crossroads, on the wheel that pays it off', () => {
    expect(dealt(soul(17), 'crossroads')).not.toContain('unfinished_business');
    const haunted = soul(17, { tags: ['hook:followed'] });
    expect(dealt(haunted, 'crossroads')).toContain('unfinished_business');
    const due = land(at(haunted, 'crossroads'), worldOf(haunted), 'unfinished_business');
    expect(due.currentStepId).toBe('battle:fight_follower');
    expect(due.rolls.at(-1)?.callback).toBe('Their unfinished business came due');
  });

  it('turns an empty result into one that comes back', () => {
    const lost = land(at(soul(11), 'explore'), worldOf(soul(11)), 'lost');
    expect(lost.character.tags).toContain('hook:followed');
    expect(lost.character.meters?.wounds).toBe(1);
  });
});

describe('identities', () => {
  it('gives each identity a pursuit of its own, dealt to no one else', () => {
    expect(dealt(soul(12, { race: 'vampire' }), 'crossroads')).toContain('the_hunt');
    expect(dealt(soul(12, { race: 'human' }), 'crossroads')).not.toContain('the_hunt');
    expect(dealt(soul(12, { race: 'werewolf' }), 'crossroads')).toContain('pack_run');
  });

  it('gives a vampire a way to win any fight', () => {
    const vampire = soul(13, { race: 'vampire', traits: [GAME_CONFIG.traits['vampiric']!] });
    expect(dealt(vampire, 'fight_bandits')).toContain('kit_drain');
    expect(dealt(soul(13), 'fight_bandits')).not.toContain('kit_drain');
  });

  it('makes becoming a vampire a decision, and accepting it a new life', () => {
    expect(getStep(GAME_CONFIG, 'transform').options.find((o) => o.id === 'vampire_turned')?.nextStepId).toBe('the_bite');
    expect(getStep(GAME_CONFIG, 'the_bite').choice).toBe(true);
    const hero = soul(14);
    const turned = land(at(hero, 'the_bite'), worldOf(hero), 'accept_the_gift');
    expect(turned.character.race).toBe('vampire');
    expect(metersOf(GAME_CONFIG, turned.character).map((m) => m.meter.id)).toContain('hunger');
    expect(GAME_CONFIG.identities?.['vampire']?.gains.length).toBeGreaterThan(0);
  });
});

describe('spun encounters', () => {
  it('leans the wheel toward how the hero would meet it', () => {
    const world = worldOf();
    const brave = weights(soul(15, { personality: 'brave' }), world, 'enc_champion');
    const cautious = weights(soul(15, { personality: 'cautious' }), world, 'enc_champion');
    expect(brave['duel_honourably']!).toBeGreaterThan(cautious['duel_honourably']!);
    const kind = weights(soul(16, { personality: 'kind' }), world, 'enc_refugees');
    const cruel = weights(soul(16, { personality: 'cruel' }), world, 'enc_refugees');
    expect(kind['escort']!).toBeGreaterThan(cruel['escort']! * 5);
    expect(getStep(GAME_CONFIG, 'enc_champion').choice).toBeUndefined();
  });

  it('keeps decisions for what is worth deciding', () => {
    for (const id of ['enc_relic', 'enc_witch', 'fin_duel', 'destiny', 'night_court', 'whispering_blade', 'abyss_offer']) {
      expect(getStep(GAME_CONFIG, id).choice).toBe(true);
    }
  });
});

describe('hype', () => {
  it('gives every wheel, creation and adventure, menus and decisions included, an epic-or-rarer slice', () => {
    expect(wheelsWithoutHype(GAME_CONFIG)).toEqual([]);
  });

  it('puts an epic-or-rarer slice on every fight', () => {
    const fights = Object.values(GAME_CONFIG.steps).filter((s) => s.foe || s.foeOf);
    const flat = fights.filter((s) => !s.options.some((o) => ['epic', 'legendary', 'mythical'].includes(o.rarity ?? 'common')));
    expect(flat.map((s) => s.id)).toEqual([]);
  });
});
