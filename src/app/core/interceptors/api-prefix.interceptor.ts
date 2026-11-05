import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export const apiPrefixInterceptor: HttpInterceptorFn = (req, next) => {
  // If the request is already an absolute URL, leave it as is
  if (req.url.startsWith('http://') || req.url.startsWith('https://')) {
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
