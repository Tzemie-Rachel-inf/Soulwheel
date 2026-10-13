/**
 * Watches the world and writes into the profile what outlives it: ancestries rolled, Daily
 * Soul results once a daily's story ends, and feats the moment they are earned. Feats just
 * earned come back as toasts to show.
 */
import { useCallback, useEffect, useState } from 'react';
import { fameStanding } from '../engine/fame';
import type { GameConfig, World } from '../engine/types';
import { howItEnded } from '../ui/legend';
import { featContext, newAncestries, newlyEarned, type Feat } from './achievements';
import { getProfile, updateProfile, type DailyResult } from './profile';

export interface FeatToast {
  key: string;
  feat: Feat;
  by?: string;
}

/** The most toasts shown at once; a flood (an old world loading) is summed up in the last. */
const MAX_TOASTS = 3;

export function useProfileTracker(world: World, config: GameConfig) {
  const [toasts, setToasts] = useState<FeatToast[]>([]);
  const [overflow, setOverflow] = useState(0);

  useEffect(() => {
    const fresh = newAncestries(world, getProfile());
    if (fresh.length > 0) updateProfile((p) => ({ ...p, ancestries: [...p.ancestries, ...fresh] }));

    const recorded = new Set(getProfile().dailies.map((d) => d.characterId));
    const finished: DailyResult[] = [...world.roster, ...world.graveyard, ...world.hallOfFame]
      .filter((c) => c.daily && !recorded.has(c.id) && c.adventures.length > 0 && (c.status !== 'alive' || c.role !== 'hero'))
      .map((c) => ({
        date: c.daily!,
        characterId: c.id,
        name: c.name,
        adventures: c.adventures.length,
        fame: c.fame,
        tier: fameStanding(config.fame.tiers, c.fame).tier.name,
        end: howItEnded(c, config) ?? (c.role === 'npc' ? 'Began a new life' : 'Their story ended'),
      }));
    if (finished.length > 0) updateProfile((p) => ({ ...p, dailies: [...p.dailies, ...finished] }));

    const earned = newlyEarned(featContext(world, config, getProfile()));
    if (earned.length === 0) return;
    const at = Date.now();
    updateProfile((p) => ({
      ...p,
      achievements: { ...p.achievements, ...Object.fromEntries(earned.map(({ feat, by }) => [feat.id, { at, ...(by && { by }) }])) },
    }));
    setToasts((shown) => [...shown, ...earned.map(({ feat, by }) => ({ key: `${feat.id}-${at}`, feat, ...(by && { by }) }))].slice(0, MAX_TOASTS));
    setOverflow((n) => n + Math.max(0, earned.length - MAX_TOASTS));
  }, [world, config]);

  const dismiss = useCallback((key: string) => {
    setToasts((shown) => shown.filter((t) => t.key !== key));
    setOverflow(0);
  }, []);

  return { toasts, overflow, dismiss };
}
