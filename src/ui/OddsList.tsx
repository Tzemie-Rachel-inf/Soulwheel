/**
 * The true odds for the current wheel. Slices are drawn at their base size, so locks,
 * threat and omens can make a slice's real chance differ from how big it looks; this list
 * (like the wheel's tooltip) always shows the effective odds the engine rolls with.
 * It is also the wheel's text alternative for screen readers.
 */
import { Lock } from 'lucide-react';
import { activeOmens } from '../engine/roll';
import type { Character, GameConfig, Omen, ResolvedSlice, World } from '../engine/types';
import { favouredBy, formatPercent, optionLabel, unlockedBy } from './format';
import { RARITY_STYLES, rarityOf } from './rarity';
import { glassColor } from './wheel/paintWheel';

interface OddsListProps {
  slices: readonly ResolvedSlice[];
  winnerIndex: number | null;
  title: string;
  config: GameConfig;
  /** Who is spinning: names the trait behind a trait-specific outcome. */
  character?: Character;
  /** The world it is spun in: names the omens bending a slice. */
  world?: World;
}

export function OddsList({ slices, winnerIndex, title, config, character, world }: OddsListProps) {
  const omens = world ? activeOmens(world) : [];
  return (
    <ul aria-label={`Odds on the ${title}`} className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
      {slices.map((slice) => {
        const won = winnerIndex === slice.index;
        const rarity = rarityOf(slice.option);
        const { label, color } = RARITY_STYLES[rarity];
        return (
          <li
            key={slice.option.id}
            className={`grid grid-cols-[0.75rem_minmax(0,1fr)_auto] items-start gap-x-3 transition-opacity duration-500 ${
              winnerIndex !== null && !won ? 'opacity-55' : ''
            }`}
          >
            <span
              aria-hidden="true"
              className="mt-1.5 size-3 rounded-full border border-lead"
              style={{ background: glassColor(slice) }}
            />
            <span className="min-w-0">
              <span
                className={`flex flex-wrap items-center gap-x-1.5 ${slice.locked ? 'text-ash' : 'text-vellum'} ${won ? 'font-semibold text-candle' : ''}`}
              >
                {slice.locked && <Lock aria-hidden="true" size={13} className="shrink-0" />}
                {optionLabel(slice.option)}
                {rarity !== 'common' && (
                  <span className="text-[0.7rem] font-semibold uppercase tracking-wider" style={{ color }}>
                    {label}
                  </span>
                )}
              </span>
              {slice.locked && <span className="block text-sm text-ash">{slice.lockReason}</span>}
              <OptionNotes slice={slice} config={config} character={character} omens={omens} />
            </span>
            <span className={`text-sm tabular-nums ${slice.locked ? 'text-ash' : 'text-vellum'}`}>
              {slice.locked ? 'Locked' : formatPercent(slice.probability)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** "Thanks to Lockpicking" for a trait-specific outcome; "Likelier with high Intellect" for one that favours a stat. */
function OptionNotes({ slice, config, character, omens }: { slice: ResolvedSlice; config: GameConfig; character?: Character; omens: readonly Omen[] }) {
  const trait = unlockedBy(slice.option, config, character);
  const stats = favouredBy(slice.option);
  const bent = omens.flatMap((o) => {
    const k = slice.option.omenScaling?.[o.id];
    return k !== undefined && k !== 1 ? [{ label: o.label, k }] : [];
  });
  if (!trait && !stats && bent.length === 0) return null;
  return (
    <span className="block text-sm">
      {trait && <span className="text-moss">Thanks to {trait}</span>}
      {trait && stats && <span className="text-ash"> · </span>}
      {stats && <span className="text-ash">Likelier with high {stats}</span>}
      {bent.map(({ label, k }) => (
        <span key={label} className={k > 1 ? 'text-gilt-bright' : 'text-ember'}>
          {(trait || stats || bent[0]!.label !== label) && <span className="text-ash"> · </span>}
          {label} ×{k}
        </span>
      ))}
    </span>
  );
}
