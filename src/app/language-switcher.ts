import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { AppLang, LANG_FLAGS, LanguageService, SUPPORTED_LANGS } from './language.service';

const LANG_NAMES: Record<AppLang, string> = {
  en: 'English',
  da: 'Dansk',
  de: 'Deutsch',
};

@Component({
  selector: 'app-language-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule],
  templateUrl: './language-switcher.html',
})
export class LanguageSwitcherComponent {
  protected readonly languageService = inject(LanguageService);
  protected readonly langs = SUPPORTED_LANGS;
  protected readonly flags = LANG_FLAGS;
  protected readonly names = LANG_NAMES;

  protected onChange(event: Event): void {
    const lang = (event.target as HTMLSelectElement).value as AppLang;
    this.languageService.setLang(lang);
  }
}
