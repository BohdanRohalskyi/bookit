import { useFeatureFlagContext } from './_context'
import { FLAGS, type FlagName } from './flags'

/** Returns whether feature flags have been fetched and activated. */
export function useFeatureFlagsReady(): boolean {
  return useFeatureFlagContext().ready
}

/** Returns the boolean value for the given flag. Defaults to false before ready. */
export function useFeatureFlag(flag: FlagName): boolean {
  const { flags } = useFeatureFlagContext()
  return flags[FLAGS[flag]] ?? false
}
