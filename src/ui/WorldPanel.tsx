/**
 * The persistent world: the player's hero, who holds each one-of-a-kind role, who else is
 * in it, who has left play, and how dangerous it has become. Singleton keys are listed
 * straight from `world.activeSingletons`, so new roles show up here without any UI change.
 *
 * Threat is the world's own: quests and battles move it. Only the dev build shows a dial.
 */
import { useEffect, useState, type ChangeEvent } from 'react';
import { Crown, Flag, Flame, Footprints, Gem, GraduationCap, Store, Trophy, User, UserX, type LucideIcon } from 'lucide-react';
import { DEV_TOOLS_ENABLED } from '../devtools';
import { calculatePowerRating } from '../engine/power';
import type { Character, GameConfig, World } from '../engine/types';
import { fameStanding } from '../engine/fame';
import { activeOmens } from '../engine/roll';
import { humanizeKey, raceName, roleLabel } from './format';
import { Graveyard } from './Headstone';

interface WorldPanelProps {
  world: World;
  config: GameConfig;
  inspectedId: string | null;
  onInspect: (characterId: string) => void;
  /** Dev builds only: set the threat level by hand. */
  onThreatChange: (level: number) => void;
  onReset: () => void;
}

/** How the threat level reads, in words. */
function threatWord(level: number): string {
  return level < 1 ? 'Peaceful' : level < 3 ? 'Uneasy' : level < 5 ? 'Dangerous' : level < 7.5 ? 'Dire' : 'Apocalyptic';
}

