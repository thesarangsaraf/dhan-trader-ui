import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ChartsPageComponent } from './features/charts/charts-page.component';
import { TradeHistoryComponent } from './features/trade-history/trade-history.component';
import { SettingsPageComponent } from './features/settings/settings-page/settings-page.component';
import { LoginComponent } from './features/auth/login/login.component';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [guestGuard],
  },
  {
    path: '',
    component: DashboardComponent,
    canActivate: [authGuard],
  },
  {
    path: 'charts',
    loadComponent: () =>
      import('./features/charts/charts-page.component').then((m) => m.ChartsPageComponent),
    canActivate: [authGuard],
  },
  {
    path: 'trades',
    component: TradeHistoryComponent,
    canActivate: [authGuard],
  },
  {
    path: 'settings',
    component: SettingsPageComponent,
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
