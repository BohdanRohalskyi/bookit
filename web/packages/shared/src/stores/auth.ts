import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { z } from 'zod'
import type { User } from '../api/client'

const TokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number(),
})

const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  email_verified: z.boolean(),
})

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
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // Validate persisted data — corrupted or tampered storage resets to logged-out.
        const tokensResult = TokensSchema.safeParse(state.tokens)
        const userResult = UserSchema.safeParse(state.user)
        if (!tokensResult.success || !userResult.success) {
          console.warn('[auth] Rehydrated state failed validation — resetting session.', {
            tokensError: tokensResult.success ? null : tokensResult.error.flatten(),
            userError: userResult.success ? null : userResult.error.flatten(),
          })
          state.logout()
        }
      },
    }
  )
)
