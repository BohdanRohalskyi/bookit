import { type ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { FeatureFlagProvider } from '@bookit/shared'

// All flags return true in tests — mirrors local dev and staging behaviour.
const stubInit = async () => {}
const stubEvaluate = () => true

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient
  initialEntries?: string[]
}

export function renderWithProviders(
  ui: ReactElement,
  {
    queryClient = createTestQueryClient(),
    initialEntries = ['/'],
    ...options
  }: RenderWithProvidersOptions = {},
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter initialEntries={initialEntries}>
        <QueryClientProvider client={queryClient}>
          <FeatureFlagProvider init={stubInit} evaluate={stubEvaluate}>
            {children}
          </FeatureFlagProvider>
        </QueryClientProvider>
      </MemoryRouter>
    )
  }

  return { ...render(ui, { wrapper: Wrapper, ...options }), queryClient }
}
