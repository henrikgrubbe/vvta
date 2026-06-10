import { ChangeDetectionStrategy, Component, inject, NgZone, OnDestroy } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

import { environment } from '../environments/environment';
import { ThemeService } from './theme.service';

const SNAKE_SEQUENCE = '--snake';
const IDLE_TIMEOUT_MS = 20_000;

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  host: {
    '(document:keydown)': 'onGlobalKeyDown($event)',
    '(document:mousemove)': 'resetIdleTimer()',
    '(document:click)': 'resetIdleTimer()',
    '(document:touchstart)': 'resetIdleTimer()',
    '(document:scroll)': 'resetIdleTimer()',
  },
})
export class App implements OnDestroy {
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private keyBuffer = '';
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(ThemeService); // ensure initialized for all routes
    if (environment.useEmulator) {
      const auth = getAuth();
      (
        window as Window & { __testSignIn?: (email: string, password: string) => Promise<void> }
      ).__testSignIn = (email, password) =>
        signInWithEmailAndPassword(auth, email, password).then(() => undefined);
    }
    this.resetIdleTimer();
  }

  onGlobalKeyDown(event: KeyboardEvent): void {
    this.resetIdleTimer();
    if (this.router.url.startsWith('/snake')) return;
    this.keyBuffer = (this.keyBuffer + event.key).slice(-SNAKE_SEQUENCE.length);
    if (this.keyBuffer === SNAKE_SEQUENCE) {
      this.keyBuffer = '';
      this.router.navigateByUrl('/snake');
    }
  }

  resetIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
    }
    // Run timer outside Angular zone to avoid triggering change detection every 20s
    this.zone.runOutsideAngular(() => {
      this.idleTimer = setTimeout(() => {
        if (!this.router.url.startsWith('/snake')) {
          this.zone.run(() => this.router.navigateByUrl('/snake'));
        }
      }, IDLE_TIMEOUT_MS);
    });
  }

  ngOnDestroy(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
    }
  }
}
