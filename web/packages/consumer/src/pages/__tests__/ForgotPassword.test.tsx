import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Mock } from 'vitest'
import { ForgotPassword } from '../ForgotPassword'
import { api } from '@bookit/shared/api'
import { renderWithProviders } from '../../test/utils'

vi.mock('@bookit/shared/api', () => ({
  api: { POST: vi.fn(), GET: vi.fn() },
  API_URL: 'http://localhost:8080',
}))

const post = () => api.POST as unknown as Mock

beforeEach(() => {
  post().mockReset()
})

// --- rendering ---

describe('ForgotPassword rendering', () => {
  test('renders email field and submit button', () => {
    renderWithProviders(<ForgotPassword />)

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument()
  })
})

// --- validation ---

describe('ForgotPassword validation', () => {
  test('shows validation error when email is empty or invalid', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ForgotPassword />)

    // Submit without typing — empty string passes native HTML validation
    // (no `required` attr on the input) but fails Zod's z.string().email().
    // Typing a plainly invalid value like "not-an-email" (no @) triggers
    // jsdom's native <input type="email"> constraint which blocks the submit
    // event before react-hook-form can run, so we test via empty submission.
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid email address')).toBeInTheDocument()
    })
    expect(post()).not.toHaveBeenCalled()
  })
})

// --- success state ---

describe('ForgotPassword success', () => {
  test('shows success state after submit — regardless of whether email exists', async () => {
    const user = userEvent.setup()
    // API always returns success — never reveals whether the email exists
    post().mockResolvedValue({ data: undefined, error: undefined })
    renderWithProviders(<ForgotPassword />)

    await user.type(screen.getByLabelText('Email'), 'anyone@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument()
      expect(screen.getByText(/if an account exists with that email/i)).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /send reset link/i })).not.toBeInTheDocument()
  })

  test('calls API with the submitted email', async () => {
    const user = userEvent.setup()
    post().mockResolvedValue({ data: undefined, error: undefined })
    renderWithProviders(<ForgotPassword />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(post()).toHaveBeenCalledWith(
        '/api/v1/auth/forgot-password',
        expect.objectContaining({ body: { email: 'test@example.com' } }),
      )
    })
  })
})
