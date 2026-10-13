/** Every feat: earned ones lit with who and when, the rest dim with what they ask, and progress where it counts. */
import { Lock } from 'lucide-react';
import type { GameConfig, World } from '../engine/types';
import { FEATS, featContext } from '../state/achievements';
import { useProfile } from '../state/profile';
import { getOptionIcon } from './icons';

export function FeatsPanel({ world, config }: { world: World; config: GameConfig }) {
  const profile = useProfile();
  const ctx = featContext(world, config, profile);
  const earned = FEATS.filter((f) => profile.achievements[f.id]).length;

  return (
    <div className="mt-6">
      <p className="text-vellum">
        <span className="font-semibold text-candle">
          {earned} of {FEATS.length}
        </span>{' '}
        feats earned. Feats outlive any one world: resetting it keeps them.
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {FEATS.map((feat) => {
          const unlock = profile.achievements[feat.id];
          const Icon = unlock ? getOptionIcon(feat.icon) : Lock;
          const progress = !unlock && feat.progress ? feat.progress(ctx) : null;
          return (
            <li
              key={feat.id}
              className={`flex gap-3 rounded-md border-2 px-3 py-2.5 ${unlock ? 'border-gilt/60 bg-slab' : 'border-lead bg-slab/60'}`}
            >
              <Icon aria-hidden="true" size={20} className={`mt-0.5 shrink-0 ${unlock ? 'text-gilt-bright' : 'text-ash/60'}`} />
              <div className="min-w-0 flex-1">
                <p className={`font-semibold ${unlock ? 'text-candle' : 'text-ash'}`}>{feat.name}</p>
                <p className={`text-sm ${unlock ? 'text-vellum' : 'text-ash'}`}>{feat.description}</p>
                {unlock && (
                  <p className="text-xs text-ash">
                    {unlock.by ? `${unlock.by}, ` : ''}
                    {new Date(unlock.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
                {progress && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div
                      role="progressbar"
                      aria-label={`${feat.name} progress`}
                      aria-valuemin={0}
                      aria-valuemax={progress[1]}
                      aria-valuenow={progress[0]}
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-slab-raised"
                    >
                      <div className="h-full bg-gilt" style={{ width: `${(progress[0] / progress[1]) * 100}%` }} />
                    </div>
                    <span className="text-xs tabular-nums text-ash">
                      {progress[0]}/{progress[1]}
                    </span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
