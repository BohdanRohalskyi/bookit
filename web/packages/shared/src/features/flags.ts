/**
 * All feature flag names used across the platform.
 * Add new flags here — never use raw strings in components.
 */
export const FLAGS = {
  FEATURE_TEST: 'feature_test',
  PROVIDER_DASHBOARD: 'provider_dashboard',
  ADMIN_LOCATIONS: 'admin_locations',
  STAFF_PROFILES: 'staff_profiles',
} as const

/** Union of all valid flag constant names (e.g. 'FEATURE_TEST'). */
export type FlagName = keyof typeof FLAGS
