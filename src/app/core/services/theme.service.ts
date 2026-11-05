import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  readonly isDarkMode = signal<boolean>(true);

  constructor() {
    const savedTheme = localStorage.getItem('dhan_theme');
    if (savedTheme) {
      this.setDarkMode(savedTheme === 'dark');
    } else {
      // Default to Dark Mode as per trading UI specifications
      this.setDarkMode(true);
    }
  }

  toggleTheme(): boolean {
    const next = !this.isDarkMode();
    this.setDarkMode(next);
    return next;
  }

  setDarkMode(isDark: boolean): void {
    this.isDarkMode.set(isDark);
    localStorage.setItem('dhan_theme', isDark ? 'dark' : 'light');

    if (isDark) {
      document.documentElement.classList.remove('light-theme');
    } else {
      document.documentElement.classList.add('light-theme');
    }
  }
}
