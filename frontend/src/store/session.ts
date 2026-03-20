import { create } from 'zustand'

interface CharacterState {
  hpCurrent: number
  conditions: string[]
}

interface SessionStore {
  sessionId: string | null
  campaignId: string | null
  characterStates: Record<string, CharacterState>
  setSession: (sessionId: string, campaignId: string) => void
  setHP: (characterId: string, hp: number) => void
  addCondition: (characterId: string, condition: string) => void
  removeCondition: (characterId: string, condition: string) => void
  initCharacter: (characterId: string, hp: number, conditions: string[]) => void
  clearSession: () => void
}

export const useSessionStore = create<SessionStore>((set) => ({
  sessionId: null,
  campaignId: null,
  characterStates: {},

  setSession: (sessionId, campaignId) => set({ sessionId, campaignId }),

  setHP: (characterId, hp) =>
    set((state) => ({
      characterStates: {
        ...state.characterStates,
        [characterId]: {
          ...(state.characterStates[characterId] ?? { hpCurrent: hp, conditions: [] }),
          hpCurrent: hp,
        },
      },
    })),

  addCondition: (characterId, condition) =>
    set((state) => {
      const current = state.characterStates[characterId] ?? { hpCurrent: 0, conditions: [] }
      if (current.conditions.includes(condition)) return state
      return {
        characterStates: {
          ...state.characterStates,
          [characterId]: { ...current, conditions: [...current.conditions, condition] },
        },
      }
    }),

  removeCondition: (characterId, condition) =>
    set((state) => {
      const current = state.characterStates[characterId] ?? { hpCurrent: 0, conditions: [] }
      return {
        characterStates: {
          ...state.characterStates,
          [characterId]: { ...current, conditions: current.conditions.filter((c) => c !== condition) },
        },
      }
    }),

  initCharacter: (characterId, hp, conditions) =>
    set((state) => ({
      characterStates: {
        ...state.characterStates,
        [characterId]: { hpCurrent: hp, conditions },
      },
    })),

  clearSession: () => set({ sessionId: null, campaignId: null, characterStates: {} }),
}))
