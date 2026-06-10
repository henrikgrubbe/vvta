import {
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { firstValueFrom } from 'rxjs';

import { LanguageService } from './language.service';

export function provideTranslate(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideTranslateService({
      fallbackLang: 'en',
    }),
    provideTranslateHttpLoader({ prefix: '/assets/i18n/', suffix: '.json' }),
    provideAppInitializer(() => {
      const translate = inject(TranslateService);
      inject(LanguageService); // eagerly instantiate to wire onLangChange → title + storage
      return firstValueFrom(translate.use(LanguageService.getPersistedLang()));
    }),
  ]);
}
