import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Token, WebResultUser } from '@en/common/user'

interface UserState {
  user: WebResultUser | null
  sessionVersion: number
  setUser: (user: WebResultUser) => void
  updateToken: (token: Token) => void
  logout: () => void
}

export function isTokenPair(value: unknown): value is Token {
  if (!value || typeof value !== 'object') return false
  const token = value as Partial<Token>
  return typeof token.accessToken === 'string' && token.accessToken.length > 0
    && typeof token.refreshToken === 'string' && token.refreshToken.length > 0
}

function persistedUser(value: unknown): WebResultUser | null {
  if (!value || typeof value !== 'object' || !('user' in value)) return null
  const user = value.user as Partial<WebResultUser> | null
  if (!user || typeof user.id !== 'string' || typeof user.name !== 'string' || !isTokenPair(user.token)) return null
  return user as WebResultUser
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      // 登录 / 退出改变会话版本；刷新 Token 不改变，防止旧请求覆盖新账号。
      sessionVersion: 0,
      setUser: (user) => {
        if (!isTokenPair(user?.token)) throw new Error('登录响应缺少有效凭证，请重试')
        set((state) => ({ user, sessionVersion: state.sessionVersion + 1 }))
      },
      updateToken: (token) => set((state) => ({ user: state.user ? { ...state.user, token } : null })),
      logout: () => set((state) => ({ user: null, sessionVersion: state.sessionVersion + 1 })),
    }),
    {
      name: 'english-lab-profile',
      version: 1,
      partialize: (state) => ({ user: state.user }),
      migrate: (stored) => ({ user: persistedUser(stored) }),
      merge: (stored, current) => ({ ...current, user: persistedUser(stored) }),
    },
  ),
)
