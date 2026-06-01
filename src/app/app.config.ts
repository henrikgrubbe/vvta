import { HttpClient, provideHttpClient } from '@angular/common/http';
import {
  APP_INITIALIZER,
  ApplicationConfig,
  importProvidersFrom,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  TranslateLoader,
  TranslateModule,
  TranslateService,
  TranslationObject,
} from '@ngx-translate/core';
import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, connectAuthEmulator, initializeAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { firstValueFrom, Observable } from 'rxjs';

import { environment } from '../environments/environment';
import { routes } from './app.routes';

// Initialize Firebase app on module load
const app = initializeApp(environment.firebase);
const firestore = getFirestore(app);

if (environment.useEmulator) {
  const auth = initializeAuth(app, { persistence: [browserLocalPersistence] });
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099');
}

export class CustomTranslateLoader implements TranslateLoader {
  constructor(private readonly http: HttpClient) {}

  getTranslation(lang: string): Observable<TranslationObject> {
    return this.http.get<TranslationObject>(`/assets/i18n/${lang}.json`);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(routes),
    importProvidersFrom(
      TranslateModule.forRoot({
        loader: {
          provide: TranslateLoader,
          useFactory: (http: HttpClient) => new CustomTranslateLoader(http),
          deps: [HttpClient],
        },
        fallbackLang: 'en',
      }),
    ),
    {
      provide: APP_INITIALIZER,
      useFactory: (translate: TranslateService) => () => {
        translate.setDefaultLang('en');
        return firstValueFrom(translate.use('en'));
      },
      deps: [TranslateService],
      multi: true,
    },
  ],
};
