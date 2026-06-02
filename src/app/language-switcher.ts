import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { AppLang, LANG_FLAGS, LanguageService, SUPPORTED_LANGS } from './language.service';

@Component({
  selector: 'app-language-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule],
  templateUrl: './language-switcher.html',
})
export class LanguageSwitcherComponent {
  protected readonly languageService = inject(LanguageService);

  protected readonly nextLang = computed<AppLang>(() => {
    const current = this.languageService.currentLang();
    const idx = SUPPORTED_LANGS.indexOf(current);
    return SUPPORTED_LANGS[(idx + 1) % SUPPORTED_LANGS.length];
  });

  protected readonly nextFlag = computed(() => LANG_FLAGS[this.nextLang()]);

  protected toggle(): void {
    this.languageService.setLang(this.nextLang());
  }
}
