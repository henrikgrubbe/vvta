import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Auth, signInWithEmailAndPassword } from '@angular/fire/auth';
import { inject } from '@angular/core';
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
      const auth = inject(Auth);
      (window as Window & { __testSignIn?: (email: string, password: string) => Promise<void> }).__testSignIn =
        (email, password) => signInWithEmailAndPassword(auth, email, password).then(() => undefined);
    }
  }
}
