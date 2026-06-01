import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { AppLang, LanguageService, SUPPORTED_LANGS } from './language.service';

@Component({
  selector: 'app-language-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule],
  template: `
    <button
      class="rounded px-1.5 py-0.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-2 focus:outline-offset-2 focus:outline-blue-500 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
      [attr.aria-label]="'NAV.SWITCH_LANG' | translate"
      (click)="toggle()"
      type="button"
    >
      {{ languageService.currentLang().toUpperCase() }}
    </button>
  `,
})
export class LanguageSwitcherComponent {
  protected readonly languageService = inject(LanguageService);

  protected toggle(): void {
    const current = this.languageService.currentLang();
    const next = SUPPORTED_LANGS.find((l): l is AppLang => l !== current) ?? 'en';
    this.languageService.setLang(next);
  }
}
