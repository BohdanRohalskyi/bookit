import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FeatureFlagProvider } from '@bookit/shared'
import { initFeatureFlags, isFeatureEnabled } from '@bookit/shared/features/firebase'
import './index.css'
import { Root } from './Root'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <FeatureFlagProvider init={initFeatureFlags} evaluate={isFeatureEnabled}>
        <Root />
      </FeatureFlagProvider>
    </QueryClientProvider>
  </StrictMode>,
)
