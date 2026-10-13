/**
 * How a ladder bump is shown: the effects that play when banked bonuses move a stat roll
 * after the wheel lands. A wheel names its effect (`WheelStep.upgradeEffect`); anything
 * unknown falls back to the hammer.
 *
 * To add one: write a component that takes `UpgradeEffectProps` and plays `hits` blows,
 * each landing `impactAt` of the way through its `stageMs` (that is when the wheel jolts
 * to the next slice), then register it here under a name and use that name in config.
 */
import type { ComponentType } from 'react';
import { HammerUpgrade } from './HammerUpgrade';

export interface UpgradeEffectProps {
  /** The wheel's size in pixels. The effect covers it, centred. */
  size: number;
  /** Blows to play: one per position moved, plus one more for a break-through. */
  hits: number;
  /** The last blow breaks past the top of the ladder (into Ascension). */
  overflow: boolean;
  /** 1: moving up. −1: knocked down. */
  direction: 1 | -1;
  /** Length of one blow, in ms. */
  stageMs: number;
  /** When in each blow the impact lands, 0–1. */
  impactAt: number;
}

export interface UpgradeEffect {
  Component: ComponentType<UpgradeEffectProps>;
  /** One blow, in ms; and with reduced motion. */
  stageMs: number;
  reducedStageMs: number;
  /** When in each blow the wheel jolts to the next slice, 0–1. */
  impactAt: number;
  /** A pause after the last blow before the result is revealed, in ms. */
  settleMs: number;
}

export const UPGRADE_EFFECTS: Record<string, UpgradeEffect> = {
  hammer: { Component: HammerUpgrade, stageMs: 900, reducedStageMs: 350, impactAt: 0.45, settleMs: 450 },
};

/** The named effect, or the hammer. */
export function upgradeEffect(name: string | undefined): UpgradeEffect {
  return (name !== undefined ? UPGRADE_EFFECTS[name] : undefined) ?? UPGRADE_EFFECTS.hammer!;
}
