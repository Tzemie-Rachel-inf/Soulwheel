/**
 * The true odds for the current wheel. Slices are drawn at their base size, so locks,
 * threat and omens can make a slice's real chance differ from how big it looks; this list
 * (like the wheel's tooltip) always shows the effective odds the engine rolls with.
 * It is also the wheel's text alternative for screen readers.
 */
import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { archetypeFactor, personalityFactor, raceFactor } from '../engine/odds';
import { activeOmens } from '../engine/roll';
import type { Character, GameConfig, Omen, ResolvedSlice, World } from '../engine/types';
import { favouredBy, formatPercent, optionLabel, unlockedBy } from './format';
import { RARITY_STYLES, rarityOf } from './rarity';
import { glassColor } from './wheel/paintWheel';

interface OddsListProps {
  slices: readonly ResolvedSlice[];
  winnerIndex: number | null;
  title: string;
  /** The wheel's id: names who bends each slice (their race, archetype, personality). */
  stepId?: string;
  config: GameConfig;
  /** Who is spinning: names the trait behind a trait-specific outcome. */
  character?: Character;
  /** The world it is spun in: names the omens bending a slice. */
  world?: World;
}

export function OddsList({ slices, winnerIndex, title, stepId, config, character, world }: OddsListProps) {
  const omens = world ? activeOmens(world) : [];
  // Likeliest first, so the list reads top-down; locked options last. A stat ladder keeps its
  // own order (best to worst), which means more than the chances do. The wheel is never re-ordered.
  const ladder = slices.some((s) => s.option.setStats !== undefined);
  const sorted = ladder ? slices : [...slices].sort((a, b) => Number(a.locked) - Number(b.locked) || b.probability - a.probability);
  return (
    <ul aria-label={`Odds on the ${title}`} className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
      {sorted.map((slice) => {
        const won = winnerIndex === slice.index;
        const rarity = rarityOf(slice.option);
        const { label, color } = RARITY_STYLES[rarity];
        return (
          <li
            key={slice.option.id}
            className={`grid grid-cols-[0.75rem_minmax(0,1fr)_auto] items-start gap-x-3 transition-opacity duration-500 ${
              winnerIndex !== null && !won ? 'opacity-75' : ''
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
              <OptionNotes slice={slice} stepId={stepId} config={config} character={character} omens={omens} />
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

/**
 * "Thanks to Lockpicking" for a trait-specific outcome; "Likelier with high Intellect" for one that
 * favours a stat; "Ranger ×2" for one their race, archetype or personality bends; "Festival ×3" for an omen.
 */
function OptionNotes({
  slice,
  stepId,
  config,
  character,
  omens,
}: {
  slice: ResolvedSlice;
  stepId?: string;
  config: GameConfig;
  character?: Character;
  omens: readonly Omen[];
}) {
  const trait = unlockedBy(slice.option, config, character);
  const stats = favouredBy(slice.option);
  const bends: { label: string; k: number }[] = [];
  if (character && stepId) {
    const id = slice.option.id;
    const who = [
      [character.race === null ? undefined : config.races[character.race]?.name, raceFactor(stepId, id, character, config)],
      [character.archetype === null ? undefined : config.archetypes[character.archetype]?.name, archetypeFactor(stepId, id, character, config)],
      [character.personality === null ? undefined : config.personalities[character.personality]?.name, personalityFactor(stepId, id, character, config)],
    ] as const;
    for (const [label, k] of who) if (label && k !== 1) bends.push({ label, k });
  }
  for (const o of omens) {
    const k = slice.option.omenScaling?.[o.id];
    if (k !== undefined && k !== 1) bends.push({ label: o.label, k });
  }
  if (!trait && !stats && bends.length === 0) return null;
  const parts: { key: string; node: ReactNode }[] = [
    ...(trait ? [{ key: 'trait', node: <span className="text-moss">Thanks to {trait}</span> }] : []),
    ...(stats ? [{ key: 'stats', node: <span className="text-ash">Likelier with high {stats}</span> }] : []),
    ...bends.map(({ label, k }) => ({
      key: label,
      node: (
        <span className={k > 1 ? 'text-gilt-bright' : 'text-ember'}>
          {label} ×{Math.round(k * 100) / 100}
        </span>
      ),
    })),
  ];
  return (
    <span className="block text-sm">
      {parts.map(({ key, node }, i) => (
        <span key={key}>
          {i > 0 && <span className="text-ash"> · </span>}
          {node}
        </span>
      ))}
    </span>
  );
}
