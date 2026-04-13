import createClient, { type Middleware } from 'openapi-fetch'
import type { paths, components } from './types.gen'
import { useAuthStore } from '../stores/auth'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// A single shared Promise deduplicates concurrent refresh attempts.
// If two requests fail with 401 simultaneously, both await the same refresh
// rather than each triggering a separate call.
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

    // Proactively refresh if the token is within 30s of expiry.
    // All concurrent requests share the same Promise — only one refresh fires.
    if (accessToken && authStore.isTokenExpired()) {
      if (!refreshPromise) {
        refreshPromise = refreshTokens().finally(() => { refreshPromise = null })
      }
      await refreshPromise
    }

    const currentToken = useAuthStore.getState().getAccessToken()
    if (currentToken) {
      request.headers.set('Authorization', `Bearer ${currentToken}`)
    }

    return request
  },

  async onResponse({ response, request }) {
    if (response.status !== 401) return response

    // Deduplicate concurrent 401-triggered refresh attempts.
    if (!refreshPromise) {
      refreshPromise = refreshTokens().finally(() => { refreshPromise = null })
    }
    const refreshed = await refreshPromise

    if (refreshed) {
      // Retry the original request with the new access token.
      const token = useAuthStore.getState().getAccessToken()
      request.headers.set('Authorization', `Bearer ${token}`)
      return fetch(request)
    }

    window.location.href = '/login'
    return response
  },
}

export const api = createClient<paths>({
  baseUrl: API_URL,
  credentials: 'include',
  // Use a lazy wrapper so tests can stub globalThis.fetch after module load.
  // In production this is a no-op — globalThis.fetch is always the real fetch.
  fetch: (...args) => globalThis.fetch(...args),
})

api.use(authMiddleware)

// Re-export commonly used types
export type User = components['schemas']['User']
export type AuthResponse = components['schemas']['AuthResponse']
export type RegisterRequest = components['schemas']['RegisterRequest']
export type LoginRequest = components['schemas']['LoginRequest']
export type Error = components['schemas']['Error']

// The Go API returns RFC 7807 error bodies — { type, title, status, detail }.
// The generated spec Error schema doesn't reflect this yet; ApiError is the
// authoritative client-side type until the spec is updated.
export type ApiError = {
  type?: string
  title?: string
  status?: number
  detail?: string
}
