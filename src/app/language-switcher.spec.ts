import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { LANG_FLAGS, LanguageService } from './language.service';
import { LanguageSwitcherComponent } from './language-switcher';
import { provideTranslateTesting } from './testing/translate-testing';

describe('LanguageSwitcherComponent', () => {
  let fixture: ComponentFixture<LanguageSwitcherComponent>;
  let languageService: LanguageService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LanguageSwitcherComponent],
      providers: [...provideTranslateTesting()],
    }).compileComponents();

    languageService = TestBed.inject(LanguageService);
    fixture = TestBed.createComponent(LanguageSwitcherComponent);
    fixture.detectChanges();
  });

  it('shows the flag of the next language (da flag when current is en)', () => {
    languageService.setLang('en');
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.debugElement.query(By.css('button')).nativeElement;
    expect(button.textContent?.trim()).toBe(LANG_FLAGS['da']);
  });

  it('shows the flag of the next language (en flag when current is da)', () => {
    languageService.setLang('da');
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.debugElement.query(By.css('button')).nativeElement;
    expect(button.textContent?.trim()).toBe(LANG_FLAGS['en']);
  });

  it('toggles language on click', () => {
    languageService.setLang('en');
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.debugElement.query(By.css('button')).nativeElement;
    button.click();
    fixture.detectChanges();

    expect(languageService.currentLang()).toBe('da');
  });

  it('toggles back on second click', () => {
    languageService.setLang('en');
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.debugElement.query(By.css('button')).nativeElement;
    button.click();
    fixture.detectChanges();
    button.click();
    fixture.detectChanges();

    expect(languageService.currentLang()).toBe('en');
  });

  it('has an aria-label', () => {
    const button: HTMLButtonElement = fixture.debugElement.query(By.css('button')).nativeElement;
    expect(button.getAttribute('aria-label')).toBeTruthy();
  });
});
