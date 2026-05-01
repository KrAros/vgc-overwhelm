import { create } from 'zustand'

const emptyPokemon = () => ({
  key: null,
  moves: [null, null, null, null],
  sps: [0, 0, 0, 0, 0, 0],
  nature: null,
  ability: null,
  item: null,
})

const useCalcStore = create((set) => ({
  level: 50,
  trickRoom: false,
  doubleTarget: false,
  weather: null,
  terrain: null,
  helpingHand: { t1: false, t2: false },
  auroraVeil:  { t1: false, t2: false },
  lightScreen: { t1: false, t2: false },
  reflect:     { t1: false, t2: false },
  protect:     { t1: false, t2: false },
  crit:        { t1: false, t2: false },

  team1: Array(6).fill(null).map(emptyPokemon),
  team2: Array(6).fill(null).map(emptyPokemon),

  setLevel: (level) => set({ level }),
  toggleTrickRoom: () => set((s) => ({ trickRoom: !s.trickRoom })),
  toggleDoubleTarget: () => set((s) => ({ doubleTarget: !s.doubleTarget })),
  setWeather: (w) => set((s) => ({ weather: s.weather === w ? null : w })),
  setTerrain: (t) => set((s) => ({ terrain: s.terrain === t ? null : t })),
  toggleModifier: (mod, side) =>
    set((s) => ({ [mod]: { ...s[mod], [side]: !s[mod][side] } })),

  setPokemon: (team, index, key) =>
    set((s) => {
      const t = [...s[team]]
      t[index] = { ...emptyPokemon(), key }
      return { [team]: t }
    }),

  setMove: (team, pokeIndex, moveIndex, move) =>
    set((s) => {
      const t = [...s[team]]
      const moves = [...t[pokeIndex].moves]
      moves[moveIndex] = move
      t[pokeIndex] = { ...t[pokeIndex], moves }
      return { [team]: t }
    }),

  setNature: (team, index, nature) =>
  set((s) => {
    const t = [...s[team]]
    t[index] = { ...t[index], nature }
    return { [team]: t }
  }),

  setSPs: (team, index, sps) =>
  set((s) => {
    const t = [...s[team]]
    t[index] = { ...t[index], sps }
    return { [team]: t }
  }),
}))

export default useCalcStore