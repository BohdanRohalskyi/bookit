import { api, API_URL } from '../client'
import { useAuthStore } from '../../stores/auth'
import type { User } from '../client'

// --- fixtures ---

function buildUser(): User {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    name: 'Test User',
    email_verified: true,
    created_at: '2026-01-01T00:00:00Z',
  }
}

function buildTokens() {
  return {
    access_token: 'new-access-token',
    refresh_token: 'new-refresh-token',
    expires_in: 1800,
  }
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// --- setup ---

// Replace window.location with a plain object so href assignments
// don't trigger jsdom navigation.
beforeAll(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { href: '' },
  })
})

beforeEach(() => {
  useAuthStore.getState().logout()
  // Reset the mocked href before each test
  ;(window.location as { href: string }).href = ''
})

// Stub globalThis.fetch with a vi.fn() so we control all HTTP responses
// without relying on MSW intercepting jsdom's internal fetch.
// vi.unstubAllGlobals() in afterEach restores the original.
afterEach(() => {
  vi.unstubAllGlobals()
})

// --- token refresh on 401 ---

describe('token refresh on 401', () => {
  test('successful refresh retries the original request', async () => {
    useAuthStore.getState().setAuth(buildUser(), {
      access_token: 'valid-token',
      refresh_token: 'valid-refresh',
      expires_in: 1800,
    })

    let callCount = 0

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: RequestInfo) => {
      const url = typeof input === 'string' ? input : (input as Request).url

      if (url.includes('/api/v1/auth/refresh')) {
        return jsonResponse({ user: buildUser(), tokens: buildTokens() })
      }

      callCount++
      // First call → 401; second call (retry after refresh) → 200
      if (callCount === 1) return new Response(null, { status: 401 })
      return jsonResponse({ status: 'ok' })
    }))

    const { error } = await api.GET('/api/v1/health')

    expect(error).toBeUndefined()
    expect(callCount).toBe(2) // original + one retry
  })

  test('failed refresh (no refresh token) redirects to /login', async () => {
    // No tokens in the store — refreshTokens() returns false immediately

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })))

    await api.GET('/api/v1/health')

    expect(window.location.href).toBe('/login')
  })

  test('failed refresh (server rejects token) redirects to /login', async () => {
    useAuthStore.getState().setAuth(buildUser(), {
      access_token: 'valid-token',
      refresh_token: 'invalid-refresh',
      expires_in: 1800,
    })

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: RequestInfo) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      if (url.includes('/api/v1/auth/refresh')) {
        return new Response(null, { status: 401 })
      }
      return new Response(null, { status: 401 })
    }))

    await api.GET('/api/v1/health')

    expect(window.location.href).toBe('/login')
  })
})

// --- concurrent 401 deduplication ---

describe('concurrent 401 deduplication', () => {
  test('two simultaneous 401s trigger only one refresh call', async () => {
    useAuthStore.getState().setAuth(buildUser(), {
      access_token: 'valid-token',
      refresh_token: 'valid-refresh',
      expires_in: 1800,
    })

    let refreshCallCount = 0
    let healthCallCount = 0

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: RequestInfo) => {
      const url = typeof input === 'string' ? input : (input as Request).url

      if (url.includes('/api/v1/auth/refresh')) {
        refreshCallCount++
        return jsonResponse({ user: buildUser(), tokens: buildTokens() })
      }

      healthCallCount++
      // First two health calls return 401 (originals); subsequent calls succeed (retries)
      if (healthCallCount <= 2) return new Response(null, { status: 401 })
      return jsonResponse({ status: 'ok' })
    }))

    await Promise.all([
      api.GET('/api/v1/health'),
      api.GET('/api/v1/health'),
    ])

    expect(refreshCallCount).toBe(1)
    // Both originals + both retries
    expect(healthCallCount).toBe(4)
  })
})

// Suppress the expected API_URL log for test output clarity
beforeAll(() => {
  void API_URL // reference to avoid unused import error
})
