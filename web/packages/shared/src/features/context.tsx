import { useEffect, useState } from 'react'
import { FLAGS } from './flags'
import { FeatureFlagContext, type FeatureFlagContextValue } from './_context'

interface FeatureFlagProviderProps {
  /** Async function that fetches and activates remote flag values. */
  init: () => Promise<void>
  /** Returns the boolean value for a given flag key. */
  evaluate: (flagKey: string) => boolean
  children: React.ReactNode
}

/**
 * Initialises feature flags once at app root and makes all values
 * available synchronously to every descendant via context.
 */
export function FeatureFlagProvider({ init, evaluate, children }: FeatureFlagProviderProps) {
  const [value, setValue] = useState<FeatureFlagContextValue>({ flags: {}, ready: false })

  useEffect(() => {
    init().then(() => {
      const flags: Record<string, boolean> = {}
      for (const key of Object.values(FLAGS)) {
        flags[key] = evaluate(key)
      }
      setValue({ flags, ready: true })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // init and evaluate are module-level stable references — not reactive deps.

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  )
}
