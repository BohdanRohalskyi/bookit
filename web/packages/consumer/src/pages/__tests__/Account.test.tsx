import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Mock } from 'vitest'
import { Account } from '../Account'
import { api } from '@bookit/shared/api'
import { useAuthStore } from '@bookit/shared/stores'
import { renderWithProviders } from '../../test/utils'

let mockNavigate = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('@bookit/shared/api', () => ({
  api: { POST: vi.fn(), GET: vi.fn() },
  API_URL: 'http://localhost:8080',
}))

const post = () => api.POST as unknown as Mock

function buildUser(overrides = {}) {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    name: 'Test User',
    email_verified: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function buildTokens() {
  return { access_token: 'access-token', refresh_token: 'refresh-token', expires_in: 1800 }
}

beforeEach(() => {
  mockNavigate = vi.fn()
  post().mockReset()
  useAuthStore.getState().setAuth(buildUser(), buildTokens())
})

afterEach(() => {
  useAuthStore.getState().logout()
  localStorage.clear()
})

// --- rendering ---

describe('Account rendering', () => {
  test('renders user name and email', () => {
    renderWithProviders(<Account />)

    expect(screen.getAllByText('Test User').length).toBeGreaterThan(0)
    expect(screen.getAllByText('test@example.com').length).toBeGreaterThan(0)
  })

  test('shows "Email verified" badge for verified user', () => {
    renderWithProviders(<Account />)

    expect(screen.getByText('Email verified')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /resend verification/i })).not.toBeInTheDocument()
  })

  test('shows resend verification button for unverified user', () => {
    useAuthStore.getState().setAuth(buildUser({ email_verified: false }), buildTokens())
    renderWithProviders(<Account />)

    expect(screen.getByText('Email not verified')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resend verification/i })).toBeInTheDocument()
  })
})

// --- actions ---

describe('Account actions', () => {
  test('resend verification calls API and shows success message', async () => {
    const user = userEvent.setup({ delay: null })
    post().mockResolvedValue({ data: undefined, error: undefined })
    useAuthStore.getState().setAuth(buildUser({ email_verified: false }), buildTokens())
    renderWithProviders(<Account />)

    await user.click(screen.getByRole('button', { name: /resend verification/i }))

    await waitFor(() => {
      expect(screen.getByText('Verification email sent!')).toBeInTheDocument()
    })
    expect(post()).toHaveBeenCalledWith(
      '/api/v1/auth/resend-verification',
      expect.any(Object),
    )
  })

  test('logout clears auth store and navigates to /', async () => {
    const user = userEvent.setup({ delay: null })
    renderWithProviders(<Account />)

    await user.click(screen.getByRole('button', { name: /logout/i }))

    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })
})
