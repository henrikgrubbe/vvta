import { inject, Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly translate = inject(TranslateService);

  constructor() {
    this.translate.setDefaultLang('en');
    this.translate.use('en');
  }

  get(key: string): string {
    return this.translate.instant(key);
  }

  getText(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }
}


