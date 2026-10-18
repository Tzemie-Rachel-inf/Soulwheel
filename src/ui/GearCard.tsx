/**
 * A weapon or a suit of armour as the Character Card and the Keep / Take choice show it: its
 * name in its rarity, its power out of 10, the stat it is used with, what it deals (or turns),
 * and every ability it gives, with what it is worth to this hero.
 */
import { abilityTraits, gearStat, GEAR_KIND_LABEL, itemCP, MAX_GEAR_POWER } from '../engine/gear';
import { statScale, traitPower } from '../engine/power';
import { weaponDamage } from '../engine/battle';
import { GameIcon, gearIcon } from './GameIcon';
import type { Character, GameConfig, GearItem, GearKind } from '../engine/types';
import { STAT_LABELS, signed } from './format';
import { RARITY_STYLES } from './rarity';

const KIND_TITLE: Record<GearKind, string> = { weapon: 'Weapon', armor: 'Armour' };
const EMPTY: Record<GearKind, string> = { weapon: 'Bare hands. The road has weapons, for those who survive it.', armor: 'Travelling clothes. Nothing between them and the next blade.' };

const cap = (text: string) => text[0]!.toUpperCase() + text.slice(1);

/** Power as a row of lozenges on a gilt rule: filled in the slot's colour, empty ones outlined. */
export function PowerPips({ filled, max = MAX_GEAR_POWER, kind }: { filled: number; max?: number; kind: GearKind }) {
  const on = kind === 'weapon' ? 'bg-cp-weapon' : 'bg-cp-armor';
  const off = kind === 'weapon' ? 'border-cp-weapon/45' : 'border-cp-armor/45';
  return (
    <div className="relative mt-2 flex justify-between px-1" aria-hidden="true">
      <span className="absolute inset-x-0 top-1/2 h-px bg-gilt-deep" />
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`relative size-2.5 rotate-45 border transition-colors duration-500 ${i < filled ? `${on} border-gilt-bright/70` : `bg-slab ${off}`}`} />
      ))}
    </div>
  );
}

interface GearCardProps {
  kind: GearKind;
  item: GearItem | null;
  character: Character;
  config: GameConfig;
  /** A heading over the card, e.g. 'Current' or 'New'. Default: the slot's name. */
  heading?: string;
}

