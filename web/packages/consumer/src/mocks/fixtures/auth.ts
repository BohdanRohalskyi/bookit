import type { User, AuthResponse } from '@bookit/shared/api'

export function buildUser(overrides?: Partial<User>): User {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    name: 'Test User',
    email_verified: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

export function buildTokens() {
  return {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 1800,
  }
}

export function buildAuthResponse(overrides?: Partial<AuthResponse>): AuthResponse {
  return {
    user: buildUser(),
    tokens: buildTokens(),
    ...overrides,
  }
}
