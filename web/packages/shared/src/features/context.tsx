import { createContext, useContext, useEffect, useState } from 'react'
import { FLAGS, type FlagName } from './flags'

type FlagValues = Record<string, boolean>

interface FeatureFlagContextValue {
  flags: FlagValues
  ready: boolean
}

const FeatureFlagContext = createContext<FeatureFlagContextValue>({
  flags: {},
  ready: false,
})

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
  const [flags, setFlags] = useState<FlagValues>({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    init().then(() => {
      const values: FlagValues = {}
      for (const key of Object.values(FLAGS)) {
        values[key] = evaluate(key)
      }
      setFlags(values)
      setReady(true)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // init and evaluate are module-level stable references — not reactive deps.

  return (
    <FeatureFlagContext.Provider value={{ flags, ready }}>
      {children}
    </FeatureFlagContext.Provider>
  )
}

/** @internal — used only by useFeatureFlag */
export function useFeatureFlagContext(): FeatureFlagContextValue {
  return useContext(FeatureFlagContext)
}

/** Returns whether feature flags have been fetched and activated. */
export function useFeatureFlagsReady(): boolean {
  return useContext(FeatureFlagContext).ready
}

/** Returns the boolean value for the given flag. Defaults to false before ready. */
export function useFeatureFlag(flag: FlagName): boolean {
  const { flags } = useFeatureFlagContext()
  return flags[FLAGS[flag]] ?? false
}
