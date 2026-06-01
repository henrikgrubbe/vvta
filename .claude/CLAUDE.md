
You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Prefer inline templates for small components
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection

## Dark Mode System

Dark mode is implemented via `src/app/theme.service.ts` using Tailwind CSS 4's class-based dark variant.

### How it works

- **Tailwind config** (`src/styles.css`): `@custom-variant dark (&:where(.dark, .dark *))` — dark styles activate when `<html>` has class `dark`.
- **FOUC prevention** (`src/index.html`): inline `<script>` in `<head>` applies `.dark` to `<html>` before Angular boots, reading localStorage then OS preference.
- **ThemeService** (`src/app/theme.service.ts`):
  - Tri-state preference: `'system' | 'light' | 'dark'` — avoids overwriting OS-inferred preference on first load.
  - `isDark = computed(...)` derives effective dark state from theme + systemDark signals.
  - `toggle()` writes explicit `'light'` or `'dark'` to `localStorage`.
  - Listens to `matchMedia` changes (OS preference) and `storage` events (cross-tab sync).
  - `AppComponent` injects `ThemeService` early so it initialises for all routes (including login/onboarding which have no toggle button).
- **`color-scheme` CSS** (`src/styles.css`): applied so native controls (date picker, scrollbars, autofill) also switch to dark.

### Toggle button pattern

Both `bike-log.html` and `leaderboard.html` include the toggle in their nav:

```html
<button
  (click)="themeService.toggle()"
  type="button"
  [attr.aria-label]="themeService.isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
  [attr.aria-pressed]="themeService.isDark()"
>
  <span class="material-symbols-outlined">{{ themeService.isDark() ? 'light_mode' : 'dark_mode' }}</span>
</button>
```

The component must expose `readonly themeService = inject(ThemeService)`.

### Testing dark mode

**Vitest (`src/app/theme.service.spec.ts`):**
- `window.matchMedia` is not implemented in jsdom — mock it with `vi.stubGlobal('matchMedia', vi.fn().mockImplementation(...))` before `TestBed.inject(ThemeService)`.
- Use the real jsdom `localStorage` (just `localStorage.clear()` in `beforeEach`).
- Use `TestBed.flushEffects()` to synchronously run the DOM class effect.
- Storage event cross-tab sync: update `localStorage` then `window.dispatchEvent(new StorageEvent('storage', { key: 'theme' }))`.

**Playwright (`e2e/dark-mode.spec.ts`):**
- `page.emulateMedia({ colorScheme: 'dark' })` **before** `page.goto` — the inline FOUC script reads `matchMedia` during HTML parsing.
- Inject theme via `page.addInitScript` (runs before all page scripts, including the inline FOUC script).
- Clear stored preference per-test: `localStorage.removeItem('theme')` inside `addInitScript`.
- Assert with `expect(page.locator('html')).toHaveClass(/dark/)`.
- Toggle button selectors: `button[aria-label="Switch to dark mode"]` (light mode) / `button[aria-label="Switch to light mode"]` (dark mode).
- Use `test.describe.configure({ mode: 'serial' })` to prevent parallel workers from stomping localStorage state.