export function GearCard({ kind, item, character, config, heading }: GearCardProps) {
  const title = heading ?? KIND_TITLE[kind];
  if (!item) {
    return (
      <div>
        <h3 className="font-caps text-base tracking-wide text-ash">{title}</h3>
        <div className="mt-1 flex items-center gap-3">
          <GearFrame kind={kind} item={null} color="#8a8070" />
          <p className="text-sm text-ash">
            {EMPTY[kind]}
            {kind === 'weapon' && <span className="block text-vellum">Fists: {weaponDamage({ ...character, weapon: null })} damage a blow.</span>}
          </p>
        </div>
      </div>
    );
  }
  const rarity = RARITY_STYLES[item.rarity];
  const stat = gearStat(item, character);
  const scale = statScale(character.stats[stat]);
  const element = kind === 'weapon' ? item.damage : item.resists;
  const base = config.gear?.bases[item.base];
  const worth = itemCP(item, character, config);
  const held = kind === 'weapon' && character.rules?.noWeapon;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="shrink-0 whitespace-nowrap font-caps text-base tracking-wide text-ash">{title}</h3>
        <p className="text-right text-sm text-ash">
          power <span className="tabular-nums text-vellum">{item.power}</span> of {MAX_GEAR_POWER}, worth{' '}
          <span className="tabular-nums text-vellum">{worth}</span> CP
        </p>
      </div>
      <div className="mt-1 flex items-center gap-3">
        <GearFrame kind={kind} item={item} color={rarity.color} />
        <div className="min-w-0">
          <p className="font-display text-lg leading-snug" style={{ color: rarity.color }}>
            {item.name}
          </p>
          <p className="text-xs font-semibold uppercase tracking-wider text-ash">
            <span style={{ color: rarity.color }}>{rarity.label}</span>
            {base && !item.name.includes(base.name) && <span> · {base.name}</span>}
            {item.tempered ? <span className="text-gilt-bright"> · tempered {signed(item.tempered)}</span> : null}
          </p>
        </div>
      </div>
      <PowerPips filled={item.power} kind={kind} />
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {kind === 'weapon' && !held && (
          <span className="rounded-sm border border-cp-weapon/70 px-2 py-0.5 font-semibold text-candle" title={`What a clean blow takes off a foe, with their ${STAT_LABELS[stat]} (×${Math.round(scale * 100) / 100}). Crits multiply it; a weakness adds 30%.`}>
            {weaponDamage({ ...character, weapon: item })} damage
          </span>
        )}
        {kind === 'armor' && (
          <span className="rounded-sm border border-cp-armor/70 px-2 py-0.5 font-semibold text-candle" title="Armour adds to their health.">
            +{6 * item.power} max health
          </span>
        )}
        <span className="rounded-sm border border-lead px-2 py-0.5 text-vellum">
          {kind === 'weapon' ? 'Wielded' : 'Worn'} with {STAT_LABELS[stat]}
          {scale !== 1 && <span className="text-ash"> ×{Math.round(scale * 100) / 100}</span>}
        </span>
        {element && (
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-lead px-2 py-0.5 text-vellum">
            <span aria-hidden="true" className="size-2 rounded-full" style={{ background: config.gear?.damageColors[element] ?? '#888' }} />
            {kind === 'weapon' ? `${cap(element)} damage` : `Turns ${element}`}
          </span>
        )}
      </div>
      {held && <p className="mt-2 text-sm text-ember">They hold no weapon: it is worth nothing to them.</p>}
      {item.abilities.length > 0 && (
        <ul className="mt-3 grid gap-2">
          {abilityTraits(item, config).map((trait) => (
            <li key={trait.id} className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-2 size-2 shrink-0 rotate-45 bg-gilt-bright" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-vellum">{trait.name}</p>
                <p className="text-sm text-ash">{trait.description}</p>
              </div>
              <span className="text-right text-sm tabular-nums text-vellum">{signed(traitPower(trait, character))}</span>
            </li>
          ))}
        </ul>
      )}
      {(item.lore || item.foundFrom) && (
        <p className="mt-2 text-sm italic text-ash">
          {item.lore}
          {item.lore && item.foundFrom ? ' ' : ''}
          {item.foundFrom && `${item.foundFrom}.`}
        </p>
      )}
    </div>
  );
}

/** The Keep / Take choice: what they carry beside what they found, and what the swap is worth. */
export function GearCompare({ offer, character, config }: { offer: GearItem; character: Character; config: GameConfig }) {
  const kind = offer.kind;
  const current = kind === 'weapon' ? character.weapon : character.armor;
  const delta = itemCP(offer, character, config) - itemCP(current, character, config);
  const gained = offer.abilities.filter((id) => !current?.abilities.includes(id)).length;
  const lost = (current?.abilities ?? []).filter((id) => !offer.abilities.includes(id)).length;
  return (
    <section aria-label={`A new ${GEAR_KIND_LABEL[kind]}`} className="court-panel px-5 py-4">
      <p className="text-center text-sm text-ash">
        Taking it is worth{' '}
        <span className={`font-semibold tabular-nums ${delta > 0 ? 'text-moss' : delta < 0 ? 'text-ember' : 'text-vellum'}`}>{signed(delta)} CP</span>
        {gained > 0 && <span>, {gained} new {gained === 1 ? 'ability' : 'abilities'}</span>}
        {lost > 0 && <span>, {lost} lost</span>}.
      </p>
      <div className="mt-3 grid gap-5 sm:grid-cols-2">
        <GearCard kind={kind} item={current} character={character} config={config} heading="Carrying" />
        <GearCard kind={kind} item={offer} character={character} config={config} heading="Found" />
      </div>
    </section>
  );
}

/** The item's art, in a small frame edged in its rarity. */
function GearFrame({ kind, item, color }: { kind: GearKind; item: GearItem | null; color: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-12 shrink-0 place-items-center border-2 border-gilt-deep bg-[radial-gradient(circle_at_50%_35%,#3a2a1c,#120b09_75%)]"
      style={{ boxShadow: `inset 0 0 0 2px #120b09, inset 0 0 0 3px ${color}` }}
    >
      <GameIcon icon={gearIcon(item, kind)} size={32} className="text-candle" />
    </span>
  );
}
