import { EnvironmentProviders, inject, provideAppInitializer, Provider } from '@angular/core';
import {
  provideTranslateService,
  TranslateLoader,
  TranslateService,
  TranslationObject,
} from '@ngx-translate/core';
import { firstValueFrom, Observable, of } from 'rxjs';

import enTranslations from '../../../public/assets/i18n/en.json';

class StaticTranslateLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<TranslationObject> {
    return of(lang === 'en' ? (enTranslations as unknown as TranslationObject) : {});
  }
}

/** Provides ngx-translate with synchronous English translations for unit tests. */
export function provideTranslateTesting(): (Provider | EnvironmentProviders)[] {
  return [
    ...provideTranslateService({
      loader: { provide: TranslateLoader, useClass: StaticTranslateLoader },
      fallbackLang: 'en',
    }),
    provideAppInitializer(() => {
      const translate = inject(TranslateService);
      return firstValueFrom(translate.use('en'));
    }),
  ];
}
