/**
 * Privacy Consent Storage Helper
 *
 * Persists only the user's explicit privacy acknowledgement flag.
 * Does NOT persist camera frames, video, landmarks, face data, pose data, or metrics.
 */

export const PRIVACY_CONSENT_KEY = 'postureSyncPrivacyAcknowledged';

/**
 * Checks whether the user has explicitly acknowledged the privacy notice.
 */
export function hasPrivacyConsent(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    return window.localStorage.getItem(PRIVACY_CONSENT_KEY) === 'true';
  } catch (err) {
    console.error('Error reading privacy consent from localStorage:', err);
    return false;
  }
}

/**
 * Persists user privacy acknowledgement in localStorage.
 */
export function setPrivacyConsent(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(PRIVACY_CONSENT_KEY, 'true');
    }
  } catch (err) {
    console.error('Error writing privacy consent to localStorage:', err);
  }
}

/**
 * Clears user privacy acknowledgement from localStorage.
 */
export function clearPrivacyConsent(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(PRIVACY_CONSENT_KEY);
    }
  } catch (err) {
    console.error('Error clearing privacy consent from localStorage:', err);
  }
}
