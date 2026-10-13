/** A character's renown: their tier, their fame, and how far it is to the next tier (from config). */
import { fameStanding } from '../engine/fame';
import type { GameConfig } from '../engine/types';

export function FameMeter({ config, fame }: { config: GameConfig; fame: number }) {
  const { tier, next } = fameStanding(config.fame.tiers, fame);
  const progress = next ? Math.min(1, (fame - tier.min) / (next.min - tier.min)) : 1;
  return (
    <div className="mt-2">
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span>
          <span className="font-semibold text-gilt-bright">{tier.name}</span>{' '}
          <span className="tabular-nums text-vellum">{fame} fame</span>
        </span>
        <span className="text-ash">{next ? `${next.min - fame} to ${next.name}` : 'As famous as anyone gets'}</span>
      </p>
      <span
        className="mt-1 block h-1.5 overflow-hidden rounded-r-[3px] bg-cp-stats-track"
        role="img"
        aria-label={next ? `${fame} of ${next.min} fame toward ${next.name}` : `${fame} fame, the highest tier`}
      >
        <span className="block h-full bg-gilt transition-[width] duration-700 ease-out" style={{ width: `${progress * 100}%` }} />
      </span>
    </div>
  );
}
