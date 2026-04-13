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

describe('Biz Register rendering', () => {
  test('renders all four fields', () => {
    renderWithProviders(<Register />)

    expect(screen.getByLabelText('Full name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Phone')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })
})

describe('Biz Register validation', () => {
  test('shows field-level validation errors on empty submit', async () => {
    const user = userEvent.setup({ delay: null })
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
})

describe('Biz Register API', () => {
  test('redirects to / (not /account) and populates auth store on success', async () => {
    const user = userEvent.setup({ delay: null })
    post().mockResolvedValue({ data: buildAuthResponse(), error: undefined })
    renderWithProviders(<Register />)

    await user.type(screen.getByLabelText('Full name'), 'Biz Owner')
    await user.type(screen.getByLabelText('Email'), 'owner@biz.com')
    await user.type(screen.getByLabelText('Phone'), '+37061234567')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })
})
