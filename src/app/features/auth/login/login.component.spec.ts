import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { UserAuthService } from '../../../core/api/user-auth.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authService: UserAuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        provideRouter([]),
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(UserAuthService);
    fixture.detectChanges();
  });

  it('should create the login component with initial form state', () => {
    expect(component).toBeTruthy();
    expect(component.loginForm.valid).toBe(false);
    expect(component.loginForm.get('username')?.value).toBe('');
    expect(component.loginForm.get('password')?.value).toBe('');
  });

  it('should toggle password visibility signal', () => {
    expect(component.hidePassword()).toBe(true);
    component.togglePasswordVisibility();
    expect(component.hidePassword()).toBe(false);
    component.togglePasswordVisibility();
    expect(component.hidePassword()).toBe(true);
  });

  it('should mark fields as touched if submitted while invalid', () => {
    component.onSubmit();
    expect(component.loginForm.get('username')?.touched).toBe(true);
    expect(component.loginForm.get('password')?.touched).toBe(true);
  });

  it('should call authService.login on valid form submission', () => {
    const loginSpy = vi.spyOn(authService, 'login').mockReturnValue(
      of({
        accessToken: 'tk',
        refreshToken: 'rf',
        user: { username: 'admin', role: 'admin' },
      }),
    );

    component.loginForm.setValue({
      username: 'admin',
      password: 'admin123',
      rememberMe: true,
    });

    component.onSubmit();

    expect(loginSpy).toHaveBeenCalledWith({ username: 'admin', password: 'admin123' }, '/');
  });

  it('should set errorMessage when login fails', () => {
    vi.spyOn(authService, 'login').mockReturnValue(
      throwError(() => ({
        status: 401,
        error: { message: 'Invalid username or password' },
      })),
    );

    component.loginForm.setValue({
      username: 'admin',
      password: 'wrongPassword',
      rememberMe: true,
    });

    component.onSubmit();

    expect(component.errorMessage()).toBe('Invalid username or password');
  });
});
