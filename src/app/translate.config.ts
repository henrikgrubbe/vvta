import { HttpClient } from '@angular/common/http';
import {
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import {
  TranslateLoader,
  TranslateModule,
  TranslateService,
  TranslationObject,
} from '@ngx-translate/core';
import { firstValueFrom, Observable } from 'rxjs';

import { LanguageService } from './language.service';

class HttpTranslateLoader implements TranslateLoader {
  private readonly http = inject(HttpClient);

  getTranslation(lang: string): Observable<TranslationObject> {
    return this.http.get<TranslationObject>(`/assets/i18n/${lang}.json`);
  }
}

export function provideTranslate(): EnvironmentProviders {
  return makeEnvironmentProviders([
    TranslateModule.forRoot({
      loader: { provide: TranslateLoader, useClass: HttpTranslateLoader },
      fallbackLang: 'en',
    }).providers ?? [],
    provideAppInitializer(() => {
      const translate = inject(TranslateService);
      inject(LanguageService); // eagerly instantiate to wire onLangChange → title + storage
      return firstValueFrom(translate.use(LanguageService.getPersistedLang()));
    }),
  ]);
}
