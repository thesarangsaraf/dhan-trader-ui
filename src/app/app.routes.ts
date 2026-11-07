import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { TradeHistoryComponent } from './features/trade-history/trade-history.component';

export const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
  },
  {
    path: 'trades',
    component: TradeHistoryComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
