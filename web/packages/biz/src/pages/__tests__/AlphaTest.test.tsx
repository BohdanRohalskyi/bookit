import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Mock } from 'vitest'
import { AlphaTest } from '../AlphaTest'
import { api } from '@bookit/shared/api'
import { renderWithProviders } from '../../test/utils'

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => vi.fn() }
})

vi.mock('@bookit/shared/api', () => ({
  api: { GET: vi.fn(), POST: vi.fn() },
  API_URL: 'http://localhost:8080',
}))

const post = () => api.POST as unknown as Mock

beforeEach(() => {
  post().mockReset()
})

describe('AlphaTest page', () => {
  test('renders the form fields', () => {
    renderWithProviders(<AlphaTest />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/company name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /request access/i })).toBeInTheDocument()
  })

  test('submits form and shows success message', async () => {
    const user = userEvent.setup()
    post().mockResolvedValue({ data: { message: 'ok' }, error: undefined })

    renderWithProviders(<AlphaTest />)

    await user.type(screen.getByLabelText(/email/i), 'test@acme.com')
    await user.type(screen.getByLabelText(/company name/i), 'Acme Corp')
    await user.type(screen.getByLabelText(/description/i), 'We want access')
    await user.click(screen.getByRole('button', { name: /request access/i }))

    await waitFor(() =>
      expect(screen.getByText(/thank you/i)).toBeInTheDocument()
    )
    expect(post()).toHaveBeenCalledWith('/api/v1/alpha-access', expect.objectContaining({
      body: { email: 'test@acme.com', company_name: 'Acme Corp', description: 'We want access' },
    }))
  })

  test('shows error message on API failure', async () => {
    const user = userEvent.setup()
    post().mockResolvedValue({ data: undefined, error: { detail: 'Server error' } })

    renderWithProviders(<AlphaTest />)

    await user.type(screen.getByLabelText(/email/i), 'test@acme.com')
    await user.type(screen.getByLabelText(/company name/i), 'Acme Corp')
    await user.type(screen.getByLabelText(/description/i), 'We want access')
    await user.click(screen.getByRole('button', { name: /request access/i }))

    await waitFor(() =>
      expect(screen.getByText(/server error/i)).toBeInTheDocument()
    )
  })

  test('button is disabled while submitting', async () => {
    const user = userEvent.setup()
    post().mockImplementation(() => new Promise(() => {})) // never resolves

    renderWithProviders(<AlphaTest />)

    await user.type(screen.getByLabelText(/email/i), 'test@acme.com')
    await user.type(screen.getByLabelText(/company name/i), 'Acme Corp')
    await user.type(screen.getByLabelText(/description/i), 'We want access')
    await user.click(screen.getByRole('button', { name: /request access/i }))

    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled()
  })
})
