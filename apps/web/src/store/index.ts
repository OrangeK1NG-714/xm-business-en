import { create } from 'zustand'

interface AppState {
  loading: boolean
  title: string
  setLoading: (loading: boolean) => void
  setTitle: (title: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  loading: false,
  title: 'XM Business',
  setLoading: (loading) => set({ loading }),
  setTitle: (title) => set({ title }),
}))
