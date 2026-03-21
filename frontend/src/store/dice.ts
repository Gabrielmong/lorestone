import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface DiceSet {
  id: string
  name: string
  /** Named colorset (e.g. 'white') OR empty string when using customColor */
  colorset: string
  /** Custom background hex color — used when colorset is '' */
  customBg: string
  /** Custom foreground (pip/number) hex color */
  customFg: string
  material: 'none' | 'metal' | 'wood' | 'glass' | 'plastic'
  surface: 'green-felt' | 'blue-felt' | 'red-felt' | 'wood_tray' | 'marble'
  /** Texture overlay from /textures/*.webp, empty string for none */
  texture: string
  isPreset?: boolean
}

export interface RollResult {
  id: string
  label: string
  notation: string
  dice: { sides: number; value: number }[]
  total: number
  modifier: number
  timestamp: number
  critical?: 'success' | 'failure'
  advantage?: 'advantage' | 'disadvantage'
  /** The two d20 values when rolling with advantage/disadvantage */
  d20Pair?: [number, number]
}

export interface PendingRoll {
  notation: string
  label: string
  modifier: number
  /** If true, DiceRoller will fire immediately without waiting for user to click Roll */
  autoFire?: boolean
}

export const PRESETS: DiceSet[] = [
  {
    id: 'classic',
    name: 'Classic',
    colorset: 'white',
    customBg: '#ffffff',
    customFg: '#000000',
    material: 'glass',
    surface: 'green-felt',
    texture: '',
    isPreset: true,
  },
  {
    id: 'dragon',
    name: 'Dragon',
    colorset: '',
    customBg: '#8b1a1a',
    customFg: '#f5e6c8',
    material: 'metal',
    surface: 'red-felt',
    texture: 'fire',
    isPreset: true,
  },
  {
    id: 'arcane',
    name: 'Arcane',
    colorset: '',
    customBg: '#0d1b4b',
    customFg: '#a8d0ff',
    material: 'glass',
    surface: 'blue-felt',
    texture: 'stars',
    isPreset: true,
  },
]

export const MATERIAL_OPTIONS: DiceSet['material'][] = ['none', 'plastic', 'wood', 'glass', 'metal']
export const SURFACE_OPTIONS: { value: DiceSet['surface']; label: string }[] = [
  { value: 'green-felt', label: 'Green Felt' },
  { value: 'blue-felt', label: 'Blue Felt' },
  { value: 'red-felt', label: 'Red Felt' },
  { value: 'wood_tray', label: 'Wood Tray' },
  { value: 'marble', label: 'Marble' },
]
export const TEXTURE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'dragon', label: 'Dragon' },
  { value: 'fire', label: 'Fire' },
  { value: 'stars', label: 'Stars' },
  { value: 'ice', label: 'Ice' },
  { value: 'marble', label: 'Marble' },
  { value: 'metal', label: 'Metal' },
  { value: 'wood', label: 'Wood' },
  { value: 'stone', label: 'Stone' },
  { value: 'water', label: 'Water' },
  { value: 'skulls', label: 'Skulls' },
  { value: 'glitter', label: 'Glitter' },
]

interface DiceStore {
  isOpen: boolean
  activeDiceSetId: string
  customSets: DiceSet[]
  rollHistory: RollResult[]
  pendingRoll: PendingRoll | null

  open: () => void
  close: () => void
  setActiveDiceSet: (id: string) => void
  addCustomSet: (set: DiceSet) => void
  updateCustomSet: (set: DiceSet) => void
  deleteCustomSet: (id: string) => void
  addRollResult: (result: RollResult) => void
  clearHistory: () => void
  triggerRoll: (notation: string, label: string, modifier?: number) => void
  /** Like triggerRoll but fires immediately and calls onComplete(total) then closes */
  triggerAutoRoll: (notation: string, label: string, modifier: number, onComplete: (total: number) => void) => void
  onRollCompleteCallback: ((total: number) => void) | null
  setOnRollCompleteCallback: (cb: ((total: number) => void) | null) => void
  clearPendingRoll: () => void
  getAllSets: () => DiceSet[]
  getActiveSet: () => DiceSet
}

export const useDiceStore = create<DiceStore>()(
  persist(
    (set, get) => ({
      isOpen: false,
      activeDiceSetId: 'classic',
      customSets: [],
      rollHistory: [],
      pendingRoll: null,

      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      setActiveDiceSet: (id) => set({ activeDiceSetId: id }),
      addCustomSet: (s) => set((state) => ({ customSets: [...state.customSets, s] })),
      updateCustomSet: (s) =>
        set((state) => ({ customSets: state.customSets.map((c) => (c.id === s.id ? s : c)) })),
      deleteCustomSet: (id) =>
        set((state) => ({ customSets: state.customSets.filter((c) => c.id !== id) })),
      addRollResult: (result) =>
        set((state) => ({ rollHistory: [result, ...state.rollHistory].slice(0, 30) })),
      clearHistory: () => set({ rollHistory: [] }),
      triggerRoll: (notation, label, modifier = 0) =>
        set({ isOpen: true, pendingRoll: { notation, label, modifier } }),
      triggerAutoRoll: (notation, label, modifier, onComplete) =>
        set({ isOpen: true, onRollCompleteCallback: onComplete, pendingRoll: { notation, label, modifier, autoFire: true } }),
      onRollCompleteCallback: null,
      setOnRollCompleteCallback: (cb) => set({ onRollCompleteCallback: cb }),
      clearPendingRoll: () => set({ pendingRoll: null }),
      getAllSets: () => [...PRESETS, ...get().customSets],
      getActiveSet: () => {
        const id = get().activeDiceSetId
        return [...PRESETS, ...get().customSets].find((s) => s.id === id) ?? PRESETS[0]
      },
    }),
    {
      name: 'dnd-dice-store',
      partialize: (state) => ({
        activeDiceSetId: state.activeDiceSetId,
        customSets: state.customSets,
        rollHistory: state.rollHistory,
      }),
    }
  )
)
