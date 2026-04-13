import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Mock } from 'vitest'
import { ResetPassword } from '../ResetPassword'
import { api } from '@bookit/shared/api'
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

beforeEach(() => {
  mockNavigate = vi.fn()
  post().mockReset()
})

// --- no token ---

describe('ResetPassword — no token', () => {
  test('shows "Invalid Link" when no ?token= param', () => {
    renderWithProviders(<ResetPassword />)

    expect(screen.getByText('Invalid Link')).toBeInTheDocument()
    expect(
      screen.getByText(/this password reset link is invalid or has expired/i),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument()
  })
})

// --- with token ---

describe('ResetPassword — with token', () => {
  const withToken = { initialEntries: ['/reset-password?token=valid-token-123'] }

  test('renders password form when ?token= is present', () => {
    renderWithProviders(<ResetPassword />, withToken)

    expect(screen.getByLabelText('New Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument()
  })

  test('shows validation error when passwords do not match', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ResetPassword />, withToken)

    await user.type(screen.getByLabelText('New Password'), 'password123')
    await user.type(screen.getByLabelText('Confirm Password'), 'different456')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(screen.getByText("Passwords don't match")).toBeInTheDocument()
    })
    expect(post()).not.toHaveBeenCalled()
  })

  test('shows error on API failure (expired or invalid token)', async () => {
    const user = userEvent.setup()
    post().mockResolvedValue({ data: undefined, error: { detail: 'Token has expired' } })
    renderWithProviders(<ResetPassword />, withToken)

    await user.type(screen.getByLabelText('New Password'), 'newpassword123')
    await user.type(screen.getByLabelText('Confirm Password'), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(screen.getByText('Token has expired')).toBeInTheDocument()
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  test('shows success state after successful reset', async () => {
    const user = userEvent.setup()
    post().mockResolvedValue({ data: undefined, error: undefined })
    renderWithProviders(<ResetPassword />, withToken)

    await user.type(screen.getByLabelText('New Password'), 'newpassword123')
    await user.type(screen.getByLabelText('Confirm Password'), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(screen.getByText(/your password has been reset successfully/i)).toBeInTheDocument()
    })
  })

  test('redirects to /login after successful reset', async () => {
    const user = userEvent.setup()
    post().mockResolvedValue({ data: undefined, error: undefined })
    // redirectDelay={0} fires the navigate call in the next macrotask — no
    // fake timers needed, no 2-second real wait.
    renderWithProviders(<ResetPassword redirectDelay={0} />, withToken)

    await user.type(screen.getByLabelText('New Password'), 'newpassword123')
    await user.type(screen.getByLabelText('Confirm Password'), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'))
  })

  test('sends token and new password in request body', async () => {
    const user = userEvent.setup()
    post().mockResolvedValue({ data: undefined, error: undefined })
    renderWithProviders(<ResetPassword />, withToken)

    await user.type(screen.getByLabelText('New Password'), 'newpassword123')
    await user.type(screen.getByLabelText('Confirm Password'), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(post()).toHaveBeenCalledWith(
        '/api/v1/auth/reset-password',
        expect.objectContaining({
          body: { token: 'valid-token-123', password: 'newpassword123' },
        }),
      )
    })
  })
})
