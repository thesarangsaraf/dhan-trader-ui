import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ChartCandlesResponse } from '../models/chart.models';

@Injectable({
  providedIn: 'root',
})
export class ChartService {
  private readonly http = inject(HttpClient);

  getCandles(
    symbol = 'NIFTY 50',
    interval = '5m',
    range = '1d',
    limit?: number,
    period1?: number,
    period2?: number,
  ): Observable<ChartCandlesResponse> {
    let params = new HttpParams()
      .set('symbol', symbol)
      .set('interval', interval);

    if (period1 && period2) {
      params = params.set('period1', period1.toString()).set('period2', period2.toString());
    } else if (range) {
      params = params.set('range', range);
    }

    if (limit && limit > 0) {
      params = params.set('limit', limit.toString());
    }

    return this.http.get<ChartCandlesResponse>('/api/charts/candles', { params });
  }
}
