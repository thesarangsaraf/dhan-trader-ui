import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, shareReplay } from 'rxjs';
import {
  Instrument,
  OptionContractsResult,
  OptionExpiryItem,
} from '../models/instrument.models';

export interface InstrumentLtpResponse {
  symbol: string;
  ltp: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class InstrumentService {
  private readonly http = inject(HttpClient);

  getInstruments(limit = 20): Observable<Instrument[]> {
    return this.http
      .get<Instrument[]>(`/api/instruments?limit=${limit}`)
      .pipe(
        catchError((err) => {
          console.warn('Backend /api/instruments unavailable:', err);
          return of([]);
        }),
        shareReplay(1)
      );
  }

  getExpiries(instrument = 'NIFTY 50'): Observable<OptionExpiryItem[]> {
    const clean = (instrument || 'NIFTY 50').trim();
    return this.http
      .get<OptionExpiryItem[]>(`/api/instruments/expiries?instrument=${encodeURIComponent(clean)}`)
      .pipe(
        catchError((err) => {
          console.warn(`Backend /api/instruments/expiries unavailable for ${clean}:`, err);
          return of([]);
        }),
        shareReplay(1)
      );
  }

  getOptionContracts(
    instrument: string,
    price?: number | null,
    expiry?: string | null
  ): Observable<OptionContractsResult | null> {
    const clean = (instrument || 'NIFTY 50').trim();
    let url = `/api/instruments/option-contracts?instrument=${encodeURIComponent(clean)}`;
    if (price && price > 0) {
      url += `&price=${price}`;
    }
    if (expiry) {
      url += `&expiry=${encodeURIComponent(expiry)}`;
    }

    return this.http.get<OptionContractsResult>(url).pipe(
      catchError((err) => {
        console.warn(`Backend /api/instruments/option-contracts unavailable for ${clean}:`, err);
        return of(null);
      }),
      shareReplay(1)
    );
  }

  search(term: string, limit = 10): Observable<Instrument[]> {
    const q = (term || '').trim();
    return this.http
      .get<Instrument[]>(`/api/instruments?q=${encodeURIComponent(q)}&limit=${limit}`)
      .pipe(
        catchError((err) => {
          console.warn('Backend /api/instruments unavailable:', err);
          return of([]);
        }),
        shareReplay(1)
      );
  }

  getLtp(symbol: string): Observable<InstrumentLtpResponse> {
    const clean = (symbol || '').trim();
    if (!clean) {
      return of({ symbol: '', ltp: null });
    }
    return this.http
      .get<InstrumentLtpResponse>(`/api/instruments/ltp?symbol=${encodeURIComponent(clean)}`)
      .pipe(
        catchError((err) => {
          console.warn(`Backend /api/instruments/ltp unavailable for ${clean}:`, err);
          return of({ symbol: clean, ltp: null });
        }),
        shareReplay(1)
      );
  }
}
