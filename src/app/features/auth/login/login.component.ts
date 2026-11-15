import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { UserAuthService } from '../../../core/api/user-auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(UserAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly hidePassword = signal<boolean>(true);
  readonly errorMessage = signal<string | null>(null);
  readonly isLoading = this.authService.isLoading;

  private returnUrl = '/';

  readonly loginForm: FormGroup = this.fb.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
    rememberMe: [true],
  });

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';

    // If already authenticated, redirect immediately
    if (this.authService.isAuthenticated()) {
      this.router.navigateByUrl(this.returnUrl);
    }
  }

  togglePasswordVisibility(): void {
    this.hidePassword.set(!this.hidePassword());
  }

  onSubmit(): void {
    if (this.loginForm.invalid || this.isLoading()) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    const { username, password } = this.loginForm.value;

    this.authService.login({ username, password }, this.returnUrl).subscribe({
      next: () => {
        // Handled by service redirect
      },
      error: (err) => {
        const msg =
          err?.error?.message ||
          (err?.status === 401
            ? 'Invalid username or password. Please verify and try again.'
            : 'Unable to connect to authentication server. Please check backend status.');
        this.errorMessage.set(msg);
      },
    });
  }
}
