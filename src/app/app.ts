import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {
  constructor() {
    if (environment.useEmulator) {
      const auth = getAuth();
      (
        window as Window & { __testSignIn?: (email: string, password: string) => Promise<void> }
      ).__testSignIn = (email, password) =>
        signInWithEmailAndPassword(auth, email, password).then(() => undefined);
    }
  }
}
