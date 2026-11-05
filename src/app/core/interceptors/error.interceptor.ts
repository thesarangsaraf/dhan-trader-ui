import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Don't spam notifications for background poll if backend is temporarily disconnected
      const isPolling = req.url.includes('/api/alerts/poll') || req.url.includes('/health');

      if (!isPolling) {
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
