import createClient, { type Middleware } from 'openapi-fetch'
import type { paths, components } from './types.gen'
import { useAuthStore } from '../stores/auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// Track if we're currently refreshing to prevent multiple refresh calls
let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null

async function refreshTokens(): Promise<boolean> {
  const refreshToken = useAuthStore.getState().getRefreshToken()
  if (!refreshToken) return false

  try {
    const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!response.ok) {
      useAuthStore.getState().logout()
      return false
    }

    const data = await response.json()
    useAuthStore.getState().setAuth(data.user, data.tokens)
    return true
  } catch {
    useAuthStore.getState().logout()
    return false
  }
}

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const authStore = useAuthStore.getState()
    const accessToken = authStore.getAccessToken()

    // If we have a token and it's about to expire, refresh it
    if (accessToken && authStore.isTokenExpired()) {
      if (!isRefreshing) {
        isRefreshing = true
        refreshPromise = refreshTokens().finally(() => {
          isRefreshing = false
          refreshPromise = null
        })
      }
      await refreshPromise
    }

    // Add authorization header if we have a token
    const currentToken = useAuthStore.getState().getAccessToken()
    if (currentToken) {
      request.headers.set('Authorization', `Bearer ${currentToken}`)
    }

    return request
  },

  async onResponse({ response }) {
    // If we get a 401, try to refresh and the caller should retry
    if (response.status === 401) {
      const authStore = useAuthStore.getState()
      if (authStore.isAuthenticated) {
        // Token might have been invalidated server-side
        if (!isRefreshing) {
          isRefreshing = true
          refreshPromise = refreshTokens().finally(() => {
            isRefreshing = false
            refreshPromise = null
          })
        }
        const success = await refreshPromise
        if (!success) {
          // Refresh failed, user needs to login again
          window.location.href = '/login'
        }
      }
    }
    return response
  },
}

export const api = createClient<paths>({
  baseUrl: API_URL,
  credentials: 'include',
})

api.use(authMiddleware)

// Re-export commonly used types
export type User = components['schemas']['User']
export type AuthResponse = components['schemas']['AuthResponse']
export type RegisterRequest = components['schemas']['RegisterRequest']
export type LoginRequest = components['schemas']['LoginRequest']
export type Error = components['schemas']['Error']
