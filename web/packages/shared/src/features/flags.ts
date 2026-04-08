/**
 * All feature flag names used across the platform.
 * Add new flags here — never use raw strings in components.
 */
export const FLAGS = {
  FEATURE_TEST: 'feature_test',
} as const

/** Union of all valid flag constant names (e.g. 'FEATURE_TEST'). */
export type FlagName = keyof typeof FLAGS
