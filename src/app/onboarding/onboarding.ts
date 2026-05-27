import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

import { UserProfileService } from '../user-profile.service';

@Component({
  selector: 'app-onboarding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div class="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8 shadow-md">
        <div class="text-center">
          <span class="text-5xl" aria-hidden="true">👋</span>
          <h1 class="mt-3 text-2xl font-bold text-gray-900">Welcome!</h1>
          <p class="mt-1 text-sm text-gray-500">Just one thing before we start…</p>
        </div>

        <form (submit)="save(); $event.preventDefault()" novalidate class="space-y-4">
          <div>
            <label for="first-name" class="mb-1 block text-sm font-medium text-gray-700">
              What's your first name?
            </label>
            <input
              id="first-name"
              type="text"
              autocomplete="given-name"
              [value]="firstName()"
              (input)="firstName.set($any($event.target).value)"
              placeholder="e.g. Anders"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-2 focus:outline-blue-500"
              [attr.aria-invalid]="touched() && !firstName().trim() ? 'true' : null"
              [attr.aria-describedby]="touched() && !firstName().trim() ? 'name-error' : null"
            />
            @if (touched() && !firstName().trim()) {
              <p id="name-error" class="mt-1 text-sm text-red-600" role="alert">
                Please enter your first name.
              </p>
            }
          </div>

          @if (error()) {
            <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
              {{ error() }}
            </p>
          }

          <button
            type="submit"
            [disabled]="saving()"
            class="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 focus:outline-2 focus:outline-offset-2 focus:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{ saving() ? 'Saving…' : 'Get started 🚴' }}
          </button>
        </form>
      </div>
    </main>
  `,
})
export class OnboardingComponent {
  private readonly auth = getAuth();
  private readonly profileService = inject(UserProfileService);
  private readonly router = inject(Router);

  readonly firstName = signal('');
  readonly touched = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  async save(): Promise<void> {
    this.touched.set(true);
    if (!this.firstName().trim()) return;

    this.saving.set(true);
    this.error.set(null);
    try {
      const user = await this.getCurrentUser();
      if (!user) {
        await this.router.navigateByUrl('/login');
        return;
      }
      await this.profileService.saveProfile({
        uid: user.uid,
        firstName: this.firstName().trim(),
        email: user.email ?? '',
      });
      await this.router.navigateByUrl('/');
    } catch (err: unknown) {
      this.error.set(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  private getCurrentUser(): Promise<{ uid: string; email: string | null } | null> {
    return new Promise((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(
        this.auth,
        (user) => {
          unsubscribe();
          resolve(user ? { uid: user.uid, email: user.email } : null);
        },
        reject,
      );
    });
  }
}
