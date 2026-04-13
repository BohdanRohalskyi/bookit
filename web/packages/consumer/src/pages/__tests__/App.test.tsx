// Page components are stubbed so Vite only transforms App.tsx + RequireAuth,
// not the entire page dependency tree (react-hook-form, zod, shadcn, etc.).
vi.mock('../Landing', () => ({ Landing: () => <div>Landing</div> }))
vi.mock('../Login', () => ({ Login: () => <div>Login</div> }))
vi.mock('../Register', () => ({ Register: () => <div>Register</div> }))
vi.mock('../Account', () => ({ Account: () => <div>Account</div> }))
vi.mock('../ForgotPassword', () => ({ ForgotPassword: () => <div>ForgotPassword</div> }))
vi.mock('../ResetPassword', () => ({ ResetPassword: () => <div>ResetPassword</div> }))
vi.mock('../VerifyEmail', () => ({ VerifyEmail: () => <div>VerifyEmail</div> }))
vi.mock('../DevStatus', () => ({ DevStatus: () => <div>DevStatus</div> }))
vi.mock('../NotFound', () => ({ NotFound: () => <div>Page not found</div> }))

import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FeatureFlagProvider } from '@bookit/shared'
import App from '../../App'

// Control the initial route by replacing BrowserRouter with MemoryRouter.
let testPath = '/'

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => (
      <actual.MemoryRouter initialEntries={[testPath]}>
        {children}
      </actual.MemoryRouter>
    ),
  }
})

const stubInit = async () => {}
const stubEvaluate = () => true

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <FeatureFlagProvider init={stubInit} evaluate={stubEvaluate}>
        <App />
      </FeatureFlagProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => { testPath = '/' })

describe('App routing', () => {
  test('renders NotFound for unknown paths', () => {
    testPath = '/this-path-does-not-exist'
    renderApp()
    expect(screen.getByText('Page not found')).toBeInTheDocument()
  })

  test('redirects unauthenticated access to /account back to /', () => {
    testPath = '/account'
    renderApp()
    expect(screen.queryByText('Page not found')).not.toBeInTheDocument()
  })
})
