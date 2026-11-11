/**
 * Environment resolution helper for Dhan Trader UI.
 *
 * Directives:
 * - When running locally (localhost, 127.0.0.1, LAN IP, dev server),
 *   the UI strictly connects to the local backend on http://127.0.0.1:8000 and NEVER to GCP Cloud Run.
 * - When running in production (deployed to Firebase Hosting / Cloud),
 *   the UI connects to the GCP Cloud Run backend.
 */

/**
 * Cloud Run Production Backend URL
 */
export const GCP_PRODUCTION_API_URL = 'https://dhan-trader-api-218680608145.asia-south1.run.app';

/**
 * Local Backend URL
 */
export const LOCAL_BACKEND_API_URL = 'http://127.0.0.1:8000';

/**
 * Detects whether the UI is currently running locally.
 * Returns true if running on localhost, 127.0.0.1, 0.0.0.0, [::1],
 * *.local, *.internal, or private LAN IP subnets (192.168.x.x, 10.x.x.x, 172.16-31.x.x).
 */
export function isLocalHost(hostname?: string): boolean {
  if (typeof window === 'undefined' || !window.location) {
    return true; // Safe fallback in SSR / node / testing environments
  }
  const host = (hostname || window.location.hostname || '').toLowerCase();
  if (!host) {
    return true;
  }
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '[::1]' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost') ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)
  );
}

/**
 * Get the backend API URL dynamically based on where the UI is running.
 * When running locally, ALWAYS connects to local backend (http://127.0.0.1:8000).
 * When running in cloud / remote deployment (e.g. Firebase Hosting), connects to GCP Cloud Run.
 */
export function getBackendApiUrl(): string {
  // Check optional override in localStorage if present
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const override = window.localStorage.getItem('DHAN_API_URL');
      if (override && (override.startsWith('http://') || override.startsWith('https://'))) {
        return override.replace(/\/+$/, '');
      }
    } catch {
      // Ignore localStorage security errors (e.g. in restricted sandboxes)
    }
  }

  // When UI is running locally, strictly connect to local backend, never GCP
  if (typeof window !== 'undefined' && window.location) {
    const host = (window.location.hostname || '').toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '[::1]' ||
      !host
    ) {
      return LOCAL_BACKEND_API_URL;
    }
    if (isLocalHost(host)) {
      return `http://${host}:8000`;
    }
  }

  return GCP_PRODUCTION_API_URL;
}
