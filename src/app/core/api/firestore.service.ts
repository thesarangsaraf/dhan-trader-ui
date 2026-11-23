import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, of, tap } from 'rxjs';
import { FirestoreStatus } from '../models/firestore.models';

@Injectable({
  providedIn: 'root',
})
export class FirestoreApiService {
  private readonly http = inject(HttpClient);

  readonly status = signal<FirestoreStatus | null>(null);

  constructor() {
    this.refreshStatus().subscribe();
  }

  refreshStatus(): Observable<FirestoreStatus | null> {
    return this.http.get<FirestoreStatus>('/api/firestore/status').pipe(
      tap((res) => {
        if (res) this.status.set(res);
      }),
      catchError((err) => {
        console.warn('Backend /api/firestore/status unavailable:', err);
        return of(null);
      })
    );
  }
}
