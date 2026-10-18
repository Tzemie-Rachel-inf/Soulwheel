/**
 * What is at stake for a hero, on screen: their meters as slim vertical bars, the unfinished
 * business they carry, the places on the world's map, the place this adventure explores, and,
 * when they become something new, what changed. All of it is read from config.
 */
import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { metersOf, openPlaces } from '../engine/adventure';
import type { Character, Expedition, GameConfig, World } from '../engine/types';
import { currentHp, hpFraction, maxHp, WOUNDS_METER } from '../engine/hp';
import { getOptionIcon } from './icons';

/**
 * Meters as slim bars that fill from the bottom. A bar only shows once there is something in it
 * (meters that rise on their own, like Hunger, always show). One step from full, it glows.
 */
export function MeterBars({ config, character, className = '', hideHealth = false }: { config: GameConfig; character: Character; className?: string; hideHealth?: boolean }) {
  const reduceMotion = useReducedMotion() ?? false;
  // Health always shows (it is the Wounds meter read the other way round, engine/hp.ts), unless a HealthGauge shows it.
  const shown = metersOf(config, character).filter(({ meter, value }) => (meter.id === WOUNDS_METER ? !hideHealth : value > 0 || meter.perAdventure));
  if (shown.length === 0) return null;
  return (
    <ul className={`flex items-end gap-2.5 ${className}`} aria-label="Meters">
      {shown.map(({ meter, value: stored }) => {
        const Icon = getOptionIcon(meter.icon);
        const health = meter.id === WOUNDS_METER;
        const fraction = hpFraction(character);
        const value = health ? fraction * meter.max : stored;
        const close = health ? fraction <= 1 / 3 : value >= meter.max - 1;
        const color = health ? (fraction > 0.6 ? '#7fd0a6' : fraction > 1 / 3 ? '#e0b04a' : meter.color) : meter.color;
        const label = health ? `${meter.label}: ${currentHp(character)} of ${maxHp(character)}. ${meter.description}` : `${meter.label}: ${value} of ${meter.max}. ${meter.description}`;
        return (
          <li key={meter.id} className="flex flex-col items-center gap-1" title={label}>
            <Icon aria-hidden="true" size={12} style={{ color: meter.color }} />
            <span
              role="img"
              aria-label={label}
              className="relative flex h-16 w-2.5 items-end overflow-hidden rounded-full border border-lead bg-cp-stats-track"
              style={close ? { boxShadow: `0 0 10px ${color}` } : undefined}
            >
              <motion.span
                className="block w-full rounded-full"
                style={{ background: color }}
                initial={false}
                animate={{ height: `${(value / meter.max) * 100}%`, opacity: close && !reduceMotion ? [1, 0.55, 1] : 1 }}
                transition={{ height: { duration: 0.7, ease: 'easeOut' }, opacity: close && !reduceMotion ? { duration: 1.6, repeat: Infinity } : { duration: 0 } }}
              />
            </span>
            <span className="text-[0.65rem] font-semibold tracking-wider tabular-nums" style={{ color: close ? color : undefined }}>
              {health ? currentHp(character) : meter.short}
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

/** Health's colour: green while hale, amber when hurt, red when a third or less is left. */
export function healthColor(fraction: number): string {
  return fraction > 0.6 ? 'linear-gradient(180deg, #9be3b9, #3f8a5a)' : fraction > 1 / 3 ? 'linear-gradient(180deg, #ffd98a, #c98a2a)' : 'linear-gradient(180deg, #ff8a6a, #a3282e)';
}

/** The gilt studs at a frame's corners, as on every panel and portrait in the hall. */
function Studs() {
  return (
    <>
      {(['-left-1 -top-1', '-right-1 -top-1', '-bottom-1 -left-1', '-bottom-1 -right-1'] as const).map((pos) => (
        <span key={pos} aria-hidden="true" className={`absolute size-2 rotate-45 border border-gilt-bright bg-gilt-deep ${pos}`} />
      ))}
    </>
  );
}

/**
 * Health, as a gilt life plaque: a heart crest, a thick segmented bar in the plaque's frame, and
 * the number in the hall's display face. When health moves (a blow, a night's rest, the little
 * that comes back with every roll), the change rises off the number. The bar drains with a pale
 * ghost behind it; at a third or less, the heart beats and the plaque glows ember.
 *
 * `sm` drops the plaque and the crest (for the hero card); `unframed` keeps the crest at full size
 * but drops the plaque, for a board that is already framed.
 */
export function HealthGauge({ character, size = 'md', className = '', fraction: given, unframed = false }: { character: Character; size?: 'sm' | 'md'; className?: string; fraction?: number; unframed?: boolean }) {
  const reduce = useReducedMotion() ?? false;
  // A battle keeps its own count until it is over: `fraction` shows that instead of the stored health.
  const max = maxHp(character);
  const fraction = given === undefined ? hpFraction(character) : Math.min(1, Math.max(0, given));
  const hp = given === undefined ? currentHp(character) : Math.round(max * fraction);
  const low = fraction <= 1 / 3;
  const pct = `${Math.round(fraction * 1000) / 10}%`;
  const md = size === 'md';

  // What just changed, to rise off the number (state adjusted during render, not in an effect).
  const [seen, setSeen] = useState(hp);
  const [change, setChange] = useState<{ delta: number; key: number } | null>(null);
  if (seen !== hp) {
    setChange({ delta: hp - seen, key: (change?.key ?? 0) + 1 });
    setSeen(hp);
  }

  const bar = (
    <div className={`relative min-w-0 flex-1 overflow-hidden border-2 bg-[#120b09] ${md ? 'h-6 border-gilt-deep sm:h-7' : 'h-3.5 border-gilt-deep'}`}>
      <motion.span className="absolute inset-y-0 left-0 block bg-[#f7e0b0]" initial={false} animate={{ width: pct }} transition={reduce ? { duration: 0 } : { duration: 0.9, delay: 0.45, ease: 'easeIn' }} />
      <motion.span
        className="absolute inset-y-0 left-0 block"
        style={{ background: healthColor(fraction) }}
        initial={false}
        animate={{ width: pct, opacity: low && !reduce ? [1, 0.7, 1] : 1 }}
        transition={{ width: { duration: reduce ? 0 : 0.35 }, opacity: low && !reduce ? { duration: 0.8, repeat: Infinity } : { duration: 0 } }}
      />
      {/* A lit edge along the top, as on enamel, and the segments */}
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1/3 bg-[linear-gradient(180deg,rgba(255,248,230,0.28),rgba(255,248,230,0))]" />
      <span aria-hidden="true" className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(0,0,0,0) 0 calc(10% - 2px), rgba(0,0,0,0.5) calc(10% - 2px) 10%)' }} />
    </div>
  );

  const figure = (
    <span className="relative shrink-0 leading-none">
      <span className={`font-display tabular-nums ${md ? 'text-2xl sm:text-3xl' : 'text-lg'} ${low ? 'text-ember' : 'text-candle'}`}>{hp}</span>
      <span className={`tabular-nums text-ash ${md ? 'text-sm' : 'text-xs'}`}> / {max}</span>
      <AnimatePresence>
        {change && change.delta !== 0 && (
          <motion.span
            key={change.key}
            aria-hidden="true"
            className={`font-display pointer-events-none absolute -top-1 left-0 tabular-nums ${md ? 'text-lg' : 'text-sm'}`}
            style={{ color: change.delta > 0 ? '#7fd0a6' : '#ff8a6a', textShadow: '0 2px 0 #000, 0 0 10px rgba(0,0,0,0.8)' }}
            initial={{ opacity: 0, y: 0 }}
            animate={reduce ? { opacity: [0, 1, 1, 0] } : { opacity: [0, 1, 1, 0], y: [0, -14, -20, -26] }}
            transition={{ duration: 1.6, times: [0, 0.15, 0.7, 1], ease: [0.16, 1, 0.3, 1] }}
          >
            {change.delta > 0 ? `+${change.delta}` : `−${-change.delta}`}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );

  const heart = (
    <motion.span
      aria-hidden="true"
      className="grid shrink-0 place-items-center"
      animate={low && !reduce ? { scale: [1, 1.22, 1] } : { scale: 1 }}
      transition={low && !reduce ? { duration: 0.9, repeat: Infinity } : { duration: 0 }}
    >
      <Heart size={md ? 22 : 16} fill={low ? '#e0634a' : '#c0392b'} stroke="#f4dc9a" strokeWidth={1.5} />
    </motion.span>
  );

  const meter = { role: 'meter', 'aria-label': 'Health', 'aria-valuemin': 0, 'aria-valuemax': max, 'aria-valuenow': hp, 'aria-valuetext': `${hp} of ${max}` } as const;

  if (!md) {
    return (
      <div className={`flex items-center gap-2 ${className}`} {...meter}>
        {heart}
        {bar}
        {figure}
      </div>
    );
  }
  return (
    <div
      className={`relative flex items-center gap-3 ${unframed ? '' : 'border-2 border-gilt'} ${unframed ? 'py-1' : 'bg-[#120b09]/85 py-2 pl-2 pr-3 sm:pr-4'} sm:gap-4 ${className}`}
      style={unframed ? undefined : { boxShadow: `inset 0 0 0 2px #120b09, inset 0 0 0 3px var(--color-gilt-deep), 0 6px 18px ${low ? 'rgba(224,99,74,0.45)' : 'rgba(0,0,0,0.5)'}` }}
      {...meter}
    >
      {!unframed && <Studs />}
      {/* The crest: the heart in its own gilt frame, ringed in the colour of their health */}
      <span
        className="grid size-9 shrink-0 place-items-center border-2 border-gilt bg-[radial-gradient(circle_at_50%_35%,#3a2a1c,#120b09_70%)] sm:size-10"
        style={{ boxShadow: `inset 0 0 0 2px #120b09, inset 0 0 0 3px ${fraction > 0.6 ? '#3f8a5a' : fraction > 1 / 3 ? '#c98a2a' : '#a3282e'}` }}
      >
        {heart}
      </span>
      {bar}
      {figure}
    </div>
  );
}
