import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { filter, map, startWith } from 'rxjs';

import { AuthService } from '../auth.service';
import { LanguageSwitcherComponent } from '../language-switcher';
import { ThemeService } from '../theme.service';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, TranslateModule, LanguageSwitcherComponent],
  templateUrl: './shell.html',
})
export class ShellComponent {
  protected readonly themeService = inject(ThemeService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
  );

  protected readonly isOnOverview = computed(() => this.currentUrl() === '/');
  protected readonly isOnRides = computed(() => (this.currentUrl() ?? '').startsWith('/rides'));
  protected readonly isOnLeaderboard = computed(() =>
    (this.currentUrl() ?? '').startsWith('/leaderboard'),
  );

  protected async signOut(): Promise<void> {
    await this.authService.signOut();
    await this.router.navigateByUrl('/login');
  }
}
