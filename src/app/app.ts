import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

import { environment } from '../environments/environment';
import { ThemeService } from './theme.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  templateUrl: './app.html',
})
export class App {
  constructor() {
    inject(ThemeService); // ensure initialized for all routes
    if (environment.useEmulator) {
      const auth = getAuth();
      (
        window as Window & { __testSignIn?: (email: string, password: string) => Promise<void> }
      ).__testSignIn = (email, password) =>
        signInWithEmailAndPassword(auth, email, password).then(() => undefined);
    }
  }
}
