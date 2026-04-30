import { create } from 'zustand'

const useCalcStore = create((set) => ({
  level: 50,
  trickRoom: false,
  doubleTarget: false,

  weather: null,
  terrain: null,

  helpingHand: { t1: false, t2: false },
  auroraVeil: { t1: false, t2: false },
  lightScreen: { t1: false, t2: false },
  reflect: { t1: false, t2: false },
  protect: { t1: false, t2: false },
  crit: { t1: false, t2: false },

  team1: Array(6).fill(null),
  team2: Array(6).fill(null),

  setLevel: (level) => set({ level }),
  toggleTrickRoom: () => set((s) => ({ trickRoom: !s.trickRoom })),
  toggleDoubleTarget: () => set((s) => ({ doubleTarget: !s.doubleTarget })),
  setWeather: (w) => set((s) => ({ weather: s.weather === w ? null : w })),
  setTerrain: (t) => set((s) => ({ terrain: s.terrain === t ? null : t })),

  toggleModifier: (mod, side) =>
    set((s) => ({
      [mod]: { ...s[mod], [side]: !s[mod][side] },
    })),
}))

export default useCalcStore