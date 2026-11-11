import { HttpInterceptorFn } from '@angular/common/http';
import {
  environment,
  isLocalHost,
  LOCAL_BACKEND_API_URL,
} from '../../../environments/environment';

export const apiPrefixInterceptor: HttpInterceptorFn = (req, next) => {
  // If the request is already an absolute URL:
  if (req.url.startsWith('http://') || req.url.startsWith('https://')) {
    // Defense-in-depth: If running locally, never connect to GCP Cloud Run URL; redirect to local backend
    if (isLocalHost() && req.url.includes('dhan-trader-api') && req.url.includes('run.app')) {
      const redirectedUrl = req.url.replace(/https:\/\/[^/]+/, LOCAL_BACKEND_API_URL);
      return next(req.clone({ url: redirectedUrl }));
    }
    return next(req);
  }

  // Prepend base backend URL for /api and /health endpoints
  if (req.url.startsWith('/api') || req.url.startsWith('/health')) {
    const base = environment.apiUrl.replace(/\/+$/, '');
    const modifiedReq = req.clone({
      url: `${base}${req.url}`,
    });
    return next(modifiedReq);
  }

  return next(req);
};
