import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Mock } from 'vitest'
import { Register } from '../Register'
import { api } from '@bookit/shared/api'
import { renderWithProviders } from '../../test/utils'
import { buildAuthResponse } from '../../mocks/fixtures/auth'
import { useAuthStore } from '@bookit/shared/stores'

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

beforeEach(() => {
  mockNavigate = vi.fn()
  post().mockReset()
  useAuthStore.getState().logout()
  localStorage.clear()
})

// --- rendering ---

describe('Register rendering', () => {
  test('renders all four fields', () => {
    renderWithProviders(<Register />)

    expect(screen.getByLabelText('Full Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Phone')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })
})

// --- validation ---

describe('Register validation', () => {
  test('shows field-level validation errors on empty submit', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Register />)

    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument()
      expect(screen.getByText('Invalid email address')).toBeInTheDocument()
      expect(screen.getByText('Phone is required')).toBeInTheDocument()
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    })
    expect(post()).not.toHaveBeenCalled()
  })

  test('shows password length error for short password', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Register />)

    await user.type(screen.getByLabelText('Full Name'), 'Test User')
    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Phone'), '+37061234567')
    await user.type(screen.getByLabelText('Password'), 'short')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    })
    expect(post()).not.toHaveBeenCalled()
  })
})

// --- API interaction ---

describe('Register API', () => {
  test('calls API with correct body on valid submit', async () => {
    const user = userEvent.setup()
    post().mockResolvedValue({ data: buildAuthResponse(), error: undefined })
    renderWithProviders(<Register />)

    await user.type(screen.getByLabelText('Full Name'), 'Test User')
    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Phone'), '+37061234567')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(post()).toHaveBeenCalledWith(
        '/api/v1/auth/register',
        expect.objectContaining({
          body: {
            name: 'Test User',
            email: 'test@example.com',
            phone: '+37061234567',
            password: 'password123',
          },
        }),
      )
    })
  })

  test('redirects to /account and populates auth store on success', async () => {
    const user = userEvent.setup()
    post().mockResolvedValue({ data: buildAuthResponse(), error: undefined })
    renderWithProviders(<Register />)

    await user.type(screen.getByLabelText('Full Name'), 'Test User')
    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Phone'), '+37061234567')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/account')
    })
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })
})
