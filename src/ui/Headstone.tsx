/**
 * Headstones: the graveyard as stones rather than a list, and the full epitaph a stone
 * carries (ui/legend.ts writes the words). A martyr's stone is a shrine, lit gold.
 */
import { Skull, Sunrise } from 'lucide-react';
import type { Character, GameConfig } from '../engine/types';
import { epitaph } from './legend';

/** An arched top: an ellipse across the full width, square-ish at the foot. */
const ARCH = { borderRadius: '50% 50% 6px 6px / 2.2rem 2.2rem 6px 6px' };

/** The whole epitaph, as carved: for a fallen hero's card and the moment they fall. */
export function Epitaph({ character, config }: { character: Character; config: GameConfig }) {
  const e = epitaph(character, config);
  const martyr = character.tags.includes('martyr');
  return (
    <figure
      className={`mx-auto max-w-sm border-2 bg-slab-raised px-6 pb-5 pt-7 text-center ${martyr ? 'border-gilt/70' : 'border-lead'}`}
      style={ARCH}
    >
      {martyr ? (
        <Sunrise aria-hidden="true" size={20} className="mx-auto text-gilt-bright" />
      ) : (
        <Skull aria-hidden="true" size={18} className="mx-auto text-ash" />
      )}
      <p className="mt-2 font-display text-2xl leading-tight text-candle">{e.name}</p>
      {e.title && <p className="font-display text-lg leading-tight text-gilt-bright">{e.title}</p>}
      <p className="mt-1 text-sm text-ash">{e.who}</p>
      {e.end && <p className="mt-2 text-vellum">{e.end}.</p>}
      <p className="text-sm text-vellum">{e.remembered}.</p>
      <figcaption className="mt-3 border-t border-lead pt-2 text-sm italic text-ash">{e.closing}</figcaption>
    </figure>
  );
}

interface GraveyardProps {
  graves: readonly Character[];
  config: GameConfig;
  inspectedId: string | null;
  onInspect: (characterId: string) => void;
}

/** The graveyard, newest first: a stone per soul, each opening their card. */
export function Graveyard({ graves, config, inspectedId, onInspect }: GraveyardProps) {
  return (
    <div className="border-t-2 border-lead px-5 py-4">
      <h3 className="font-caps text-base tracking-wide text-ash">Graveyard</h3>
      <ul className="mt-3 grid grid-cols-2 gap-3">
        {[...graves].reverse().map((c) => {
          const e = epitaph(c, config);
          const martyr = c.tags.includes('martyr');
          const active = inspectedId === c.id;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onInspect(c.id)}
                aria-pressed={active}
                title={[e.end, e.closing].filter(Boolean).join('. ')}
                className={`flex h-full w-full flex-col items-center border-2 px-2 pb-2 pt-4 text-center transition-colors hover:bg-slab-hover ${
                  active ? 'bg-slab-hover' : 'bg-slab-raised'
                } ${martyr ? 'border-gilt/60' : 'border-lead'}`}
                style={ARCH}
              >
                {martyr ? (
                  <Sunrise aria-hidden="true" size={14} className="text-gilt-bright" />
                ) : (
                  <Skull aria-hidden="true" size={13} className="text-ash" />
                )}
                <span className="mt-1 block w-full truncate font-display text-lg leading-tight text-candle">{c.name}</span>
                <span className="block w-full truncate text-xs text-ash">{e.who}</span>
                {e.end && <span className="mt-1 line-clamp-2 text-xs text-vellum">{e.end}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
