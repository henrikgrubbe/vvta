import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { linkedSignal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { TranslatePipe } from '@ngx-translate/core';

import { AppLang, LANG_FLAGS, LanguageService, SUPPORTED_LANGS } from './language.service';

export const LANG_NAMES: Record<AppLang, string> = {
  en: 'English',
  da: 'Dansk',
  de: 'Deutsch',
  sv: 'Svenska',
  fr: 'Français',
  ro: 'Română',
};

@Component({
  selector: 'app-language-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, TranslatePipe],
  templateUrl: './language-switcher.html',
})
export class LanguageSwitcherComponent {
  protected readonly languageService = inject(LanguageService);
  protected readonly langs = SUPPORTED_LANGS;
  protected readonly flags = LANG_FLAGS;
  protected readonly names = LANG_NAMES;

  // linkedSignal keeps the form model in sync when currentLang changes externally
  private readonly langModel = linkedSignal(() => ({ lang: this.languageService.currentLang() }));
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  protected readonly langForm = form(this.langModel, () => {});

  protected onChange(event: Event): void {
    const lang = (event.target as HTMLSelectElement).value as AppLang;
    this.languageService.setLang(lang);
  }
}
