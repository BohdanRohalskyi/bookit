import { initializeApp } from 'firebase/app';
import { getRemoteConfig, fetchAndActivate, getBoolean, getString } from 'firebase/remote-config';

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const isConfigured = Boolean(projectId);

// Detect staging by API URL — all flags are on in staging
const isStaging = import.meta.env.VITE_API_URL?.includes('staging') ?? false;

export const app = isConfigured
  ? initializeApp({
      apiKey:     import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId,
      appId:      import.meta.env.VITE_FIREBASE_APP_ID,
    })
  : null;

export const remoteConfig = app ? getRemoteConfig(app) : null;

if (remoteConfig) {
  remoteConfig.settings.minimumFetchIntervalMillis = 0;
  remoteConfig.defaultConfig = { feature_test: false };
}

let initialized = false;

export async function initFeatureFlags(): Promise<void> {
  if (!remoteConfig || initialized) return;
  try {
    await fetchAndActivate(remoteConfig);
    initialized = true;
  } catch (error) {
    console.warn('Failed to fetch feature flags:', error);
  }
}

export function isFeatureEnabled(name: string): boolean {
  if (!remoteConfig) return true; // Firebase not configured — local dev, all flags on
  if (isStaging) return true;
  return getBoolean(remoteConfig, name);
}

export function getFeatureValue(name: string): string {
  if (!remoteConfig) return '';
  return getString(remoteConfig, name);
}