export function WorldPanel({ world, config, inspectedId, onInspect, onThreatChange, onReset }: WorldPanelProps) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const roles = Object.entries(world.activeSingletons);
  const nameOf = (id: string) => world.roster.find((c) => c.id === id)?.name ?? 'an unknown soul';

  useEffect(() => {
    if (!confirmingReset) return;
    const timer = window.setTimeout(() => setConfirmingReset(false), 4000);
    return () => window.clearTimeout(timer);
  }, [confirmingReset]);

  return (
    <section aria-labelledby="world-title" className="court-panel">
      <div className="px-5 pb-4 pt-5">
        <h2 id="world-title" className="font-display text-2xl text-candle">
          The world
        </h2>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
          {[
            ['In the world', world.roster.length],
            ['Graveyard', world.graveyard.length],
            ['Hall of fame', world.hallOfFame.length],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-ash">{label}</dt>
              <dd className="text-xl tabular-nums text-vellum">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="border-t-2 border-lead px-5 py-4">
        <h3 className="font-caps text-base tracking-wide text-ash">One-of-a-kind roles</h3>
        {roles.length === 0 ? (
          <p className="mt-1 text-sm text-vellum">Every one-of-a-kind role is open.</p>
        ) : (
          <ul className="mt-2 grid gap-1.5">
            {roles.map(([key, holderId]) => (
              <li key={key} className="flex items-baseline justify-between gap-3">
                <span className="text-vellum">{humanizeKey(key)}</span>
                <span className="truncate text-sm text-ash">held by {nameOf(holderId)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t-2 border-lead px-5 py-4">
        <div className="flex items-baseline justify-between">
          <span id="threat-label" className="text-sm text-ash">
            Threat
          </span>
          <span className="tabular-nums text-vellum">
            {threatWord(world.threatLevel)} · {world.threatLevel.toFixed(1)}
          </span>
        </div>
        {DEV_TOOLS_ENABLED ? (
          <input
            id="threat"
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={world.threatLevel}
            aria-labelledby="threat-label"
            onChange={(e: ChangeEvent<HTMLInputElement>) => onThreatChange(Number(e.currentTarget.value))}
            className="mt-2 w-full accent-gilt"
          />
        ) : (
          <div
            role="meter"
            aria-labelledby="threat-label"
            aria-valuemin={0}
            aria-valuemax={10}
            aria-valuenow={world.threatLevel}
            className="mt-2 h-2 overflow-hidden rounded-[3px] bg-slab-raised"
          >
            <div className="h-full bg-ember transition-[width] duration-700" style={{ width: `${world.threatLevel * 10}%` }} />
          </div>
        )}
        <p className="mt-1 text-sm text-ash">
          Quests, battles and the world’s own events move it. Higher threat makes curses, monsters and death likelier and
          fades blessings.
          {DEV_TOOLS_ENABLED && ' (Dev build: drag to set it by hand.)'}
        </p>
        {activeOmens(world).length > 0 && (
          <ul className="mt-3 grid gap-1.5" aria-label="Omens">
            {activeOmens(world).map((o) => {
              const left = o.until - world.season;
              return (
                <li key={o.id} className="rounded-md border border-lead bg-slab-raised px-3 py-1.5 text-sm">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold text-candle">{o.label}</span>
                    <span className="text-xs text-ash">
                      {left} season{left === 1 ? '' : 's'} left
                    </span>
                  </span>
                  <span className="block text-ash">{o.description}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <SoulList
        title="In the world"
        empty="No one has entered the world yet. Name a soul to begin."
        souls={[...world.roster].sort((a, b) => Number(b.id === world.heroId) - Number(a.id === world.heroId))}
        config={config}
        inspectedId={inspectedId}
        onInspect={onInspect}
        icon={(c) => (c.id === world.heroId && c.role === 'hero' ? { Icon: Footprints, tone: 'text-gilt-bright' } : livingIcon(c))}
        detail={(c) => {
          const n = c.adventures.length;
          if (n === 0) return null;
          const renown = c.role === 'hero' ? `, ${fameStanding(config.fame.tiers, c.fame).tier.name}` : '';
          return `${n} adventure${n === 1 ? '' : 's'}${renown}`;
        }}
      />
      {world.hallOfFame.length > 0 && (
        <SoulList
          title="Hall of fame"
          souls={[...world.hallOfFame].reverse()}
          config={config}
          inspectedId={inspectedId}
          onInspect={onInspect}
          icon={(c) => (c.status === 'sealed' ? { Icon: Gem, tone: 'text-cp-traits' } : { Icon: Trophy, tone: 'text-gilt-bright' })}
          detail={(c) => c.fate?.summary ?? null}
        />
      )}
      {world.graveyard.length > 0 && (
        <Graveyard graves={world.graveyard} config={config} inspectedId={inspectedId} onInspect={onInspect} />
      )}

      <div className="border-t-2 border-lead px-5 py-4">
        <button
          type="button"
          onClick={() => {
            if (confirmingReset) {
              setConfirmingReset(false);
              onReset();
            } else {
              setConfirmingReset(true);
            }
          }}
          className="text-sm text-ash underline decoration-ash/40 underline-offset-4 hover:text-ember"
        >
          {confirmingReset ? 'Click again to erase this world' : 'Reset world'}
        </button>
      </div>
    </section>
  );
}

const ROLE_ICONS: Record<Character['role'], { Icon: LucideIcon; tone: string }> = {
  hero: { Icon: User, tone: 'text-ash' },
  demonLord: { Icon: Crown, tone: 'text-ember' },
  outlaw: { Icon: UserX, tone: 'text-ember' },
  minion: { Icon: Flame, tone: 'text-ember' },
  npc: { Icon: Store, tone: 'text-moss' },
};

/** NPCs who rule, command or teach get their own mark. */
const LIFE_ICONS: Record<string, { Icon: LucideIcon; tone: string }> = {
  ruler: { Icon: Crown, tone: 'text-gilt-bright' },
  general: { Icon: Flag, tone: 'text-ember' },
  mentor: { Icon: GraduationCap, tone: 'text-moss' },
};

function livingIcon(c: Character): { Icon: LucideIcon; tone: string } {
  const life = c.role === 'npc' ? Object.keys(LIFE_ICONS).find((tag) => c.tags.includes(tag)) : undefined;
  return life ? LIFE_ICONS[life]! : ROLE_ICONS[c.role];
}

interface SoulListProps {
  title: string;
  empty?: string;
  souls: readonly Character[];
  config: GameConfig;
  inspectedId: string | null;
  onInspect: (characterId: string) => void;
  icon: (c: Character) => { Icon: LucideIcon; tone: string };
  /** A short extra line under the role, or null. */
  detail: (c: Character) => string | null;
}

/** A list of characters, each a button that opens their card. */
function SoulList({ title, empty, souls, config, inspectedId, onInspect, icon, detail }: SoulListProps) {
  return (
    <div className="border-t-2 border-lead px-5 py-4">
      <h3 className="font-caps text-base tracking-wide text-ash">{title}</h3>
      {souls.length === 0 ? (
        <p className="mt-1 text-sm text-vellum">{empty}</p>
      ) : (
        <ul className="mt-2 grid gap-1">
          {souls.map((c) => {
            const { Icon, tone } = icon(c);
            const active = inspectedId === c.id;
            const race = raceName(config, c.race);
            const extra = detail(c);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onInspect(c.id)}
                  aria-pressed={active}
                  className={`grid w-full grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-slab-raised ${
                    active ? 'bg-slab-raised' : ''
                  }`}
                >
                  <Icon aria-hidden="true" size={15} className={tone} />
                  <span className="min-w-0">
                    <span className="block truncate text-vellum">{c.name}</span>
                    <span className="block truncate text-xs text-ash">
                      {[c.title, race, roleLabel(c) === c.title ? null : roleLabel(c), extra].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="text-sm tabular-nums text-vellum">{calculatePowerRating(c)} CP</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
