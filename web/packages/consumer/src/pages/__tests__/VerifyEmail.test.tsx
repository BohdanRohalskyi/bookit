import { screen, waitFor } from '@testing-library/react'
import type { Mock } from 'vitest'
import { VerifyEmail } from '../VerifyEmail'
import { api } from '@bookit/shared/api'
import { renderWithProviders } from '../../test/utils'

vi.mock('@bookit/shared/api', () => ({
  api: { POST: vi.fn(), GET: vi.fn() },
  API_URL: 'http://localhost:8080',
}))

const post = () => api.POST as unknown as Mock

const withToken = { initialEntries: ['/verify-email?token=valid-token'] }

beforeEach(() => {
  post().mockReset()
})

describe('VerifyEmail', () => {
  test('shows error immediately when no ?token= param (no API call)', () => {
    // Component uses useMemo to set initial state — no API call needed
    renderWithProviders(<VerifyEmail />)

    expect(screen.getByText('Verification Failed')).toBeInTheDocument()
    expect(screen.getByText('Invalid verification link')).toBeInTheDocument()
    expect(post()).not.toHaveBeenCalled()
  })

  test('shows loading state while API call is in progress', () => {
    // Never-resolving promise keeps component in loading state
    post().mockReturnValue(new Promise(() => {}))
    renderWithProviders(<VerifyEmail />, withToken)

    expect(screen.getByText('Verifying...')).toBeInTheDocument()
    expect(screen.getByText(/please wait while we verify/i)).toBeInTheDocument()
  })

  test('shows success state when API returns 200', async () => {
    post().mockResolvedValue({ data: {}, error: undefined })
    renderWithProviders(<VerifyEmail />, withToken)

    await waitFor(() => {
      expect(screen.getByText('Email Verified')).toBeInTheDocument()
      expect(screen.getByText(/verified successfully/i)).toBeInTheDocument()
    })
  })

  test('shows error state with API message when token is invalid', async () => {
    post().mockResolvedValue({
      data: undefined,
      error: { detail: 'Token has expired or is invalid' },
    })
    renderWithProviders(<VerifyEmail />, withToken)

    await waitFor(() => {
      expect(screen.getByText('Verification Failed')).toBeInTheDocument()
      expect(screen.getByText('Token has expired or is invalid')).toBeInTheDocument()
    })
  })
})
