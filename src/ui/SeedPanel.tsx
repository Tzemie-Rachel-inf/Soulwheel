/**
 * Before the first spin: roll by chance, roll today's Daily Soul (the same seed for everyone
 * today), or roll from a seed someone shared. While a seeded soul is being rolled, a banner
 * says so. Today's daily results sit underneath, ready to copy and compare.
 */
import { useState, type FormEvent } from 'react';
import { CalendarDays, Copy, Dices, Sprout, Trash2 } from 'lucide-react';
import type { Character } from '../engine/types';
import type { SoulStart } from '../state/useCharacterGeneration';
import { bestStat } from '../engine/lineage';
import { STAT_LABELS } from './format';
import { dailySeed, dailyShareText, today, useProfile, type DailyResult } from '../state/profile';

const chip =
  'btn-plaque flex items-center gap-1.5 px-3 py-1.5 text-sm pointer-coarse:min-h-11 disabled:cursor-not-allowed disabled:opacity-50';

function prettyDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

interface SeedPanelProps {
  /** The soul being rolled. */
  character: Character;
  /** No wheel spun yet: the seed can still be chosen. */
  fresh: boolean;
  /** Their parent, if they are an heir. */
  parent: Character | null;
  onRoll: (from: SoulStart | null) => void;
  /** Throw this soul away mid-roll and start over. Absent when it can't be scrapped right now. */
  onScrap?: () => void;
}

export function SeedPanel({ character, fresh, parent, onRoll, onScrap }: SeedPanelProps) {
  const profile = useProfile();
  const [typed, setTyped] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const date = today();
  const results = profile.dailies.filter((d) => d.date === date).sort((a, b) => b.fame - a.fame || b.adventures - a.adventures);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const seed = typed.trim();
    if (seed) onRoll({ seed });
  };

  const copy = async (r: DailyResult) => {
    try {
      await navigator.clipboard.writeText(dailyShareText(r));
      setCopied(r.characterId);
    } catch {
      setCopied(null);
    }
  };

  const banner = character.lineage ? (
    <>
      The heir of <span className="font-semibold text-candle">{parent?.name ?? 'a fallen hero'}</span>, born into House{' '}
      {character.lineage.house} (generation {character.lineage.generation}).
      {parent && ` +1 ${STAT_LABELS[bestStat(parent)]} banked from their parent;`} {character.fame} fame to the name; the Wheel of Ancestry
      leans toward their parent’s.
    </>
  ) : character.daily ? (
    <>
      Rolling the <span className="font-semibold text-candle">Daily Soul</span> for {prettyDate(character.daily)}. Everyone who rolls it
      today spins the same wheels, and their adventures draw from the same seed.
    </>
  ) : character.seed ? (
    <>
      Rolling from the seed <span className="font-semibold text-candle">“{character.seed}”</span>. The same seed rolls the same soul.
    </>
  ) : null;

  return (
    <div className="court-panel mb-6 px-4 py-3">
      {banner ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-sm text-vellum">{banner}</p>
          {fresh && (
            <button type="button" className={chip} onClick={() => onRoll(null)}>
              <Dices aria-hidden="true" size={14} />
              {character.lineage ? 'Roll a stranger instead' : 'Roll by chance instead'}
            </button>
          )}
        </div>
      ) : fresh ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={chip} onClick={() => onRoll({ seed: dailySeed(date), daily: date })}>
            <CalendarDays aria-hidden="true" size={14} />
            Roll today’s Daily Soul
          </button>
          <form onSubmit={submit} className="flex min-w-0 basis-full items-center gap-2 sm:basis-0 sm:flex-1">
            <label htmlFor="seed-input" className="sr-only">
              Seed
            </label>
            <input
              id="seed-input"
              value={typed}
              onChange={(e) => setTyped(e.currentTarget.value)}
              placeholder="or a seed someone shared"
              maxLength={60}
              className="min-w-0 flex-1 border border-lead bg-nave px-2.5 py-1.5 text-sm text-vellum placeholder:text-ash/80 focus:border-gilt pointer-coarse:min-h-11 pointer-coarse:text-base"
            />
            <button type="submit" className={chip} disabled={!typed.trim()}>
              <Sprout aria-hidden="true" size={14} />
              Roll it
            </button>
          </form>
        </div>
      ) : (
        <p className="text-sm text-ash">Rolled by chance.</p>
      )}

      {!fresh && onScrap && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-lead pt-2">
          {confirming ? (
            <>
              <p className="text-sm text-ember">Scrap this soul? Every wheel spun so far is lost.</p>
              <button
                type="button"
                className={chip}
                onClick={() => {
                  setConfirming(false);
                  onScrap();
                }}
              >
                <Trash2 aria-hidden="true" size={14} />
                Yes, scrap them
              </button>
              <button type="button" className={chip} onClick={() => setConfirming(false)} autoFocus>
                Keep rolling
              </button>
            </>
          ) : (
            <button type="button" className={chip} onClick={() => setConfirming(true)}>
              <Trash2 aria-hidden="true" size={14} />
              Scrap this soul and start over
            </button>
          )}
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-3 border-t border-lead pt-2">
          <p className="font-caps text-base tracking-wide text-ash">Today’s Daily Soul, your runs</p>
          <ul className="mt-1 grid gap-1">
            {results.map((r) => (
              <li key={r.characterId} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                <span className="font-semibold text-candle">{r.name}</span>
                <span className="text-vellum">
                  {r.adventures} adventure{r.adventures === 1 ? '' : 's'}, {r.tier}
                </span>
                <span className="min-w-0 flex-1 truncate text-ash">{r.end}</span>
                <button type="button" onClick={() => copy(r)} className="flex items-center gap-1 text-ash hover:text-candle">
                  <Copy aria-hidden="true" size={12} />
                  {copied === r.characterId ? 'Copied' : 'Copy'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
