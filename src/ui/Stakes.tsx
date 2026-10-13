/**
 * What is at stake for a hero, on screen: their meters as slim vertical bars, the unfinished
 * business they carry, the places on the world's map, the place this adventure explores, and,
 * when they become something new, what changed. All of it is read from config.
 */
import { motion, useReducedMotion } from 'framer-motion';
import { metersOf, openPlaces } from '../engine/adventure';
import type { Character, Expedition, GameConfig, World } from '../engine/types';
import { getOptionIcon } from './icons';

/**
 * Meters as slim bars that fill from the bottom. A bar only shows once there is something in it
 * (meters that rise on their own, like Hunger, always show). One step from full, it glows.
 */
export function MeterBars({ config, character, className = '' }: { config: GameConfig; character: Character; className?: string }) {
  const reduceMotion = useReducedMotion() ?? false;
  const shown = metersOf(config, character).filter(({ meter, value }) => value > 0 || meter.perAdventure);
  if (shown.length === 0) return null;
  return (
    <ul className={`flex items-end gap-2.5 ${className}`} aria-label="Meters">
      {shown.map(({ meter, value }) => {
        const Icon = getOptionIcon(meter.icon);
        const close = value >= meter.max - 1;
        const label = `${meter.label}: ${value} of ${meter.max}. ${meter.description}`;
        return (
          <li key={meter.id} className="flex flex-col items-center gap-1" title={label}>
            <Icon aria-hidden="true" size={12} style={{ color: meter.color }} />
            <span
              role="img"
              aria-label={label}
              className="relative flex h-16 w-2.5 items-end overflow-hidden rounded-full border border-lead bg-cp-stats-track"
              style={close ? { boxShadow: `0 0 10px ${meter.color}` } : undefined}
            >
              <motion.span
                className="block w-full rounded-full"
                style={{ background: meter.color }}
                initial={false}
                animate={{ height: `${(value / meter.max) * 100}%`, opacity: close && !reduceMotion ? [1, 0.55, 1] : 1 }}
                transition={{ height: { duration: 0.7, ease: 'easeOut' }, opacity: close && !reduceMotion ? { duration: 1.6, repeat: Infinity } : { duration: 0 } }}
              />
            </span>
            <span className="text-[0.65rem] font-semibold tracking-wider tabular-nums" style={{ color: close ? meter.color : undefined }}>
              {meter.short}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The hooks a hero carries: things that will come back for them. */
export function UnfinishedBusiness({ config, character }: { config: GameConfig; character: Character }) {
  const hooks = character.tags.flatMap((tag) => (config.hooks?.[tag] ? [{ tag, ...config.hooks[tag]! }] : []));
  if (hooks.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-ash">Unfinished business</p>
      <ul className="mt-1 flex flex-wrap gap-2">
        {hooks.map((hook) => (
          <li key={hook.tag} className="rounded-sm border border-gilt/50 bg-slab-raised px-2 py-0.5 text-sm text-vellum" title={hook.description}>
            {hook.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The world's map: places a hero (this one, or one before) found, and how deep anyone went. */
export function KnownPlaces({ config, world, hero }: { config: GameConfig; world: World; hero: Character | null }) {
  const open = openPlaces(world);
  if (open.length === 0) return null;
  const mine = (id: string) => hero !== null && id === hero.id;
  const places = [...open].sort((a, b) => Number(mine(b.foundById)) - Number(mine(a.foundById)) || b.depth - a.depth).slice(0, 8);
  return (
    <div className="mt-8">
      <h2 className="text-sm text-ash">On the map</h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {places.map((place) => {
          const kind = config.placeKinds?.[place.kind];
          const Icon = getOptionIcon(kind?.icon);
          return (
            <li key={place.id} className="flex items-start gap-3 rounded-md border-2 border-lead bg-slab px-3 py-2 text-sm">
              <Icon aria-hidden="true" size={18} className="mt-0.5 shrink-0" style={{ color: kind?.color }} />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-candle">{capitalize(place.name)}</span>
                <span className="block text-ash">
                  {kind?.label ?? place.kind}, depth {place.depth} · found by {mine(place.foundById) ? 'them' : place.foundBy}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-sm text-ash">
        Return to a Place You Know can come up at the crossroads. Every return can go deeper: richer, deadlier, and closer to its heart.
      </p>
    </div>
  );
}

/** The place this adventure is exploring. */
export function ExpeditionBanner({ config, expedition }: { config: GameConfig; expedition: Expedition }) {
  const kind = config.placeKinds?.[expedition.kind];
  const Icon = getOptionIcon(kind?.icon);
  return (
    <div className="mt-5 flex items-center gap-3 rounded-md border-2 border-moss/50 bg-slab px-4 py-2">
      <Icon aria-hidden="true" size={20} style={{ color: kind?.color }} />
      <p className="min-w-0 text-sm text-vellum">
        <span className="font-display text-xl text-candle">{capitalize(expedition.name)}</span>{' '}
        <span className="text-ash">
          {expedition.isNew ? `A new ${(kind?.label ?? 'place').toLowerCase()} on the map` : `${kind?.label ?? 'A place'} found by ${expedition.foundBy}`}, depth {expedition.depth}
          {expedition.closed && `. ${expedition.closed}`}
        </span>
      </p>
    </div>
  );
}

/** "Your life has changed": what a new identity can now do, and what it can't. */
export function LifeChanged({ config, race }: { config: GameConfig; race: string }) {
  const kit = config.identities?.[race];
  if (!kit) return null;
  return (
    <div className="mt-4 rounded-md border-2 border-gilt/60 bg-slab-raised px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gilt-bright">Their life has changed</p>
      <p className="mt-0.5 font-display text-xl text-candle">{kit.headline}</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-moss">New</p>
          <ul className="mt-1 grid gap-1 text-sm text-vellum">
            {kit.gains.map((line) => (
              <li key={line}>+ {line}</li>
            ))}
          </ul>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ember">Closed, or coming for them</p>
          <ul className="mt-1 grid gap-1 text-sm text-vellum">
            {kit.loses.map((line) => (
              <li key={line}>− {line}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
