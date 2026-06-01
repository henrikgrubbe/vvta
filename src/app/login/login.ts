import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../auth.service';
import { LanguageSwitcherComponent } from '../language-switcher';
import { UserProfileService } from '../user-profile.service';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule, LanguageSwitcherComponent],
  templateUrl: './login.html',
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly profileService = inject(UserProfileService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

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
      this.error.set(
        err instanceof Error ? err.message : this.translate.instant('LOGIN.ERROR_GENERIC'),
      );
    } finally {
      this.loading.set(false);
    }
  }
}
