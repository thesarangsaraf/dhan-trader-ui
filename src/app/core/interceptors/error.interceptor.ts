import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Do not spam toast popups for background polling or periodic GET data fetches.
      // Individual sections already display human-readable error cards with Retry buttons.
      const isBackgroundRead =
        req.method === 'GET' ||
        req.url.includes('/api/alerts/poll') ||
        req.url.includes('/health') ||
        req.url.includes('/api/positions') ||
        req.url.includes('/api/orders') ||
        req.url.includes('/api/holdings') ||
        req.url.includes('/api/auth/status');

      if (!isBackgroundRead) {
        let errorMsg = 'An unexpected error occurred';
        if (error.error?.error) {
          errorMsg = error.error.error;
        } else if (error.error?.message) {
          errorMsg = error.error.message;
        } else if (typeof error.error === 'string') {
          errorMsg = error.error;
        } else if (error.status === 0) {
          errorMsg = 'Cannot connect to Dhan Backend (http://127.0.0.1:8000)';
        } else if (error.status === 502) {
          errorMsg = 'Dhan API Gateway Error: ' + (error.error?.message || error.statusText);
        } else {
          errorMsg = `${error.status} ${error.statusText || 'Error'}`;
        }

        snackBar.open(errorMsg, 'Dismiss', {
          duration: 5000,
          horizontalPosition: 'right',
          verticalPosition: 'bottom',
          panelClass: ['snackbar-error'],
        });
      }

      return throwError(() => error);
    })
  );
};
