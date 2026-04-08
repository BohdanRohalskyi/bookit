import { initializeApp } from 'firebase/app';
import { getRemoteConfig, fetchAndActivate, getBoolean, getString } from 'firebase/remote-config';

const firebaseConfig = {
  apiKey:     import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:  import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId:      import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const remoteConfig = getRemoteConfig(app);

// Check if running on staging
const isStaging = import.meta.env.VITE_API_URL?.includes('staging') ?? false;

// No cache - fetch fresh values on every request
remoteConfig.settings.minimumFetchIntervalMillis = 0;

// Defaults (used before first fetch)
remoteConfig.defaultConfig = {
  feature_test: false,
};

let initialized = false;

export async function initFeatureFlags(): Promise<void> {
  if (initialized) return;
  try {
    await fetchAndActivate(remoteConfig);
    initialized = true;
  } catch (error) {
    console.warn('Failed to fetch feature flags:', error);
  }
}

export function isFeatureEnabled(name: string): boolean {
  // All flags enabled on staging
  if (isStaging) return true;
  return getBoolean(remoteConfig, name);
}

export function getFeatureValue(name: string): string {
  return getString(remoteConfig, name);
}
