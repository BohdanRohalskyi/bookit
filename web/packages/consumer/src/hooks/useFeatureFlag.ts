import { useState, useEffect } from 'react';
import { initFeatureFlags, isFeatureEnabled } from '../lib/firebase';

export function useFeatureFlag(flagName: string): { enabled: boolean; loading: boolean } {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initFeatureFlags().then(() => {
      setEnabled(isFeatureEnabled(flagName));
      setLoading(false);
    });
  }, [flagName]);

  return { enabled, loading };
}
