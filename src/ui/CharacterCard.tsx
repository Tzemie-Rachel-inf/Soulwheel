/**
 * The character as the wheels have made them so far.
 *
 * Everything shown is derived from the Character record plus config lookups.
 * Combat Power is recomputed here, never read from storage.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Copy, ImageDown, X } from 'lucide-react';
import { findStep } from '../engine/adventure';
import { MAX_ARMOR_TIER, MAX_WEAPON_TIER } from '../engine/character';
import { ARMOR_STAT, getPowerBreakdown, statScale, traitPower, weaponStat } from '../engine/power';
import { RARITIES, STAT_KEYS, type AdventureRecord, type Character, type GameConfig, type RollRecord, type StatKey, type Trait } from '../engine/types';
import { CountUp } from './CountUp';
import { FameMeter } from './FameMeter';
import { Epitaph } from './Headstone';
import { STAT_LABELS, displayName, formatOdds, humanizeKey, heroRace, roleLabel, signed } from './format';
import { RARITY_STYLES, rarityOf, statRarity } from './rarity';
import { copyLegend, saveLegendImage } from './share';

interface CharacterCardProps {
  character: Character;
  /** The character before the latest roll. When set, changes are marked. */
  previous: Character | null;
  config: GameConfig;
  /** Short status line, e.g. "being rolled". */
  status: string;
  /** Shown when inspecting someone other than the character being rolled. */
  onClose?: () => void;
}

const BREAKDOWN = [
  { key: 'stats', label: 'Stats', swatch: 'bg-cp-stats' },
  { key: 'weapon', label: 'Weapon', swatch: 'bg-cp-weapon' },
  { key: 'armor', label: 'Armour', swatch: 'bg-cp-armor' },
  { key: 'traits', label: 'Traits', swatch: 'bg-cp-traits' },
] as const;

