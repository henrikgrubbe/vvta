import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { AppLang, LANG_FLAGS, LanguageService, SUPPORTED_LANGS } from './language.service';

@Component({
  selector: 'app-language-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule],
  template: `
    <button
      class="rounded px-1.5 py-0.5 text-xl leading-none hover:bg-gray-100 focus:outline-2 focus:outline-offset-2 focus:outline-blue-500 dark:hover:bg-gray-700"
      [attr.aria-label]="'NAV.SWITCH_LANG' | translate"
      (click)="toggle()"
      type="button"
    >
      {{ nextFlag() }}
    </button>
  `,
})
export class LanguageSwitcherComponent {
  protected readonly languageService = inject(LanguageService);

  protected readonly nextLang = computed<AppLang>(() => {
    const current = this.languageService.currentLang();
    return SUPPORTED_LANGS.find((l): l is AppLang => l !== current) ?? 'en';
  });

  protected readonly nextFlag = computed(() => LANG_FLAGS[this.nextLang()]);

  protected toggle(): void {
    this.languageService.setLang(this.nextLang());
  }
}
