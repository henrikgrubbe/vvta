import { importProvidersFrom } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LanguageService, resolveAppLang } from './language.service';
import { provideTranslateTesting } from './testing/translate-testing';

function createServiceMinimal(): LanguageService {
  TestBed.configureTestingModule({
    providers: [importProvidersFrom(TranslateModule.forRoot())],
  });
  return TestBed.inject(LanguageService);
}

describe('LanguageService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // resolveAppLang()
  // ---------------------------------------------------------------------------

  describe('resolveAppLang()', () => {
    it('returns a supported lang as-is', () => {
      expect(resolveAppLang('da')).toBe('da');
      expect(resolveAppLang('de')).toBe('de');
      expect(resolveAppLang('en')).toBe('en');
      expect(resolveAppLang('sv')).toBe('sv');
      expect(resolveAppLang('fr')).toBe('fr');
      expect(resolveAppLang('ro')).toBe('ro');
    });

    it('falls back to "en" for unsupported languages', () => {
      expect(resolveAppLang('ja')).toBe('en');
      expect(resolveAppLang('')).toBe('en');
      expect(resolveAppLang('zz')).toBe('en');
    });
  });

  // ---------------------------------------------------------------------------
  // getPersistedLang()
  // ---------------------------------------------------------------------------

  describe('getPersistedLang()', () => {
    it('returns the lang stored in localStorage', () => {
      localStorage.setItem('lang', 'da');
      expect(LanguageService.getPersistedLang()).toBe('da');
    });

    it('returns "de" when localStorage has "de"', () => {
      localStorage.setItem('lang', 'de');
      expect(LanguageService.getPersistedLang()).toBe('de');
    });

    it('falls back to navigator.language when nothing is stored', () => {
      vi.spyOn(navigator, 'language', 'get').mockReturnValue('da-DK');
      expect(LanguageService.getPersistedLang()).toBe('da');
    });

    it('falls back to "en" for unsupported navigator.language', () => {
      vi.spyOn(navigator, 'language', 'get').mockReturnValue('ja-JP');
      expect(LanguageService.getPersistedLang()).toBe('en');
    });

    it('falls back to "en" for unsupported stored value', () => {
      localStorage.setItem('lang', 'ja');
      expect(LanguageService.getPersistedLang()).toBe('en');
    });
  });

  // ---------------------------------------------------------------------------
  // currentLang signal initialization
  // ---------------------------------------------------------------------------

  describe('currentLang signal initialization', () => {
    it('initializes with the persisted language from localStorage', () => {
      localStorage.setItem('lang', 'da');
      const service = createServiceMinimal();
      expect(service.currentLang()).toBe('da');
    });

    it('initializes with "de" when localStorage has "de"', () => {
      localStorage.setItem('lang', 'de');
      const service = createServiceMinimal();
      expect(service.currentLang()).toBe('de');
    });

    it('defaults to navigator language when no lang is stored', () => {
      vi.spyOn(navigator, 'language', 'get').mockReturnValue('da-DK');
      const service = createServiceMinimal();
      expect(service.currentLang()).toBe('da');
    });
  });

  // ---------------------------------------------------------------------------
  // setLang() — updates signal via onLangChange
  // ---------------------------------------------------------------------------

  describe('setLang()', () => {
    beforeEach(async () => {
      await TestBed.configureTestingModule({
        providers: [...provideTranslateTesting()],
      }).compileComponents();
    });

    it('updates currentLang signal when a new language is set', () => {
      const service = TestBed.inject(LanguageService);
      service.setLang('de');
      expect(service.currentLang()).toBe('de');
    });

    it('persists the chosen language to localStorage', () => {
      const service = TestBed.inject(LanguageService);
      service.setLang('da');
      expect(localStorage.getItem('lang')).toBe('da');
    });
  });
});
