import { render, screen, waitFor } from '@testing-library/react'
import { FeatureFlagProvider } from '../context'
import { useFeatureFlag, useFeatureFlagsReady } from '../useFeatureFlag'

// --- helper components ---

function FlagDisplay() {
  const enabled = useFeatureFlag('FEATURE_TEST')
  return <div data-testid="flag">{enabled ? 'enabled' : 'disabled'}</div>
}

function ReadyDisplay() {
  const ready = useFeatureFlagsReady()
  return <div data-testid="ready">{ready ? 'ready' : 'not-ready'}</div>
}

// --- FeatureFlagProvider ---

describe('FeatureFlagProvider', () => {
  test('renders children', () => {
    render(
      <FeatureFlagProvider init={async () => {}} evaluate={() => false}>
        <div>child content</div>
      </FeatureFlagProvider>,
    )
    expect(screen.getByText('child content')).toBeInTheDocument()
  })
})

// --- useFeatureFlag ---

describe('useFeatureFlag', () => {
  test('returns false before init resolves', () => {
    // init never resolves in this test — flag stays false
    const init = () => new Promise<void>(() => {})

    render(
      <FeatureFlagProvider init={init} evaluate={() => true}>
        <FlagDisplay />
      </FeatureFlagProvider>,
    )

    expect(screen.getByTestId('flag')).toHaveTextContent('disabled')
  })

  test('returns correct value after init resolves', async () => {
    render(
      <FeatureFlagProvider init={async () => {}} evaluate={() => true}>
        <FlagDisplay />
      </FeatureFlagProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('flag')).toHaveTextContent('enabled')
    })
  })

  test('transitions from false to true when init resolves', async () => {
    let resolveInit!: () => void
    const init = () => new Promise<void>((resolve) => { resolveInit = resolve })

    render(
      <FeatureFlagProvider init={init} evaluate={() => true}>
        <FlagDisplay />
      </FeatureFlagProvider>,
    )

    expect(screen.getByTestId('flag')).toHaveTextContent('disabled')

    resolveInit()

    await waitFor(() => {
      expect(screen.getByTestId('flag')).toHaveTextContent('enabled')
    })
  })

  test('respects evaluate result — returns false when evaluate returns false', async () => {
    render(
      <FeatureFlagProvider init={async () => {}} evaluate={() => false}>
        <FlagDisplay />
      </FeatureFlagProvider>,
    )

    await waitFor(() => {
      // ready is true but flag value is false
      expect(screen.getByTestId('flag')).toHaveTextContent('disabled')
    })
  })

  // TypeScript compile-time guarantee: passing an invalid flag name is a type error.
  // Verified by `npm run typecheck` — 'NONEXISTENT' is not a valid FlagName.
})

// --- useFeatureFlagsReady ---

describe('useFeatureFlagsReady', () => {
  test('returns false before init resolves', () => {
    const init = () => new Promise<void>(() => {})

    render(
      <FeatureFlagProvider init={init} evaluate={() => false}>
        <ReadyDisplay />
      </FeatureFlagProvider>,
    )

    expect(screen.getByTestId('ready')).toHaveTextContent('not-ready')
  })

  test('returns true after init resolves', async () => {
    let resolveInit!: () => void
    const init = () => new Promise<void>((resolve) => { resolveInit = resolve })

    render(
      <FeatureFlagProvider init={init} evaluate={() => false}>
        <ReadyDisplay />
      </FeatureFlagProvider>,
    )

    expect(screen.getByTestId('ready')).toHaveTextContent('not-ready')

    resolveInit()

    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('ready')
    })
  })
})
