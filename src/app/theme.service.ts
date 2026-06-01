import { computed, effect, Injectable, signal } from '@angular/core';

type Theme = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.storedTheme());

  private readonly systemDark = signal(this.getSystemDark());

  readonly isDark = computed(() => {
    const t = this.theme();
    return t === 'dark' || (t === 'system' && this.systemDark());
  });

  constructor() {
    effect(() => {
      document.documentElement.classList.toggle('dark', this.isDark());
    });

    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        this.systemDark.set(e.matches);
      });
    } catch {
      // matchMedia unavailable (e.g. very old browser)
    }

    try {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) this.theme.set(this.storedTheme());
      });
    } catch {
      // ignore
    }
  }

  toggle(): void {
    const next = this.isDark() ? 'light' : 'dark';
    this.theme.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  }

  private storedTheme(): Theme {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === 'light' || v === 'dark') return v;
    } catch {
      // ignore
    }
    return 'system';
  }

  private getSystemDark(): boolean {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  }
}
