import { HttpClient } from '@angular/common/http';
import {
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import {
  TranslateLoader,
  TranslateModule,
  TranslateService,
  TranslationObject,
} from '@ngx-translate/core';
import { firstValueFrom, Observable, tap } from 'rxjs';

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
      const title = inject(Title);
      return firstValueFrom(
        translate
          .use(navigator.language.split('-')[0])
          .pipe(tap(() => title.setTitle(translate.instant('APP.TITLE')))),
      );
    }),
  ]);
}
