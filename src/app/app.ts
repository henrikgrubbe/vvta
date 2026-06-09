import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

import { environment } from '../environments/environment';
import { ThemeService } from './theme.service';

const SNAKE_SEQUENCE = '--snake';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  host: {
    '(document:keydown)': 'onGlobalKeyDown($event)',
  },
})
export class App {
  private readonly router = inject(Router);
  private keyBuffer = '';

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

  onGlobalKeyDown(event: KeyboardEvent): void {
    if (this.router.url.startsWith('/snake')) return;
    this.keyBuffer = (this.keyBuffer + event.key).slice(-SNAKE_SEQUENCE.length);
    if (this.keyBuffer === SNAKE_SEQUENCE) {
      this.keyBuffer = '';
      this.router.navigateByUrl('/snake');
    }
  }
}
