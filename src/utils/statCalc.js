import { NATURE_MODIFIERS } from '../data/natures'
export const STAT_NAMES = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe']

export function calcFinalStat(base, sp, level, nature, statIdx) {
  const ev = Math.min(sp ?? 0, 32) * 8
  const iv = 31
  if (statIdx === 0) {
    return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10
  }
  const mod = nature && NATURE_MODIFIERS[nature]
    ? (NATURE_MODIFIERS[nature][0] === statIdx ? 11
      : NATURE_MODIFIERS[nature][1] === statIdx ? 9 : 10)
    : 10
  const raw = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5
  return Math.floor(raw * mod / 10)
}