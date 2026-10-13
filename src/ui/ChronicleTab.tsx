/**
 * The Chronicle tab: the world's history, newest first, a year at a time. Every line about a
 * character opens their card. The words were written when it happened (state/chronicle.ts).
 */
import { useMemo, useState } from 'react';
import { CloudLightning, Footprints, ScrollText, Skull, Swords, Trophy, type LucideIcon } from 'lucide-react';
import type { Character, ChronicleEntry, ChronicleKind, GameConfig, World } from '../engine/types';
import { seasonLabel } from '../state/chronicle';
import { FeatsPanel } from './FeatsPanel';
import { HousesPanel } from './HousesPanel';

type Filter = 'all' | 'lives' | 'endings' | 'world';
const FILTERS: { id: Filter; label: string; kinds: readonly ChronicleKind[] }[] = [
  { id: 'all', label: 'Everything', kinds: ['arrival', 'deed', 'ending', 'world', 'rival'] },
  { id: 'lives', label: 'Deeds', kinds: ['arrival', 'deed'] },
  { id: 'endings', label: 'Endings', kinds: ['ending'] },
  { id: 'world', label: 'The world', kinds: ['world', 'rival'] },
];

const PAGE = 80;

function iconOf(entry: ChronicleEntry): { Icon: LucideIcon; tone: string } {
  switch (entry.kind) {
    case 'arrival':
      return { Icon: Footprints, tone: entry.tone === 'ember' ? 'text-ember' : 'text-candle' };
    case 'ending':
      return entry.tone === 'ember' ? { Icon: Skull, tone: 'text-ember' } : { Icon: Trophy, tone: entry.tone === 'moss' ? 'text-moss' : 'text-gilt-bright' };
    case 'world':
      return { Icon: CloudLightning, tone: entry.tone === 'moss' ? 'text-moss' : 'text-ember' };
    case 'rival':
      return { Icon: Swords, tone: 'text-ember' };
    default:
      return { Icon: ScrollText, tone: entry.tone === 'gold' ? 'text-gilt-bright' : 'text-ash' };
  }
}

const TEXT_TONE: Record<NonNullable<ChronicleEntry['tone']>, string> = {
  gold: 'text-candle',
  ember: 'text-vellum',
  moss: 'text-vellum',
};

interface ChronicleTabProps {
  world: World;
  config: GameConfig;
  /** No hero is on the road, so a house can be given an heir. */
  canRaiseHeir: boolean;
  onRaiseHeir: (parent: Character) => void;
  inspectedId: string | null;
  onInspect: (characterId: string) => void;
}

const VIEWS = [
  { id: 'history', label: 'History' },
  { id: 'houses', label: 'Houses' },
  { id: 'feats', label: 'Feats' },
] as const;

export function ChronicleTab({ world, config, canRaiseHeir, onRaiseHeir, inspectedId, onInspect }: ChronicleTabProps) {
  const [view, setView] = useState<(typeof VIEWS)[number]['id']>('history');
  const now = seasonLabel(world.season);
  const lives = world.chronicle.filter((e) => e.kind === 'arrival').length;

  return (
    <>
      <h1 id="wheel-title" className="court-title text-4xl leading-none sm:text-5xl">
        The Chronicle
      </h1>
      <p className="mt-2 text-lg text-ash">
        {now.label}. {lives === 0 ? 'Nothing has happened yet.' : `${lives} ${lives === 1 ? 'soul has' : 'souls have'} entered this world.`}{' '}
        Every adventure takes a season.
      </p>

      <div role="radiogroup" aria-label="View" className="mt-5 flex flex-wrap gap-2">
        {VIEWS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={view === id}
            onClick={() => setView(id)}
            className={`${view === id ? 'btn-gilt' : 'btn-plaque font-caps font-bold'} px-4 py-1`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'feats' ? (
        <FeatsPanel world={world} config={config} />
      ) : view === 'houses' ? (
        <HousesPanel
          world={world}
          config={config}
          inspectedId={inspectedId}
          onInspect={onInspect}
          canRaiseHeir={canRaiseHeir}
          onRaiseHeir={onRaiseHeir}
        />
      ) : (
        <History world={world} inspectedId={inspectedId} onInspect={onInspect} />
      )}
    </>
  );
}

/** The history itself: filtered by kind, a page at a time, newest first. */
function History({ world, inspectedId, onInspect }: Pick<ChronicleTabProps, 'world' | 'inspectedId' | 'onInspect'>) {
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState(PAGE);

  const years = useMemo(() => {
    const kinds = FILTERS.find((f) => f.id === filter)!.kinds;
    const entries = world.chronicle.filter((e) => kinds.includes(e.kind)).reverse().slice(0, shown);
    const grouped: { year: number; entries: ChronicleEntry[] }[] = [];
    for (const e of entries) {
      const year = seasonLabel(e.season).year;
      if (grouped.at(-1)?.year !== year) grouped.push({ year, entries: [] });
      grouped.at(-1)!.entries.push(e);
    }
    return { grouped, more: world.chronicle.filter((e) => kinds.includes(e.kind)).length > shown };
  }, [world.chronicle, filter, shown]);

  return (
    <>
      <div role="radiogroup" aria-label="Show" className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={filter === f.id}
            onClick={() => {
              setFilter(f.id);
              setShown(PAGE);
            }}
            className={`btn-plaque px-3 py-1 text-sm ${filter === f.id ? 'btn-plaque-on' : ''}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {years.grouped.length === 0 ? (
        <p className="court-panel mt-8 p-5 text-vellum">
          {world.chronicle.length === 0
            ? 'The pages are empty. Roll a soul, and the world will start remembering.'
            : 'Nothing of that kind has happened yet.'}
        </p>
      ) : (
        <div className="mt-6 grid gap-8">
          {years.grouped.map(({ year, entries }) => (
            <section key={year} aria-labelledby={`year-${year}`}>
              <h2 id={`year-${year}`} className="font-display text-2xl text-gilt-bright">
                Year {year}
              </h2>
              <ol className="mt-2 grid gap-1 border-l-2 border-lead pl-4">
                {entries.map((e, i) => {
                  const { Icon, tone } = iconOf(e);
                  const body = (
                    <>
                      <Icon aria-hidden="true" size={16} className={`mt-1 shrink-0 ${tone}`} />
                      <span className="min-w-0">
                        <span className="block text-xs uppercase tracking-wider text-ash">{seasonLabel(e.season).season}</span>
                        <span className={e.tone ? TEXT_TONE[e.tone] : 'text-vellum'}>{e.text}</span>
                      </span>
                    </>
                  );
                  return (
                    <li key={`${e.season}-${i}-${e.text.slice(0, 24)}`}>
                      {e.who ? (
                        <button
                          type="button"
                          onClick={() => onInspect(e.who!)}
                          aria-pressed={inspectedId === e.who}
                          className={`flex w-full gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-slab-raised ${
                            inspectedId === e.who ? 'bg-slab-raised' : ''
                          }`}
                        >
                          {body}
                        </button>
                      ) : (
                        <div className="flex gap-3 px-2 py-1.5">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {years.more && (
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE)}
              className="btn-plaque justify-self-start px-3 py-1.5 text-sm"
            >
              Older pages
            </button>
          )}
        </div>
      )}
    </>
  );
}
