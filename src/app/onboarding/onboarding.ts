import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

import { LanguageSwitcherComponent } from '../language-switcher';
import { UserProfileService } from '../user-profile.service';

@Component({
  selector: 'app-onboarding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule, LanguageSwitcherComponent],
  templateUrl: './onboarding.html',
})
export class OnboardingComponent {
  private readonly auth = getAuth();
  private readonly profileService = inject(UserProfileService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  readonly firstName = signal(this.auth.currentUser?.displayName?.split(' ')[0] ?? '');
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
        err instanceof Error ? err.message : this.translate.instant('ONBOARDING.ERROR_GENERIC'),
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
