import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { UserAuthService } from '../api/user-auth.service';

export const userAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(UserAuthService);

  // Skip adding Bearer token to login or refresh endpoints
  if (req.url.includes('/api/user-auth/login') || req.url.includes('/api/user-auth/refresh')) {
    return next(req);
  }

  const token = authService.getAccessToken();
  let authReq = req;

  if (token) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(authReq).pipe(
    catchError((error: any) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        // Attempt automatic refresh if session exists
        const refreshToken = authService.getRefreshToken();
        if (refreshToken) {
          return authService.refreshToken().pipe(
            switchMap((refreshRes) => {
              if (refreshRes && refreshRes.accessToken) {
                const retriedReq = req.clone({
                  setHeaders: {
                    Authorization: `Bearer ${refreshRes.accessToken}`,
                  },
                });
                return next(retriedReq);
              }
              // Refresh did not return a new token (e.g. backend was temporarily offline / restarting).
              // Do NOT logout; authService.refreshToken() handles logout only if 401/403 was received from backend.
              // Rethrow error so UI handles it gracefully without wiping the session.
              return throwError(() => error);
            }),
          );
        } else {
          authService.logout(true);
        }
      }
      return throwError(() => error);
    }),
  );
};
