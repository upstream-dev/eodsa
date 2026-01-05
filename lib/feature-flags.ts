/**
 * Feature Flag Utility
 * 
 * Centralized feature flag management for Phase 2 features.
 * Set PHASE_2_ENABLED=false in environment variables to disable Phase 2 features.
 */

/**
 * Check if Phase 2 features are enabled
 * @returns true if Phase 2 features are enabled, false otherwise
 */
export function isPhase2Enabled(): boolean {
  // Default to false (disabled) if not set
  const enabled = process.env.PHASE_2_ENABLED;
  if (enabled === undefined || enabled === null) {
    return false;
  }
  // Accept 'true', 'True', 'TRUE', '1' as enabled
  return enabled.toLowerCase() === 'true' || enabled === '1';
}

/**
 * Get the feature unavailable message
 */
export function getFeatureUnavailableMessage(): string {
  return 'This feature is temporarily unavailable.';
}

/**
 * Check if a feature should be disabled based on Phase 2 flag
 * @param featureName - Name of the feature to check
 * @returns true if feature should be disabled
 */
export function isFeatureDisabled(featureName: 'rankings' | 'backend-portals' | 'admin-actions'): boolean {
  if (!isPhase2Enabled()) {
    return true;
  }
  return false;
}
