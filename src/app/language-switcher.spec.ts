import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { LanguageService, SUPPORTED_LANGS } from './language.service';
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

  it('renders a select element', () => {
    const select = fixture.debugElement.query(By.css('select'));
    expect(select).toBeTruthy();
  });

  it('shows an option for every supported language', () => {
    const options: NodeListOf<HTMLOptionElement> = fixture.nativeElement.querySelectorAll('option');
    expect(options.length).toBe(SUPPORTED_LANGS.length);
  });

  it('reflects the current language as the selected value', () => {
    languageService.setLang('da');
    fixture.detectChanges();

    const select: HTMLSelectElement = fixture.debugElement.query(By.css('select')).nativeElement;
    expect(select.value).toBe('da');
  });

  it('calls setLang when the user picks a different language', () => {
    languageService.setLang('en');
    fixture.detectChanges();

    const select: HTMLSelectElement = fixture.debugElement.query(By.css('select')).nativeElement;
    select.value = 'de';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(languageService.currentLang()).toBe('de');
  });

  it('has a visible label for screen readers', () => {
    const label: HTMLLabelElement = fixture.debugElement.query(By.css('label')).nativeElement;
    expect(label.classList.contains('sr-only')).toBe(true);
    expect(label.htmlFor).toBe('lang-select');
  });
});
