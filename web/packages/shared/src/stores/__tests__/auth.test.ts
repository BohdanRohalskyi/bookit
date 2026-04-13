import { useAuthStore } from '../auth'
import type { User } from '../../api/client'

// --- fixtures ---

function buildUser(overrides?: Partial<User>): User {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    name: 'Test User',
    email_verified: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function buildTokens(overrides?: { access_token?: string; refresh_token?: string; expires_in?: number }) {
  return {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_in: 1800,
    ...overrides,
  }
}

beforeEach(() => {
  useAuthStore.getState().logout()
  localStorage.clear()
})

// --- setAuth ---

describe('setAuth', () => {
  test('stores user and tokens, sets isAuthenticated to true', () => {
    const user = buildUser()
    const tokens = buildTokens()

    useAuthStore.getState().setAuth(user, tokens)

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.user).toEqual(user)
    expect(state.tokens?.accessToken).toBe(tokens.access_token)
    expect(state.tokens?.refreshToken).toBe(tokens.refresh_token)
    expect(state.tokens?.expiresAt).toBeGreaterThan(Date.now())
  })

  test('expiresAt is calculated from expires_in seconds', () => {
    const before = Date.now()
    useAuthStore.getState().setAuth(buildUser(), buildTokens({ expires_in: 1800 }))
    const after = Date.now()

    const { expiresAt } = useAuthStore.getState().tokens!
    expect(expiresAt).toBeGreaterThanOrEqual(before + 1800 * 1000)
    expect(expiresAt).toBeLessThanOrEqual(after + 1800 * 1000)
  })
})

// --- logout ---

describe('logout', () => {
  test('clears user, tokens, and isAuthenticated', () => {
    useAuthStore.getState().setAuth(buildUser(), buildTokens())
    useAuthStore.getState().logout()

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
    expect(state.tokens).toBeNull()
  })
})

// --- getAccessToken / getRefreshToken ---

describe('getAccessToken / getRefreshToken', () => {
  test('returns null when not authenticated', () => {
    expect(useAuthStore.getState().getAccessToken()).toBeNull()
    expect(useAuthStore.getState().getRefreshToken()).toBeNull()
  })

  test('returns stored tokens after setAuth', () => {
    useAuthStore.getState().setAuth(buildUser(), buildTokens({
      access_token: 'my-access',
      refresh_token: 'my-refresh',
    }))

    expect(useAuthStore.getState().getAccessToken()).toBe('my-access')
    expect(useAuthStore.getState().getRefreshToken()).toBe('my-refresh')
  })
})

// --- isTokenExpired ---

describe('isTokenExpired', () => {
  test('returns true when no tokens are set', () => {
    expect(useAuthStore.getState().isTokenExpired()).toBe(true)
  })

  test('returns false when token is freshly issued', () => {
    useAuthStore.getState().setAuth(buildUser(), buildTokens({ expires_in: 1800 }))
    expect(useAuthStore.getState().isTokenExpired()).toBe(false)
  })

  test('returns true when expiresAt is in the past', () => {
    // expires_in: -60 → expiresAt = Date.now() - 60_000 (already expired)
    useAuthStore.getState().setAuth(buildUser(), buildTokens({ expires_in: -60 }))
    expect(useAuthStore.getState().isTokenExpired()).toBe(true)
  })

  test('returns true when within the 30-second early-expiry window', () => {
    // expires_in: 20 → expiresAt = Date.now() + 20_000 (< 30s buffer → treated as expired)
    useAuthStore.getState().setAuth(buildUser(), buildTokens({ expires_in: 20 }))
    expect(useAuthStore.getState().isTokenExpired()).toBe(true)
  })
})

// --- rehydration validation ---

describe('onRehydrateStorage', () => {
  test('corrupted tokens → logout called, warning logged', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    localStorage.setItem('auth-storage', JSON.stringify({
      state: {
        user: buildUser(),
        tokens: { corrupted: true }, // fails TokensSchema
        isAuthenticated: true,
      },
      version: 0,
    }))

    await useAuthStore.persist.rehydrate()

    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().user).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(
      '[auth] Rehydrated state failed validation — resetting session.',
      expect.any(Object),
    )

    warnSpy.mockRestore()
  })

  test('corrupted user → logout called', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    localStorage.setItem('auth-storage', JSON.stringify({
      state: {
        user: { bad: 'data' }, // fails UserSchema
        tokens: {
          accessToken: 'token',
          refreshToken: 'refresh',
          expiresAt: Date.now() + 100_000,
        },
        isAuthenticated: true,
      },
      version: 0,
    }))

    await useAuthStore.persist.rehydrate()

    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(warnSpy).toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  test('valid state passes rehydration without logging out', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const user = buildUser()

    localStorage.setItem('auth-storage', JSON.stringify({
      state: {
        user,
        tokens: {
          accessToken: 'token',
          refreshToken: 'refresh',
          expiresAt: Date.now() + 100_000,
        },
        isAuthenticated: true,
      },
      version: 0,
    }))

    await useAuthStore.persist.rehydrate()

    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().user?.email).toBe(user.email)
    expect(warnSpy).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })
})
