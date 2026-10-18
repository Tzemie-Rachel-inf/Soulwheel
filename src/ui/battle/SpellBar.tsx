/**
 * Choose mode: the hero's spells as cards under the battle, one per spell, each with its charges
 * left. A cast is a sure thing (a hit, a heal, a ward) and takes no spin; then the round's wheel
 * is spun as usual. Or just spin.
 */
import { motion } from 'framer-motion';
import { BATTLE_POOL, FOE_HP_PER_UNIT, battleSpells, spellCharges, type BattleState } from '../../engine/battle';
import { maxHp } from '../../engine/hp';
import { MATCHUP_MULT, matchupOf } from '../../engine/matchup';
import type { Character, GameConfig } from '../../engine/types';
import { getOptionIcon } from '../icons';

const KIND_ICON = { hit: 'Zap', heal: 'HeartPulse', drain: 'Droplets', ward: 'Shield' } as const;

export function SpellBar({ config, hero, battle, disabled, onCast }: { config: GameConfig; hero: Character; battle: BattleState; disabled: boolean; onCast: (spellId: string) => void }) {
  const battleConfig = config.battle;
  if (!battleConfig) return null;
  const spells = battleSpells(hero, battleConfig);
  if (spells.length === 0) return null;
  const charges = spellCharges(hero);
  const boost = 1 + ((hero.rules?.spellMultiplier ?? 1) - 1) * 0.5;
  const foeScale = FOE_HP_PER_UNIT;
  const heroScale = maxHp(hero) / BATTLE_POOL;
  return (
    <div className="mt-4">
      <p className="text-sm text-ash">Cast before the spin: a sure thing, and no wheel turns. Or just spin.</p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {spells.map(({ id, name, spell }) => {
          const left = charges - (battle.spent[id] ?? 0);
          const match = spell.damage ? matchupOf(spell.damage, battle.foe) : 'neutral';
          const power = spell.power * boost;
          const effect =
            spell.kind === 'ward'
              ? `Ward: ${battle.foe.name}'s side of the next wheel is halved`
              : spell.kind === 'heal'
                ? `Heals ${Math.round(power * heroScale)}`
                : `${Math.round(Math.max(1, Math.round(power * MATCHUP_MULT[match])) * foeScale)} ${spell.damage} damage${spell.kind === 'drain' ? ', healed back' : ''}`;
          const color = (spell.damage && config.gear?.damageColors[spell.damage]) || (spell.kind === 'heal' ? '#7fd0a6' : '#7c5ae0');
          const Icon = getOptionIcon(KIND_ICON[spell.kind]);
          const spent = left <= 0;
          return (
            <li key={id}>
              <motion.button
                type="button"
                disabled={disabled || spent}
                onClick={() => onCast(id)}
                whileHover={disabled || spent ? undefined : { y: -2 }}
                whileTap={disabled || spent ? undefined : { scale: 0.97 }}
                className="flex w-full items-start gap-3 border-2 bg-slab-raised px-3 py-2 text-left transition-colors enabled:hover:bg-slab-hover disabled:cursor-not-allowed disabled:opacity-40"
                style={{ borderColor: spent ? 'var(--color-lead)' : color }}
              >
                <Icon aria-hidden="true" size={22} style={{ color }} className="mt-0.5 shrink-0" />
                <span className="min-w-0">
                  <span className="flex items-baseline gap-2">
                    <span className="font-display text-lg text-candle">{name}</span>
                    <span className="text-xs tabular-nums text-ash">
                      {left}/{charges}
                    </span>
                  </span>
                  <span className="block text-sm text-vellum">{effect}</span>
                  {match !== 'neutral' && (
                    <span className="text-xs font-bold tracking-wider" style={{ color: match === 'weak' ? '#ffd76a' : '#b8a68a' }}>
                      {match === 'weak' ? 'WEAK! ×1.3' : match === 'resisted' ? 'RESISTED ×0.75' : 'IMMUNE ×0.5'}
                    </span>
                  )}
                </span>
              </motion.button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
