/**
 * A quest on screen: what it is and how far along, its threat, what the hero has gathered,
 * the rival and what they remember, and the story so far. Plus the choice cards for the
 * wheels the player decides on, and the tale told when the quest ends.
 */
import { Lock } from 'lucide-react';
import { findStep } from '../engine/adventure';
import { calculatePowerRating } from '../engine/power';
import { STORY_THREAT_MAX } from '../engine/story';
import type { Character, GameConfig, QuestRecord, ResolvedSlice, StoryState, WheelOption } from '../engine/types';
import { describeEffects, signed } from './format';
import { getOptionIcon } from './icons';
import { inkFor } from './wheel/color';

const STAGES = ['', 'Met', 'Escalating', 'Concluded'];

export function QuestPanel({ story, hero, config }: { story: StoryState; hero: Character; config: GameConfig }) {
  const flags = Object.entries(story.flags).filter(([key, n]) => n > 0 && config.storyFlags?.[key]);
  const { rival } = story;
  return (
    <section aria-label="The quest" className="mt-5 grid gap-3 rounded-md border-2 border-gilt/60 bg-slab px-4 py-3">
      <div>
        <p className="flex flex-wrap items-baseline justify-between gap-x-4">
          <span className="font-display text-2xl text-candle">{story.title}</span>
          <span className="text-sm tabular-nums text-ash">
            Encounter {Math.min(story.beats, story.length)} of {story.length}, then the finale
          </span>
        </p>
        <p className="text-sm text-vellum">{story.objective}</p>
      </div>

      <div>
        <p className="flex items-baseline justify-between text-sm">
          <span className="text-ash">Threat</span>
          <span className="tabular-nums text-vellum">
            {story.threat} / {STORY_THREAT_MAX}
          </span>
        </p>
        <span className="mt-1 block h-1.5 overflow-hidden rounded-r-[3px] bg-cp-stats-track" aria-hidden="true">
          <span className="block h-full bg-ember transition-[width] duration-700" style={{ width: `${(story.threat / STORY_THREAT_MAX) * 100}%` }} />
        </span>
        <p className="mt-1 text-xs text-ash">Higher threat: more ambushes, harder fights, darker events, and a finale likelier to be a siege or an escape.</p>
      </div>

      {flags.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="What the quest has gathered">
          {flags.map(([key, n]) => (
            <li key={key} className="rounded-sm border border-lead bg-slab-raised px-2 py-0.5 text-sm text-vellum">
              {config.storyFlags![key]}
              {n > 1 && <span className="ml-1 tabular-nums text-ash">×{n}</span>}
            </li>
          ))}
        </ul>
      )}

      {rival && (
        <div className={`rounded-md border-2 px-3 py-2 ${rival.fate ? 'border-lead' : 'border-ember/60'}`}>
          <p className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span>
              <span className="text-xs font-semibold uppercase tracking-wider text-ember">Rival · {STAGES[rival.stage]}</span>{' '}
              <span className="font-display text-xl text-candle">
                {rival.name}, {rival.title}
              </span>
            </span>
            <span className="text-sm tabular-nums text-vellum">
              {rival.power} CP <span className="text-ash">vs your {calculatePowerRating(hero)}</span>
              {rival.allies > 0 && <span className="text-ash"> · {rival.allies} allies</span>}
            </span>
          </p>
          <p className="text-sm text-vellum">
            <span className="text-ash">Wants:</span> {rival.goal}. <span className="text-ash">Driven by:</span> {rival.motivation.toLowerCase()}.
          </p>
          {rival.fate && <p className="text-sm font-semibold text-gilt-bright">{rival.fate}.</p>}
          <p className="mt-1 text-xs text-ash">They remember:</p>
          <ul className="grid gap-0.5 text-sm text-vellum">
            {rival.memory.map((m, i) => (
              <li key={i}>· {m}</li>
            ))}
          </ul>
        </div>
      )}

      <details>
        <summary className="cursor-pointer text-sm text-ash">The story so far ({story.log.length})</summary>
        <ol className="mt-1 grid gap-0.5 text-sm text-vellum">
          {story.log.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      </details>
    </section>
  );
}

/** The options of a choice wheel, as cards to pick from: what each does, and what it risks. */
export function ChoicePanel({
  slices,
  config,
  chosenIndex,
  disabled,
  onChoose,
}: {
  slices: readonly ResolvedSlice[];
  config: GameConfig;
  chosenIndex: number | null;
  disabled: boolean;
  onChoose: (optionId: string) => void;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2" aria-label="Your choices">
      {slices.map((slice) => {
        const { option } = slice;
        const Icon = getOptionIcon(option.icon);
        const chosen = chosenIndex === slice.index;
        const effects = describeEffects(option, config);
        const then = nextLabel(option, config);
        const color = option.color ?? '#6b7280';
        return (
          <li key={option.id}>
            <button
              type="button"
              disabled={disabled || slice.locked}
              onClick={() => onChoose(option.id)}
              className={`flex h-full w-full flex-col gap-2 rounded-md border-2 bg-slab p-4 text-left transition-colors enabled:hover:bg-slab-raised disabled:cursor-default ${
                chosen ? 'border-gilt' : 'border-lead'
              } ${slice.locked || (chosenIndex !== null && !chosen) ? 'opacity-55' : ''}`}
            >
              <span className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-lead"
                  style={{ background: color, color: inkFor(color).ink }}
                >
                  <Icon size={18} strokeWidth={2.25} />
                </span>
                <span className="font-display text-xl leading-tight text-candle">{option.label}</span>
                {slice.locked && <Lock aria-label="Locked" size={14} className="ml-auto shrink-0 text-ash" />}
              </span>
              {option.description && <span className="text-sm text-vellum">{option.description}</span>}
              {slice.locked && slice.lockReason && <span className="text-sm text-ember">{slice.lockReason}</span>}
              {effects.length > 0 && <span className="text-sm text-moss">{effects.join(' · ')}</span>}
              <span className="text-xs text-ash">{then}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** "Then: spin The Theft", or what happens if nothing else does. */
function nextLabel(option: WheelOption, config: GameConfig): string {
  const next = option.nextStepId;
  if (next === null) return option.setStatus ? 'Then: the story ends' : 'Then: the quest ends';
  if (typeof next !== 'string') return 'Certain. Then the quest goes on';
  const step = findStep(config, next);
  return step ? `Then a wheel decides: ${step.title}` : 'Then: onward';
}

/** The quest, told when it ends: what happened, the rival, and what changed in the world. */
export function QuestTale({ quest }: { quest: QuestRecord }) {
  return (
    <section aria-label="The tale" className="mt-4 rounded-md border-2 border-gilt/60 bg-slab p-5">
      <p className="text-sm text-ash">The tale of</p>
      <h3 className="font-display text-3xl leading-tight text-gilt-bright">{quest.title}</h3>
      <ol className="mt-3 grid gap-1 text-vellum">
        {quest.log.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ol>
      {quest.rival && (
        <p className="mt-3 text-sm text-vellum">
          <span className="text-ember">The rival:</span> {quest.rival.name}, {quest.rival.title}. {quest.rival.fate}.
        </p>
      )}
      {quest.worldThreat !== 0 && (
        <p className={`mt-1 text-sm font-semibold ${quest.worldThreat > 0 ? 'text-ember' : 'text-moss'}`}>
          The world’s threat {quest.worldThreat > 0 ? 'rose' : 'fell'} by {signed(quest.worldThreat).replace(/^[+−]/, '')} because of this quest.
        </p>
      )}
    </section>
  );
}
