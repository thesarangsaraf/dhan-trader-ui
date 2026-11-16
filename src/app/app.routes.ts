import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { PositionsPageComponent } from './features/positions/positions-page.component';
import { TradeHistoryComponent } from './features/trade-history/trade-history.component';
import { ScreenerComponent } from './features/screener/screener.component';
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
    path: 'positions',
    component: PositionsPageComponent,
    canActivate: [authGuard],
  },
  {
    path: 'portfolio',
    redirectTo: 'positions',
    pathMatch: 'full',
  },
  {
    path: 'trades',
    component: TradeHistoryComponent,
    canActivate: [authGuard],
  },
  {
    path: 'screener',
    component: ScreenerComponent,
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
