/**
 * Every option on the inspected wheel, as data: weights before and after dealing, slice
 * size against true chance, effects, where it leads, and a button to force it.
 */
import { Fragment } from 'react';
import { Lock, Zap } from 'lucide-react';
import { canBeDealt } from '../engine/odds';
import type { Character, GameConfig, ResolvedSlice, WheelOption, WheelStep, World } from '../engine/types';
import { describeEffects, favouredBy, formatPercent, optionLabel, unlockedBy } from '../ui/format';
import { RARITY_STYLES, rarityOf } from '../ui/rarity';
import { glassColor } from '../ui/wheel/paintWheel';
import { dealFactors, nextWheel, type NextWheel } from './lab';
import type { WheelCatalog, WheelGroup } from './wheelCatalog';

interface OptionTableProps {
  config: GameConfig;
  catalog: WheelCatalog;
  group: WheelGroup;
  /** The wheel as the subject faces it. */
  step: WheelStep;
  slices: readonly ResolvedSlice[];
  subject: Character;
  world: World;
  castName?: string;
  winnerIndex: number | null;
  busy: boolean;
  onGo: (stepId: string) => void;
  onForce: (index: number) => void;
}

export function OptionTable(props: OptionTableProps) {
  const { config, step, slices, subject, castName, winnerIndex, busy, onForce } = props;
  const totalSize = slices.reduce((sum, s) => sum + Math.max(0, s.option.baseWeight), 0);
  // Trait outcomes this subject can't get: never on their wheel, listed here for reference.
  const hidden = step.options.filter((o) => !canBeDealt(o, subject, config));

  return (
    <div className="overflow-x-auto rounded-md border-2 border-lead bg-slab">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <thead className="border-b-2 border-lead text-xs uppercase tracking-wider text-ash">
          <tr>
            <th className="px-3 py-2 font-semibold">Option</th>
            <th className="px-3 py-2 font-semibold">Weight</th>
            <th className="px-3 py-2 text-right font-semibold" title="Share of the wheel the slice is drawn with">
              Size
            </th>
            <th className="px-3 py-2 text-right font-semibold" title="The true chance the RNG rolls with">
              Chance
            </th>
            <th className="px-3 py-2 font-semibold">Effects</th>
            <th className="px-3 py-2 font-semibold">Leads to</th>
            <th className="px-3 py-2">
              <span className="sr-only">Force</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {slices.map((slice) => {
            const base = step.options.find((o) => o.id === slice.option.id)!;
            const won = winnerIndex === slice.index;
            return (
              <tr
                key={slice.option.id}
                className={`border-b border-lead/70 align-top last:border-0 ${won ? 'bg-gilt/15' : ''} ${slice.locked ? 'text-ash' : ''}`}
              >
                <td className="px-3 py-2">
                  <OptionName slice={slice} />
                </td>
                <td className="px-3 py-2 tabular-nums">
                  <Weight step={step} base={base} dealt={slice.option} subject={subject} config={config} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {totalSize > 0 ? formatPercent(Math.max(0, slice.option.baseWeight) / totalSize) : '–'}
                </td>
                <td className={`px-3 py-2 text-right tabular-nums ${slice.locked ? '' : 'text-candle'}`}>
                  {slice.locked ? 'Locked' : formatPercent(slice.probability)}
                </td>
                <td className="max-w-[18rem] px-3 py-2">
                  <Effects option={slice.option} base={base} config={config} castName={castName} subject={subject} />
                </td>
                <td className="px-3 py-2">
                  <LeadsTo {...props} option={slice.option} />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onForce(slice.index)}
                    title={`Spin and land on ${slice.option.label}`}
                    className="flex items-center gap-1 rounded-sm border border-lead bg-slab-raised px-2 py-1 text-xs text-vellum transition-colors hover:bg-slab-hover disabled:opacity-40"
                  >
                    <Zap aria-hidden="true" size={12} />
                    Force
                  </button>
                </td>
              </tr>
            );
          })}
          {hidden.map((option) => (
            <tr key={option.id} className="border-b border-lead/70 align-top text-ash last:border-0">
              <td className="px-3 py-2">
                <p className="text-ash">{optionLabel(option)}</p>
                <p className="font-mono text-xs">{option.id}</p>
                <p className="text-xs text-moss">Hidden: needs {needs(option, config)}</p>
              </td>
              <td className="px-3 py-2 tabular-nums">{round(option.baseWeight)}</td>
              <td className="px-3 py-2 text-right">–</td>
              <td className="px-3 py-2 text-right">–</td>
              <td className="max-w-[18rem] px-3 py-2">
                <Effects option={option} base={option} config={config} castName={castName} subject={subject} />
              </td>
              <td className="px-3 py-2" colSpan={2}>
                <span className="text-xs">Give the subject what it needs to see it</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** What a hidden option needs before it is dealt: a trait, a tag (a hook), or a race. */
function needs(option: WheelOption, config: GameConfig): string {
  const traits = (option.requiresTrait ?? []).map((id) => config.traits[id]?.name ?? id);
  const tags = (option.requiresTag ?? []).map((tag) => config.hooks?.[tag]?.label ?? tag);
  const races = (option.requiresRace ?? []).map((id) => config.races[id]?.name ?? id);
  return [traits, tags, races].filter((list) => list.length > 0).map((list) => list.join(' or ')).join(', and ');
}

function OptionName({ slice }: { slice: ResolvedSlice }) {
  const rarity = rarityOf(slice.option);
  const { label, color } = RARITY_STYLES[rarity];
  return (
    <div className="flex items-start gap-2">
      <span
        aria-hidden="true"
        className="mt-1 size-3 shrink-0 rounded-full border border-lead"
        style={{ background: glassColor(slice) }}
      />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-1.5 text-vellum">
          {slice.locked && <Lock aria-hidden="true" size={12} className="shrink-0 text-ash" />}
          {optionLabel(slice.option)}
          {rarity !== 'common' && (
            <span className="text-[0.65rem] font-semibold uppercase tracking-wider" style={{ color }}>
              {label}
            </span>
          )}
        </p>
        <p className="font-mono text-xs text-ash">{slice.option.id}</p>
        {slice.locked && <p className="text-xs text-ember">{slice.lockReason}</p>}
      </div>
    </div>
  );
}

/** Base weight, and the dealt weight with what changed it. */
function Weight({
  step,
  base,
  dealt,
  subject,
  config,
}: {
  step: WheelStep;
  base: WheelOption;
  dealt: WheelOption;
  subject: Character;
  config: GameConfig;
}) {
  const factors = dealFactors(step, base, subject, config);
  const chips = [
    factors.race !== 1 && `race ×${round(factors.race)}`,
    factors.archetype !== 1 && `archetype ×${round(factors.archetype)}`,
    factors.luck !== 1 && `luck ×${round(factors.luck)}`,
    factors.stats !== 1 && `stats ×${round(factors.stats)}`,
    factors.fight !== 1 && `fight ×${round(factors.fight)}`,
  ].filter((c): c is string => Boolean(c));
  return (
    <div>
      <p className="whitespace-nowrap text-vellum">
        {round(base.baseWeight)}
        {dealt.baseWeight !== base.baseWeight && <span className="text-candle"> → {round(dealt.baseWeight)}</span>}
      </p>
      {chips.map((chip) => (
        <p key={chip} className="whitespace-nowrap text-xs text-gilt-bright">
          {chip}
        </p>
      ))}
    </div>
  );
}

function Effects({
  option,
  base,
  config,
  castName,
  subject,
}: {
  option: WheelOption;
  base: WheelOption;
  config: GameConfig;
  castName?: string;
  subject: Character;
}) {
  const effects = describeEffects(option, config, base, castName);
  const notes = [
    base.epithet && `title “${base.epithet.text}” (${base.epithet.priority})`,
    base.surname && `surname ${base.surname}`,
    base.fight && `fight: ${base.fight}`,
    base.luckScaling && `luck ${signedRound(base.luckScaling)}/pt`,
    base.threatScaling && `threat ${signedRound(base.threatScaling)}/lvl`,
    base.condition && 'has a condition',
    base.requiresTrait && `trait outcome: ${unlockedBy(base, config, subject)}`,
    favouredBy(base) && `favours ${favouredBy(base)}`,
  ].filter((n): n is string => Boolean(n));
  if (effects.length === 0 && notes.length === 0) return <span className="text-ash">–</span>;
  return (
    <div>
      {effects.length > 0 && <p className="text-vellum">{effects.join(' · ')}</p>}
      {notes.length > 0 && <p className="text-xs text-ash">{notes.join(' · ')}</p>}
    </div>
  );
}

/** Where the option goes for this subject, plus the other wheels a route could pick. */
function LeadsTo({
  config,
  catalog,
  group,
  step,
  subject,
  world,
  option,
  onGo,
}: OptionTableProps & { option: WheelOption }) {
  const next: NextWheel = nextWheel(config, step, option, subject, world, group);
  const route = option.nextStepId !== null && typeof option.nextStepId === 'object' ? option.nextStepId : null;
  const others = route ? route.among.filter((id) => next.kind !== 'step' || id !== next.id) : [];
  const link = (id: string, strong: boolean) => (
    <button
      key={id}
      type="button"
      onClick={() => onGo(id)}
      className={`text-left underline decoration-lead underline-offset-2 hover:decoration-gilt ${strong ? 'text-candle' : 'text-ash'}`}
    >
      {catalog.byId[id]?.name ?? id}
    </button>
  );
  return (
    <div className="flex flex-col items-start gap-0.5">
      {next.kind === 'step' && link(next.id, true)}
      {next.kind === 'end' && <span className="text-ash">— {next.reason}</span>}
      {next.kind === 'error' && <span className="text-ember">{next.message}</span>}
      {route && (
        <span className="text-xs text-ash">
          route, picked for this subject
          {others.length > 0 && others.length <= 3 && (
            <>
              {' · or '}
              {others.map((id, i) => (
                <Fragment key={id}>
                  {i > 0 && ', '}
                  {link(id, false)}
                </Fragment>
              ))}
            </>
          )}
          {others.length > 3 && ` · ${others.length} other wheels`}
        </span>
      )}
    </div>
  );
}

function round(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function signedRound(n: number): string {
  return `${n > 0 ? '+' : ''}${round(n)}`;
}
