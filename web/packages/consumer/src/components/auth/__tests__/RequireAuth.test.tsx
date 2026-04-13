// Navigate is stubbed to prevent the infinite render loop that occurs when
// RequireAuth renders <Navigate to="/" replace /> while MemoryRouter is already
// at "/" — each replace() triggers a location update which re-renders
// RequireAuth, which calls Navigate again, ad infinitum.
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate-redirect" data-to={to} />,
  }
})

import { screen } from '@testing-library/react'
import { RequireAuth } from '../RequireAuth'
import { useAuthStore } from '@bookit/shared/stores'
import { renderWithProviders } from '../../../test/utils'

function buildUser() {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    name: 'Test User',
    email_verified: true,
    created_at: '2026-01-01T00:00:00Z',
  }
}

function buildTokens() {
  return { access_token: 'access-token', refresh_token: 'refresh-token', expires_in: 1800 }
}

beforeEach(() => {
  useAuthStore.getState().logout()
  localStorage.clear()
})

describe('RequireAuth', () => {
  test('redirects when not authenticated', () => {
    renderWithProviders(
      <RequireAuth><div>protected content</div></RequireAuth>,
    )
    expect(screen.queryByText('protected content')).not.toBeInTheDocument()
    expect(screen.getByTestId('navigate-redirect')).toHaveAttribute('data-to', '/')
  })

  test('redirects when user is null even if isAuthenticated is true', () => {
    useAuthStore.setState({ isAuthenticated: true, user: null, tokens: null })
    renderWithProviders(
      <RequireAuth><div>protected content</div></RequireAuth>,
    )
    expect(screen.queryByText('protected content')).not.toBeInTheDocument()
    expect(screen.getByTestId('navigate-redirect')).toHaveAttribute('data-to', '/')
  })

  test('renders children when authenticated with a valid user', () => {
    useAuthStore.getState().setAuth(buildUser(), buildTokens())
    renderWithProviders(
      <RequireAuth><div>protected content</div></RequireAuth>,
    )
    expect(screen.getByText('protected content')).toBeInTheDocument()
    expect(screen.queryByTestId('navigate-redirect')).not.toBeInTheDocument()
  })
})
