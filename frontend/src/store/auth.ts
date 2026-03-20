import { create } from 'zustand'

interface User {
  id: string
  email: string
  name: string
}

interface AuthStore {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: localStorage.getItem('ttrpg_token'),
  setAuth: (user, token) => {
    localStorage.setItem('ttrpg_token', token)
    set({ user, token })
  },
  logout: () => {
    localStorage.removeItem('ttrpg_token')
    set({ user: null, token: null })
  },
}))