export function CharacterCard({ character, previous, config, status, onClose }: CharacterCardProps) {
  const power = getPowerBreakdown(character);
  const before = previous ? getPowerBreakdown(previous) : null;
  const cpDelta = before ? power.total - before.total : 0;
  const statMax = Math.max(40, Math.ceil(Math.max(...STAT_KEYS.map((k) => character.stats[k])) / 10) * 10);
  const barTotal = Math.max(1, power.stats + Math.max(0, power.weapon) + Math.max(0, power.armor) + Math.max(0, power.traits));
  const race = heroRace(config, character);
  const role = roleLabel(character);
  const personality = character.personality ? config.personalities[character.personality] : undefined;
  const archetype = character.archetype ? config.archetypes[character.archetype] : undefined;
  const rolled = rolledStats(character, config);
  const rolledBefore = previous ? rolledStats(previous, config) : rolled;

  return (
    <section aria-labelledby="character-name" className="court-panel">
      <header className="flex items-start gap-3 px-5 pb-4 pt-5">
        <div className="min-w-0 flex-1">
          <h2
            id="character-name"
            className={`font-display text-3xl leading-tight ${character.name ? 'text-candle' : 'text-ash'}`}
          >
            {displayName(character, config)}
          </h2>
          {character.title && <p className="font-display text-xl leading-tight text-gilt-bright">{character.title}</p>}
          <p className="text-sm italic text-ash">
            {race ? `${race} ${role.toLowerCase()}` : role}, {status}
          </p>
          {!character.name && character.status === 'rolling' && (
            <p className="text-sm text-ash">Named when the last wheel lands, from everything they roll.</p>
          )}
          {archetype && (
            <p className="text-sm text-vellum">
              {archetype.name}
              <span className="text-ash"> · {archetype.description}</span>
            </p>
          )}
          {personality && (
            <p className="text-sm text-vellum">
              {personality.name}
              <span className="text-ash"> · {personality.description}</span>
            </p>
          )}
          {character.lineage && (
            <p className="text-sm text-gilt-bright">
              Of House {character.lineage.house}, generation {character.lineage.generation}
            </p>
          )}
          {(character.daily || character.seed) && (
            <p className="text-sm text-ash">
              {character.daily ? `The Daily Soul of ${character.daily}` : `Rolled from the seed “${character.seed}”`}
            </p>
          )}
          {character.fate && character.status !== 'fallen' && (
            <p className="text-sm text-gilt-bright">{character.fate.summary}</p>
          )}
          {character.singletonClaims.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {character.singletonClaims.map((key) => (
                <li
                  key={key}
                  className="rounded-sm border border-gilt/70 bg-gilt/10 px-2 py-0.5 text-sm text-candle"
                >
                  One of a kind: {humanizeKey(key)}
                </li>
              ))}
            </ul>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="btn-plaque flex items-center gap-1 px-2.5 py-1.5 text-sm"
          >
            <X aria-hidden="true" size={14} />
            Close
          </button>
        )}
      </header>

      {character.status === 'fallen' && (
        <div className="border-t-2 border-lead px-5 py-5">
          <Epitaph character={character} config={config} />
        </div>
      )}

      {/* Combat power: the one hero figure on the page. */}
      <div className="border-t-2 border-lead px-5 py-4">
        <p className="font-caps text-base tracking-wide text-ash">Combat power</p>
        <p className="mt-1 flex items-baseline gap-3">
          <CountUp value={power.total} className="court-title font-caps text-6xl font-bold leading-none lining-nums tabular-nums" />
          {cpDelta !== 0 && <span className="text-lg text-moss">{signed(cpDelta)}</span>}
          {power.multiplier !== 1 && (
            <span className="text-lg font-semibold text-gilt-bright" title="Trait multipliers on all Combat Power">
              ×{Math.round(power.multiplier * 100) / 100}
            </span>
          )}
        </p>
        <div
          className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-r-[4px]"
          role="img"
          aria-label={`Stats ${power.stats}, weapon ${power.weapon}, armour ${power.armor}, traits ${power.traits}`}
        >
          {BREAKDOWN.map(({ key, label, swatch }) =>
            power[key] > 0 ? (
              <span
                key={key}
                title={`${label}: ${power[key]}`}
                className={`${swatch} h-full transition-[flex-grow] duration-700 ease-out`}
                style={{ flexGrow: power[key] / barTotal, flexBasis: 0 }}
              />
            ) : null,
          )}
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {BREAKDOWN.map(({ key, label, swatch }) => (
            <li key={key} className="flex items-center gap-2 text-ash">
              <span aria-hidden="true" className={`size-2.5 rounded-[2px] ${swatch}`} />
              {label}
              <span className="tabular-nums text-vellum">{power[key]}</span>
            </li>
          ))}
        </ul>
        {character.status !== 'rolling' && (
          <div className="mt-4">
            <p className="text-sm text-ash">Fame</p>
            <FameMeter config={config} fame={character.fame} />
          </div>
        )}
      </div>

      <div className="border-t-2 border-lead px-5 py-4">
        <h3 className="sr-only">Stats</h3>
        <ul className="grid gap-2">
          {STAT_KEYS.map((key) => {
            const value = character.stats[key];
            const bank = character.statBonus[key];
            // A stat's first roll replaces its starting value, so a delta would mean nothing.
            const delta = previous && rolledBefore.has(key) ? value - previous.stats[key] : 0;
            if (!rolled.has(key)) {
              return (
                <li key={key} className="grid grid-cols-[5.5rem_minmax(0,1fr)_2rem_2rem] items-end gap-3">
                  <span className="text-sm text-ash">{STAT_LABELS[key]}</span>
                  <span className="min-w-0">
                    <span className="block text-xs text-ash">Not rolled yet</span>
                    <span className="mt-1 block h-1.5 rounded-r-[3px] bg-cp-stats-track" />
                  </span>
                  <span className="text-right text-ash" aria-label="Not rolled yet">
                    –
                  </span>
                  <span
                    className={`text-right text-sm tabular-nums ${bank >= 0 ? 'text-gilt-bright' : 'text-ember'}`}
                    title={bank !== 0 ? `Banked: moves the ${STAT_LABELS[key]} roll ${Math.abs(bank)} ${Math.abs(bank) === 1 ? 'position' : 'positions'} ${bank > 0 ? 'up' : 'down'}` : undefined}
                  >
                    {bank !== 0 ? signed(bank) : ''}
                  </span>
                </li>
              );
            }
            const standing = statRarity(value);
            const { color } = RARITY_STYLES[standing];
            const rank = RARITIES.indexOf(standing);
            return (
              <li key={key} className="grid grid-cols-[5.5rem_minmax(0,1fr)_2rem_2rem] items-end gap-3">
                <span className="text-sm text-vellum">{STAT_LABELS[key]}</span>
                <span className="min-w-0">
                  <StatTier name={config.statName?.(key, value, character)} value={value} />
                  <span className="mt-1 block h-1.5 rounded-r-[3px] bg-cp-stats-track">
                    <span
                      className="block h-full rounded-r-[3px] bg-cp-stats transition-[width] duration-700 ease-out"
                      style={{
                        width: `${Math.min(100, (value / statMax) * 100)}%`,
                        ...(rank > 0 && { background: color }),
                        ...(rank >= RARITIES.indexOf('epic') && { boxShadow: `0 0 8px ${color}` }),
                      }}
                    />
                  </span>
                </span>
                <span className="text-right tabular-nums text-vellum">{value}</span>
                <span className={`text-right text-sm tabular-nums ${delta > 0 ? 'text-moss' : 'text-ember'}`}>
                  {delta !== 0 ? signed(delta) : ''}
                </span>
              </li>
            );
          })}
        </ul>
        {rolled.size < STAT_KEYS.length && STAT_KEYS.some((k) => character.statBonus[k] !== 0) && (
          <p className="mt-3 text-sm text-ash">
            <span className="text-gilt-bright">Gold</span> numbers are banked from ancestry, archetype and fate. When that
            stat is rolled, each point hammers the result up a position (past the top, into Ascension).
          </p>
        )}
        {character.luck !== 0 && (
          <p className="mt-3 text-sm text-ash">
            <span className={character.luck > 0 ? 'text-moss' : 'text-ember'}>Luck {signed(character.luck)}</span>
            {character.luck > 0
              ? ': stat wheels, the Armory and treasure lean toward the good slices.'
              : ': stat wheels, the Armory and treasure lean toward the poor slices.'}
          </p>
        )}
      </div>

      <div className="border-t-2 border-lead px-5 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="shrink-0 whitespace-nowrap font-caps text-base tracking-wide text-ash">Weapon tier</h3>
          <p className="text-right text-sm text-ash">
            <span className="tabular-nums text-vellum">{character.weaponTier}</span> of {MAX_WEAPON_TIER}, worth{' '}
            <span className="tabular-nums text-vellum">{power.weapon}</span> CP
            {character.weaponTier > 0 && power.weaponScale !== 1 && (
              <span> (×{roundScale(power.weaponScale)} from {STAT_LABELS[weaponStat(character)]})</span>
            )}
          </p>
        </div>
        <TierPips filled={character.weaponTier} max={MAX_WEAPON_TIER} on="bg-cp-weapon" off="border-cp-weapon/45" />
        <div className="mt-4 flex items-baseline justify-between gap-3">
          <h3 className="shrink-0 whitespace-nowrap font-caps text-base tracking-wide text-ash">Armour tier</h3>
          <p className="text-right text-sm text-ash">
            <span className="tabular-nums text-vellum">{character.armorTier}</span> of {MAX_ARMOR_TIER}, worth{' '}
            <span className="tabular-nums text-vellum">{power.armor}</span> CP
            {character.armorTier > 0 && power.armorScale !== 1 && (
              <span> (×{roundScale(power.armorScale)} from {STAT_LABELS[ARMOR_STAT]})</span>
            )}
          </p>
        </div>
        <TierPips filled={character.armorTier} max={MAX_ARMOR_TIER} on="bg-cp-armor" off="border-cp-armor/45" />
      </div>

      <div className="border-t-2 border-lead px-5 py-4">
        <h3 className="font-caps text-base tracking-wide text-ash">Traits</h3>
        {character.traits.length === 0 ? (
          <p className="mt-1 text-sm text-ash">None yet. The wheels decide what this soul carries.</p>
        ) : (
          <ul className="mt-2 grid gap-3">
            <AnimatePresence initial={false}>
              {character.traits.map((trait) => (
                <motion.li
                  key={trait.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="flex items-start gap-3"
                >
                  <span aria-hidden="true" className="mt-2 size-2.5 shrink-0 rounded-[2px] bg-cp-traits" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-vellum">
                      {trait.name}
                      {trait.item && (
                        <span className="ml-2 text-xs font-semibold uppercase tracking-wider text-cp-armor">{ITEM_LABELS[trait.item]}</span>
                      )}
                      {trait.rank && (
                        <span className="ml-2 text-xs font-semibold uppercase tracking-wider text-gilt-bright">{trait.rank}</span>
                      )}
                    </p>
                    <p className="text-sm text-ash">{trait.description}</p>
                  </div>
                  <span className="text-right text-sm tabular-nums text-vellum">
                    {signed(traitPower(trait, character))}
                    {trait.scalesWith?.length ? <TraitScale character={character} stats={trait.scalesWith} /> : null}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {/* While they're being rolled, the path is the story. Once they live, their adventures are,
          newest first, and how the wheels made them folds away. */}
      {character.status === 'rolling' ? (
        <WheelPath character={character} config={config} />
      ) : (
        <>
          <Adventures character={character} config={config} />
          <WheelPath character={character} config={config} folded />
        </>
      )}

      {character.status !== 'rolling' && <ShareRow character={character} config={config} />}
    </section>
  );
}

/** Every wheel creation spun for them, with the odds. Folded away once they are out in the world. */
function WheelPath({ character, config, folded = false }: { character: Character; config: GameConfig; folded?: boolean }) {
  const list =
    character.history.length === 0 ? (
      <p className="mt-1 text-sm text-ash">Nothing rolled yet.</p>
    ) : (
      <ol className="mt-2 grid gap-2">
        {character.history.map((roll) => {
          const { step, option } = lookupRoll(config, roll);
          const rarity = rarityOf(option);
          return (
            <li key={roll.stepId + roll.optionId} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-xs text-ash">{step?.title ?? roll.stepId}</span>
                <span className="text-vellum">{option?.label ?? roll.optionId}</span>
                {roll.bumpedFrom && (
                  <span className="ml-2 text-xs text-gilt-bright">
                    hammered up from {step?.options.find((o) => o.id === roll.bumpedFrom)?.label ?? roll.bumpedFrom}
                  </span>
                )}
                {rarity !== 'common' && (
                  <span
                    className="ml-2 text-[0.7rem] font-semibold uppercase tracking-wider"
                    style={{ color: RARITY_STYLES[rarity].color }}
                  >
                    {RARITY_STYLES[rarity].label}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-sm text-ash">{formatOdds(roll.probability)}</span>
            </li>
          );
        })}
      </ol>
    );
  if (folded) {
    return (
      <details className="group border-t-2 border-lead px-5 py-4">
        <summary className="cursor-pointer font-caps text-base tracking-wide text-ash hover:text-vellum">
          Born of the wheels <span className="font-sans italic">({character.history.length} spins)</span>
        </summary>
        {list}
      </details>
    );
  }
  return (
    <div className="border-t-2 border-lead px-5 py-4">
      <h3 className="font-caps text-base tracking-wide text-ash">Path through the wheels</h3>
      {list}
    </div>
  );
}

/** Their adventures, newest first. */
function Adventures({ character, config }: { character: Character; config: GameConfig }) {
  if (character.adventures.length === 0) return null;
  return (
    <div className="border-t-2 border-lead px-5 py-4">
      <h3 className="font-caps text-base tracking-wide text-ash">Adventures</h3>
      <ol className="mt-2 grid gap-2">
        {[...character.adventures].reverse().map((adventure, i) => {
          const n = character.adventures.length - 1 - i;
          const fame = adventure.rolls.reduce((sum, roll) => sum + (roll.fame ?? 0), 0);
          const notes = adventure.rolls.flatMap((roll) => (roll.note ? [roll.note] : []));
          return (
            <li key={n} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-baseline gap-x-2">
              <span className="text-sm tabular-nums text-ash">{n + 1}.</span>
              <span className="min-w-0 text-vellum">
                {adventure.quest ? (
                  // A quest is told by its story, not its thirty spins.
                  <>
                    <span className="font-semibold text-candle">Quest: {adventure.quest.title}</span>
                    {adventure.quest.log.slice(1).map((line, k) => (
                      <span key={k} className="block text-sm text-vellum">
                        {line}
                      </span>
                    ))}
                    {adventure.quest.rival && (
                      <span className="block text-sm text-ember">
                        Rival {adventure.quest.rival.name}: {adventure.quest.rival.fate}.
                      </span>
                    )}
                  </>
                ) : (
                  adventure.rolls
                    .map((roll) => {
                      const label = lookupRoll(config, roll).option?.label ?? roll.optionId;
                      return roll.cast ? `${label} (${roll.cast})` : label;
                    })
                    .join(' → ')
                )}
                {notes.map((note) => (
                  <span key={note} className="block text-sm text-gilt-bright">
                    {note}
                  </span>
                ))}
              </span>
              <span className="text-right text-sm">
                <span className={OUTCOME_TONE[adventure.outcome]}>{outcomeLabel(adventure)}</span>
                {fame !== 0 && (
                  <span className={`block tabular-nums ${fame > 0 ? 'text-moss' : 'text-ember'}`}>{signed(fame)} fame</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Copy the legend as text, or save it as a card image. */
function ShareRow({ character, config }: { character: Character; config: GameConfig }) {
  const [said, setSaid] = useState<string | null>(null);
  useEffect(() => {
    if (!said) return;
    const timer = window.setTimeout(() => setSaid(null), 2500);
    return () => window.clearTimeout(timer);
  }, [said]);
  const button =
    'btn-plaque flex items-center gap-1.5 px-2.5 py-1.5 text-sm';
  return (
    <div className="flex flex-wrap items-center gap-2 border-t-2 border-lead px-5 py-3">
      <span className="mr-auto text-sm text-ash">Share their legend</span>
      <span className="text-sm text-moss" aria-live="polite">
        {said}
      </span>
      <button
        type="button"
        className={button}
        onClick={async () => setSaid((await copyLegend(character, config)) ? 'Copied' : 'Could not copy')}
      >
        <Copy aria-hidden="true" size={14} />
        Copy legend
      </button>
      <button
        type="button"
        className={button}
        onClick={async () => setSaid((await saveLegendImage(character, config)) ? 'Saved' : 'Could not draw it')}
      >
        <ImageDown aria-hidden="true" size={14} />
        Save image
      </button>
    </div>
  );
}

/**
 * What a stat's value is called, decorated by how strong it is: grey up to Average, then
 * the rarity colours with a star per tier (Strong ✦, Mighty ✦✦ … Ascension ✦✦✦✦ with a
 * shimmer). Weak stats (6 and under) read faded.
 */
function StatTier({ name, value }: { name?: string; value: number }) {
  const standing = statRarity(value);
  const { color } = RARITY_STYLES[standing];
  const stars = RARITIES.indexOf(standing);
  const shimmer = stars >= RARITIES.indexOf('legendary');
  if (!name) return null;
  return (
    <span className="flex min-w-0 items-baseline gap-1.5 text-xs font-semibold">
      <span
        className={`truncate ${shimmer ? 'rarity-shimmer' : ''} ${stars === 0 ? (value <= 6 ? 'italic text-ash/70' : 'text-ash') : ''}`}
        style={stars > 0 ? ({ color, '--shine': color } as CSSProperties) : undefined}
      >
        {name}
      </span>
      {stars > 0 && (
        <span aria-hidden="true" className="shrink-0 tracking-tight" style={{ color, textShadow: stars >= 3 ? `0 0 6px ${color}` : undefined }}>
          {'✦'.repeat(stars)}
        </span>
      )}
    </span>
  );
}

/** Under a scaling trait's power: "×1.4 Arcana", from the best of its stats. */
function TraitScale({ character, stats }: { character: Character; stats: StatKey[] }) {
  const best = stats.reduce((a, b) => (character.stats[b] > character.stats[a] ? b : a));
  return (
    <span className="block text-xs text-ash">
      ×{roundScale(statScale(character.stats[best]))} {STAT_LABELS[best]}
    </span>
  );
}

function roundScale(scale: number): number {
  return Math.round(scale * 100) / 100;
}

function outcomeLabel({ outcome, turnedTo, note }: AdventureRecord): string {
  if (note) return note;
  if (outcome === 'turned') {
    return turnedTo === 'minion' ? 'Swore to the Demon Lord' : turnedTo === 'npc' ? 'Took up a new life' : 'Turned outlaw';
  }
  return { returned: 'Returned', retired: 'Retired', victorious: 'Victorious', fallen: 'Fell', sealed: 'Sealed away' }[outcome];
}

const OUTCOME_TONE: Record<AdventureRecord['outcome'], string> = {
  returned: 'text-ash',
  turned: 'text-ember',
  retired: 'text-gilt-bright',
  victorious: 'text-gilt-bright',
  fallen: 'text-ember',
  sealed: 'text-gilt-bright',
};

const ITEM_LABELS: Record<NonNullable<Trait['item']>, string> = { weapon: 'Weapon', armor: 'Armour', relic: 'Relic' };

/**
 * The stats a character has rolled. Only a character still being rolled has unrolled
 * stats; anyone in the world counts as having them all (older saves predate stat wheels).
 */
function rolledStats(char: Character, config: GameConfig): Set<StatKey> {
  if (char.status !== 'rolling') return new Set(STAT_KEYS);
  const keys = char.history.flatMap((roll) => Object.keys(lookupRoll(config, roll).option?.setStats ?? {}));
  return new Set(keys as StatKey[]);
}

/** The wheel and option a roll points at, retirement wheel included. Either may be gone after a config change. */
function lookupRoll(config: GameConfig, roll: RollRecord) {
  const step = findStep(config, roll.stepId);
  return { step, option: step?.options.find((o) => o.id === roll.optionId) };
}

/** Tiers as a row of lozenges on a gilt rule: filled in the tier's colour, empty ones outlined. */
function TierPips({ filled, max, on, off }: { filled: number; max: number; on: string; off: string }) {
  return (
    <div className="relative mt-3 flex justify-between px-1" aria-hidden="true">
      <span className="absolute inset-x-0 top-1/2 h-px bg-gilt-deep" />
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`relative size-2.5 rotate-45 border transition-colors duration-500 ${i < filled ? `${on} border-gilt-bright/70` : `bg-slab ${off}`}`}
        />
      ))}
    </div>
  );
}
