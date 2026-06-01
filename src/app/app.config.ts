import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, connectAuthEmulator, initializeAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

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

export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideHttpClient(), provideRouter(routes)],
};
