import { inject, Injectable, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';

export const SUPPORTED_LANGS = ['en', 'da'] as const;
export type AppLang = (typeof SUPPORTED_LANGS)[number];

export const LANG_FLAGS: Record<AppLang, string> = {
  en: '🇬🇧',
  da: '🇩🇰',
};

const LANG_STORAGE_KEY = 'lang';

export function resolveAppLang(lang: string): AppLang {
  return SUPPORTED_LANGS.includes(lang as AppLang) ? (lang as AppLang) : 'en';
}

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly titleService = inject(Title);

  readonly currentLang = signal<AppLang>(resolveAppLang(this.translate.currentLang ?? 'en'));

  constructor() {
    this.translate.onLangChange.subscribe(({ lang }) => {
      const appLang = resolveAppLang(lang);
      this.currentLang.set(appLang);
      localStorage.setItem(LANG_STORAGE_KEY, appLang);
      this.titleService.setTitle(this.translate.instant('APP.TITLE'));
    });
  }

  setLang(lang: AppLang): void {
    this.translate.use(lang);
  }

  static getPersistedLang(): AppLang {
    return resolveAppLang(
      localStorage.getItem(LANG_STORAGE_KEY) ?? navigator.language.split('-')[0],
    );
  }
}
