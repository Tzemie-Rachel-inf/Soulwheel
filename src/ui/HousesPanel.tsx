/**
 * The houses of the world: every dynasty, founder first, a generation per row. The last of a
 * line can be given an heir here too, once no hero is on the road, so an old house can be
 * taken up again long after its last story ended.
 */
import { Crown, Footprints, Gem, Skull, Sprout, Store, Trophy, type LucideIcon } from 'lucide-react';
import { fameStanding } from '../engine/fame';
import { canNameHeir, housesOf } from '../engine/lineage';
import type { Character, GameConfig, World } from '../engine/types';
import { primaryButton } from './RollReveal';
import { howItEnded, whoTheyWere } from './legend';

function markOf(c: Character): { Icon: LucideIcon; tone: string } {
  if (c.status === 'fallen') return { Icon: Skull, tone: c.tags.includes('martyr') ? 'text-gilt-bright' : 'text-ash' };
  if (c.status === 'sealed') return { Icon: Gem, tone: 'text-cp-traits' };
  if (c.status !== 'alive') return { Icon: Trophy, tone: 'text-gilt-bright' };
  if (c.role === 'npc') return c.tags.includes('ruler') ? { Icon: Crown, tone: 'text-gilt-bright' } : { Icon: Store, tone: 'text-moss' };
  return { Icon: Footprints, tone: 'text-candle' };
}

interface HousesPanelProps {
  world: World;
  config: GameConfig;
  inspectedId: string | null;
  onInspect: (id: string) => void;
  /** No hero is on the road, so a new soul may be born. */
  canRaiseHeir: boolean;
  onRaiseHeir: (parent: Character) => void;
}

export function HousesPanel({ world, config, inspectedId, onInspect, canRaiseHeir, onRaiseHeir }: HousesPanelProps) {
  const houses = housesOf(world);
  return (
    <div className="mt-6">
      <p className="text-vellum">
        When a hero with a name worth inheriting ends their story, their heir can take it up: born into their house, likely
        their ancestry, with a little of their strength and fame.
      </p>
      {houses.length === 0 ? (
        <p className="court-panel mt-6 p-5 text-vellum">
          No house has an heir yet. At the end of a Known (or better) hero’s story, choose “Raise their heir”.
        </p>
      ) : (
        <div className="mt-6 grid gap-6">
          {houses.map((house) => {
            const last = house.members.at(-1)!;
            return (
              <section key={house.members[0]!.id} aria-label={`House ${house.name}`} className="court-panel">
                <h2 className="border-b-2 border-lead px-5 py-3 font-display text-2xl text-gilt-bright">
                  House {house.name}
                  <span className="ml-3 font-sans text-sm text-ash">
                    {house.members.length} generation{house.members.length === 1 ? '' : 's'}
                  </span>
                </h2>
                <ol className="px-3 py-2">
                  {house.members.map((c, i) => {
                    const { Icon, tone } = markOf(c);
                    const end = howItEnded(c, config);
                    return (
                      <li key={c.id} className="relative" style={{ paddingLeft: `${Math.min(i, 6) * 0.9}rem` }}>
                        <button
                          type="button"
                          onClick={() => onInspect(c.id)}
                          aria-pressed={inspectedId === c.id}
                          className={`flex w-full gap-3 rounded-md px-2 py-1.5 text-left hover:bg-slab-raised ${inspectedId === c.id ? 'bg-slab-raised' : ''}`}
                        >
                          <Icon aria-hidden="true" size={16} className={`mt-1 shrink-0 ${tone}`} />
                          <span className="min-w-0">
                            <span className="block text-vellum">
                              <span className="font-semibold text-candle">{c.name}</span>
                              <span className="text-sm text-ash">
                                {' '}
                                · {i === 0 ? 'founder' : `generation ${i + 1}`} · {whoTheyWere(c, config)} ·{' '}
                                {fameStanding(config.fame.tiers, c.fame).tier.name}
                              </span>
                            </span>
                            <span className="block text-sm text-ash">{end ? `${end}.` : c.status === 'alive' && c.role === 'hero' ? 'On the road now.' : ''}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
                {canRaiseHeir && canNameHeir(world, last) && (
                  <div className="border-t-2 border-lead px-5 py-3">
                    <button type="button" onClick={() => onRaiseHeir(last)} className={`${primaryButton} flex items-center gap-2`}>
                      <Sprout aria-hidden="true" size={16} />
                      Raise {last.name}’s heir
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
