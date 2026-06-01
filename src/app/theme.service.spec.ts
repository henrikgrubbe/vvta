import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeService } from './theme.service';

const STORAGE_KEY = 'theme';

function mockMatchMedia(prefersDark = false): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })),
  );
}

function createService(): ThemeService {
  TestBed.configureTestingModule({});
  return TestBed.inject(ThemeService);
}

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    TestBed.resetTestingModule();
    mockMatchMedia(false); // default: OS light
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  describe('initial state', () => {
    it('defaults to system when no preference is stored', () => {
      const service = createService();
      expect(service.theme()).toBe('system');
    });

    it('reads dark from localStorage', () => {
      localStorage.setItem(STORAGE_KEY, 'dark');
      const service = createService();
      expect(service.theme()).toBe('dark');
    });

    it('reads light from localStorage', () => {
      localStorage.setItem(STORAGE_KEY, 'light');
      const service = createService();
      expect(service.theme()).toBe('light');
    });

    it('falls back to system for unknown stored value', () => {
      localStorage.setItem(STORAGE_KEY, 'invalid');
      const service = createService();
      expect(service.theme()).toBe('system');
    });
  });

  // -------------------------------------------------------------------------
  // isDark() computed
  // -------------------------------------------------------------------------

  describe('isDark()', () => {
    it('system + OS dark → true', () => {
      mockMatchMedia(true);
      const service = createService();
      expect(service.isDark()).toBe(true);
    });

    it('system + OS light → false', () => {
      mockMatchMedia(false);
      const service = createService();
      expect(service.isDark()).toBe(false);
    });

    it('dark → true regardless of OS preference', () => {
      localStorage.setItem(STORAGE_KEY, 'dark');
      mockMatchMedia(false); // OS says light, explicit dark wins
      const service = createService();
      expect(service.isDark()).toBe(true);
    });

    it('light → false regardless of OS preference', () => {
      localStorage.setItem(STORAGE_KEY, 'light');
      mockMatchMedia(true); // OS says dark, explicit light wins
      const service = createService();
      expect(service.isDark()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // toggle()
  // -------------------------------------------------------------------------

  describe('toggle()', () => {
    it('switches from light to dark', () => {
      localStorage.setItem(STORAGE_KEY, 'light');
      const service = createService();
      service.toggle();
      expect(service.theme()).toBe('dark');
      expect(service.isDark()).toBe(true);
    });

    it('switches from dark to light', () => {
      localStorage.setItem(STORAGE_KEY, 'dark');
      const service = createService();
      service.toggle();
      expect(service.theme()).toBe('light');
      expect(service.isDark()).toBe(false);
    });

    it('persists new preference to localStorage', () => {
      localStorage.setItem(STORAGE_KEY, 'light');
      const service = createService();
      service.toggle();
      expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
    });

    it('system + OS dark → toggle sets light (not system)', () => {
      mockMatchMedia(true); // OS dark, no stored pref → system+dark
      const service = createService();
      service.toggle();
      expect(service.theme()).toBe('light');
    });

    it('system + OS light → toggle sets dark (not system)', () => {
      mockMatchMedia(false);
      const service = createService();
      service.toggle();
      expect(service.theme()).toBe('dark');
    });
  });

  // -------------------------------------------------------------------------
  // DOM effect — applies dark class to <html>
  // -------------------------------------------------------------------------

  describe('dark class effect', () => {
    it('adds dark class when isDark is true', () => {
      localStorage.setItem(STORAGE_KEY, 'dark');
      createService();
      TestBed.flushEffects();
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('does not add dark class when isDark is false', () => {
      localStorage.setItem(STORAGE_KEY, 'light');
      createService();
      TestBed.flushEffects();
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('updates dark class reactively on toggle', () => {
      localStorage.setItem(STORAGE_KEY, 'light');
      const service = createService();
      TestBed.flushEffects();
      expect(document.documentElement.classList.contains('dark')).toBe(false);

      service.toggle();
      TestBed.flushEffects();
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      service.toggle();
      TestBed.flushEffects();
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Cross-tab sync via storage event
  // -------------------------------------------------------------------------

  describe('cross-tab storage sync', () => {
    it('updates to dark when another tab stores dark', () => {
      const service = createService(); // theme = system
      expect(service.theme()).toBe('system');

      localStorage.setItem(STORAGE_KEY, 'dark'); // simulate other tab
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));

      expect(service.theme()).toBe('dark');
    });

    it('updates to light when another tab stores light', () => {
      localStorage.setItem(STORAGE_KEY, 'dark');
      const service = createService();

      localStorage.setItem(STORAGE_KEY, 'light');
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));

      expect(service.theme()).toBe('light');
    });

    it('ignores storage events for unrelated keys', () => {
      localStorage.setItem(STORAGE_KEY, 'dark');
      const service = createService();

      window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated-key' }));

      expect(service.theme()).toBe('dark');
    });
  });
});
