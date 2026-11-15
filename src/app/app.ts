import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/components/header/header.component';
import { UserAuthService } from './core/api/user-auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent],
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly userAuthService = inject(UserAuthService);
  protected readonly title = signal('Dhan Trader Pro');
  readonly isAuthenticated = this.userAuthService.isAuthenticated;
}

export { App as AppComponent };
