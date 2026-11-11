import {
  getBackendApiUrl,
  isLocalHost,
  GCP_PRODUCTION_API_URL,
  LOCAL_BACKEND_API_URL,
} from './environment.helper';

export const environment = {
  production: false,
  get apiUrl(): string {
    return getBackendApiUrl();
  },
};

export { isLocalHost, getBackendApiUrl, GCP_PRODUCTION_API_URL, LOCAL_BACKEND_API_URL };
