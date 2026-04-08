import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../api/client'

interface Tokens {
  accessToken: string
  refreshToken: string
  expiresAt: number // timestamp when access token expires
}

interface AuthState {
  user: User | null
  tokens: Tokens | null
  isAuthenticated: boolean
  setAuth: (user: User, tokens: { access_token: string; refresh_token: string; expires_in: number }) => void
  setTokens: (tokens: { access_token: string; refresh_token: string; expires_in: number }) => void
  logout: () => void
  getAccessToken: () => string | null
  getRefreshToken: () => string | null
  isTokenExpired: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,

      setAuth: (user, tokens) => set({
        user,
        tokens: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + tokens.expires_in * 1000,
        },
        isAuthenticated: true,
      }),

      setTokens: (tokens) => set({
        tokens: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + tokens.expires_in * 1000,
        },
      }),

      logout: () => set({
        user: null,
        tokens: null,
        isAuthenticated: false,
      }),

      getAccessToken: () => get().tokens?.accessToken ?? null,

      getRefreshToken: () => get().tokens?.refreshToken ?? null,

      isTokenExpired: () => {
        const tokens = get().tokens
        if (!tokens) return true
        // Consider expired 30 seconds before actual expiry
        return Date.now() >= tokens.expiresAt - 30000
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
