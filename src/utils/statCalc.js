const NATURE_MODIFIERS = {
  hardy:[0,0],bashful:[0,0],docile:[0,0],serious:[0,0],quirky:[0,0],
  lonely:[1,2],brave:[1,5],adamant:[1,3],naughty:[1,4],
  bold:[2,1],relaxed:[2,5],impish:[2,3],lax:[2,4],
  timid:[5,1],hasty:[5,2],jolly:[5,3],naive:[5,4],
  modest:[3,1],mild:[3,2],quiet:[3,5],rash:[3,4],
  calm:[4,1],gentle:[4,2],sassy:[4,5],careful:[4,3],
}

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