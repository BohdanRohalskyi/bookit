import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Mock } from 'vitest'
import { Login } from '../Login'
import { api } from '@bookit/shared/api'
import { renderWithProviders } from '../../test/utils'
import { buildAuthResponse } from '../../mocks/fixtures/auth'
import { useAuthStore } from '@bookit/shared/stores'

// useNavigate: use a `let` so the factory closure reads the current value at
// render time (not at factory execution time — that avoids the TDZ issue).
let mockNavigate = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

// api mock: inline vi.fn() — no external reference needed in the factory.
// `api` imported above gets the mocked version due to vi.mock hoisting.
vi.mock('@bookit/shared/api', () => ({
  api: { POST: vi.fn(), GET: vi.fn() },
  API_URL: 'http://localhost:8080',
}))

const post = () => api.POST as unknown as Mock

beforeEach(() => {
  mockNavigate = vi.fn()
  post().mockReset()
  useAuthStore.getState().logout()
  localStorage.clear()
})

// --- rendering ---

describe('Login rendering', () => {
  test('renders email and password fields', () => {
    renderWithProviders(<Login />)

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
  })
})

// --- validation ---

describe('Login validation', () => {
  test('shows validation errors on empty submit', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Login />)

    await user.click(screen.getByRole('button', { name: /login/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid email address')).toBeInTheDocument()
      expect(screen.getByText('Password is required')).toBeInTheDocument()
    })
    expect(post()).not.toHaveBeenCalled()
  })
})

// --- API interaction ---

describe('Login API', () => {
  test('calls API with correct body on valid submit', async () => {
    const user = userEvent.setup()
    post().mockResolvedValue({ data: buildAuthResponse(), error: undefined })
    renderWithProviders(<Login />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /login/i }))

    await waitFor(() => {
      expect(post()).toHaveBeenCalledWith(
        '/api/v1/auth/login',
        expect.objectContaining({
          body: { email: 'test@example.com', password: 'password123' },
        }),
      )
    })
  })

  test('shows API error message on failure', async () => {
    const user = userEvent.setup()
    post().mockResolvedValue({ data: undefined, error: { detail: 'Invalid credentials' } })
    renderWithProviders(<Login />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /login/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  test('redirects to /account and populates auth store on success', async () => {
    const user = userEvent.setup()
    const authResponse = buildAuthResponse()
    post().mockResolvedValue({ data: authResponse, error: undefined })
    renderWithProviders(<Login />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /login/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/account')
    })
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().user?.email).toBe(authResponse.user.email)
  })
})
