import { createContext, useContext } from 'react'

export interface FeatureFlagContextValue {
  flags: Record<string, boolean>
  ready: boolean
}

export const FeatureFlagContext = createContext<FeatureFlagContextValue>({
  flags: {},
  ready: false,
})

/** @internal */
export function useFeatureFlagContext(): FeatureFlagContextValue {
  return useContext(FeatureFlagContext)
}
