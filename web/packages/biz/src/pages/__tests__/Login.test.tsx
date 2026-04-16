import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Mock } from 'vitest'
import { Login } from '../Login'
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

describe('Biz Login rendering', () => {
  test('renders email and password fields', () => {
    renderWithProviders(<Login />)

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })
})

describe('Biz Login validation', () => {
  test('shows validation errors on empty submit', async () => {
    const user = userEvent.setup({ delay: null })
    renderWithProviders(<Login />)

    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid email address')).toBeInTheDocument()
      expect(screen.getByText('Password is required')).toBeInTheDocument()
    })
    expect(post()).not.toHaveBeenCalled()
  })
})

describe('Biz Login API', () => {
  test('redirects to /spaces and populates auth store on success', async () => {
    const user = userEvent.setup({ delay: null })
    post().mockResolvedValue({ data: buildAuthResponse(), error: undefined })
    renderWithProviders(<Login />)

    await user.type(screen.getByLabelText('Email'), 'biz@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/spaces')
    })
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  test('shows API error message on failure', async () => {
    const user = userEvent.setup({ delay: null })
    post().mockResolvedValue({ data: undefined, error: { detail: 'Invalid credentials' } })
    renderWithProviders(<Login />)

    await user.type(screen.getByLabelText('Email'), 'biz@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
