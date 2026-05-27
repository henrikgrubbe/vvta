import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../auth.service';
import { UserProfileService } from '../user-profile.service';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div class="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8 text-center shadow-md">
        <div>
          <span class="text-5xl" aria-hidden="true">🚴</span>
          <h1 class="mt-3 text-2xl font-bold text-gray-900">Vi viber til arbejde</h1>
          <p class="mt-1 text-sm text-gray-500">Log dine daglige cykelture til arbejde.</p>
        </div>

        @if (error()) {
          <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
            {{ error() }}
          </p>
        }

        <button
          class="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 focus:outline-2 focus:outline-offset-2 focus:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          [disabled]="loading()"
          (click)="signIn()"
          type="button"
          aria-label="Sign in with Google"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"
            />
          </svg>
          {{ loading() ? 'Signing in…' : 'Sign in with Google' }}
        </button>
      </div>
    </main>
  `,
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly profileService = inject(UserProfileService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async signIn(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const user = await this.authService.signInWithGoogle();
      const profile = await this.profileService.getProfile(user.uid);
      await this.router.navigateByUrl(profile ? '/' : '/onboarding');
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
