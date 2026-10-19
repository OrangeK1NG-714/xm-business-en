import { create } from 'zustand'

export type AuthMode = 'login' | 'register'

interface AuthOptions {
  reason?: string
  onSuccess?: () => void
}

interface AuthState {
  open: boolean
  mode: AuthMode
  reason?: string
  onSuccess?: () => void
  show: (mode?: AuthMode, options?: AuthOptions) => void
  hide: () => void
  setMode: (mode: AuthMode) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  open: false,
  mode: 'login',
  show: (mode = 'login', options = {}) => set({ open: true, mode, reason: options.reason, onSuccess: options.onSuccess }),
  hide: () => set({ open: false, reason: undefined, onSuccess: undefined }),
  setMode: (mode) => set({ mode }),
}))
