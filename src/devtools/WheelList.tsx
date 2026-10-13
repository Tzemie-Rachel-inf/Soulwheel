/**
 * Every wheel, grouped by where the game reaches it. Stat wheels sit in a race × stat grid;
 * typing searches wheel names, ids and option labels ("battle ram" finds Minotaur Might).
 */
import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { STAT_KEYS, type GameConfig } from '../engine/types';
import { STAT_LABELS } from '../ui/format';
import { GROUP_LABELS, matchesSearch, type CatalogEntry, type WheelCatalog, type WheelGroup } from './wheelCatalog';

interface WheelListProps {
  config: GameConfig;
  catalog: WheelCatalog;
  currentId: string;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (stepId: string) => void;
}

export function WheelList({ config, catalog, currentId, query, onQueryChange, onSelect }: WheelListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the current wheel in view inside the list, without scrolling the page.
  useEffect(() => {
    const box = scrollRef.current;
    const item = box?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!box || !item) return;
    const view = box.getBoundingClientRect();
    const at = item.getBoundingClientRect();
    if (at.top < view.top) box.scrollTop -= view.top - at.top + 8;
    else if (at.bottom > view.bottom) box.scrollTop += at.bottom - view.bottom + 8;
  }, [currentId, query]);

  const searching = query.trim() !== '';
  const matches = searching ? catalog.entries.filter((e) => matchesSearch(e, query)) : [];
  const stats = catalog.entries.filter((e) => e.group === 'stats');
  const training = catalog.entries.filter((e) => e.group === 'training');

  return (
    <nav aria-label="Wheels" className="flex min-h-0 flex-col rounded-md border-2 border-lead bg-slab">
      <div className="border-b-2 border-lead p-3">
        <label className="flex items-center gap-2 rounded-sm border border-lead bg-nave px-2 py-1.5 focus-within:outline-2 focus-within:outline-gilt-bright">
          <Search aria-hidden="true" size={15} className="shrink-0 text-ash" />
          <span className="sr-only">Search wheels</span>
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.currentTarget.value)}
            placeholder={`Search ${catalog.entries.length} wheels`}
            className="w-full bg-transparent text-sm text-vellum outline-none placeholder:text-ash"
          />
        </label>
      </div>

      <div ref={scrollRef} className="max-h-72 overflow-y-auto p-2 lg:max-h-[calc(100dvh-10rem)]">
        {searching ? (
          matches.length === 0 ? (
            <p className="px-2 py-1 text-sm text-ash">No wheel matches “{query.trim()}”.</p>
          ) : (
            <ul className="grid gap-0.5">
              {matches.map((entry) => (
                <Item key={entry.id} entry={entry} current={entry.id === currentId} onSelect={onSelect} showGroup />
              ))}
            </ul>
          )
        ) : (
          <>
            <Group group="creation" catalog={catalog} currentId={currentId} onSelect={onSelect} />
            {stats.length > 0 && <StatGrid group="stats" config={config} entries={stats} currentId={currentId} onSelect={onSelect} />}
            <Group group="adventure" catalog={catalog} currentId={currentId} onSelect={onSelect} />
            {training.length > 0 && (
              <StatGrid group="training" config={config} entries={training} currentId={currentId} onSelect={onSelect} />
            )}
            <Group group="unreachable" catalog={catalog} currentId={currentId} onSelect={onSelect} />
          </>
        )}
      </div>
    </nav>
  );
}

function Group({
  group,
  catalog,
  currentId,
  onSelect,
}: {
  group: WheelGroup;
  catalog: WheelCatalog;
  currentId: string;
  onSelect: (id: string) => void;
}) {
  const entries = catalog.entries.filter((e) => e.group === group);
  if (entries.length === 0) return null;
  return (
    <section className="mb-3">
      <GroupHeading label={GROUP_LABELS[group]} count={entries.length} />
      <ul className="grid gap-0.5">
        {entries.map((entry) => (
          <Item key={entry.id} entry={entry} current={entry.id === currentId} onSelect={onSelect} />
        ))}
      </ul>
    </section>
  );
}

function GroupHeading({ label, count }: { label: string; count: number }) {
  return (
    <h3 className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider text-ash">
      {label} <span className="font-normal">({count})</span>
    </h3>
  );
}

function Item({
  entry,
  current,
  onSelect,
  showGroup = false,
}: {
  entry: CatalogEntry;
  current: boolean;
  onSelect: (id: string) => void;
  showGroup?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={current}
        onClick={() => onSelect(entry.id)}
        className={`flex w-full items-baseline justify-between gap-2 rounded-sm px-2 py-1 text-left text-sm transition-colors ${
          current ? 'bg-gilt font-semibold text-ink' : 'text-vellum hover:bg-slab-raised'
        }`}
      >
        <span className="min-w-0 truncate">{entry.name}</span>
        <span className={`shrink-0 text-xs ${current ? 'text-ink/70' : 'text-ash'}`}>
          {showGroup ? GROUP_LABELS[entry.group] : entry.step.options.length}
        </span>
      </button>
    </li>
  );
}

/** One row per race, one button per stat. */
function StatGrid({
  group,
  config,
  entries,
  currentId,
  onSelect,
}: {
  group: WheelGroup;
  config: GameConfig;
  entries: CatalogEntry[];
  currentId: string;
  onSelect: (id: string) => void;
}) {
  const races = [...new Set(entries.map((e) => e.race).filter((r): r is string => r !== undefined))];
  const loose = entries.filter((e) => e.race === undefined);
  return (
    <section className="mb-3">
      <GroupHeading label={GROUP_LABELS[group]} count={entries.length} />
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="sr-only">Race</th>
            {STAT_KEYS.map((stat) => (
              <th key={stat} className="pb-1 text-center text-[0.65rem] font-semibold uppercase text-ash" title={STAT_LABELS[stat]}>
                {STAT_LABELS[stat].slice(0, 3)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {races.map((race) => (
            <tr key={race}>
              <th scope="row" className="truncate px-2 text-left font-normal text-vellum">
                {config.races[race]?.name ?? race}
              </th>
              {STAT_KEYS.map((stat) => {
                const entry = entries.find((e) => e.race === race && e.stat === stat);
                const current = entry?.id === currentId;
                return (
                  <td key={stat} className="p-0.5 text-center">
                    {entry && (
                      <button
                        type="button"
                        aria-current={current}
                        aria-label={entry.name}
                        title={entry.name}
                        onClick={() => onSelect(entry.id)}
                        className={`h-5 w-full rounded-sm border border-lead transition-colors ${
                          current ? 'bg-gilt' : 'bg-slab-raised hover:bg-slab-hover'
                        }`}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {loose.length > 0 && (
        <ul className="mt-1 grid gap-0.5">
          {loose.map((entry) => (
            <Item key={entry.id} entry={entry} current={entry.id === currentId} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </section>
  );
}
