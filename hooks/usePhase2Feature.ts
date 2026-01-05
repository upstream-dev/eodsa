'use client';

import { useState, useEffect } from 'react';

/**
 * Client-side hook to check if Phase 2 features are enabled
 * Fetches the flag from the server on mount
 */
export function usePhase2Feature() {
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch the feature flag status from the server
    fetch('/api/feature-flags/phase2')
      .then(res => res.json())
      .then(data => {
        setIsEnabled(data.enabled === true);
        setIsLoading(false);
      })
      .catch(() => {
        // Default to disabled if there's an error
        setIsEnabled(false);
        setIsLoading(false);
      });
  }, []);

  return { isEnabled: isEnabled === true, isLoading };
}
