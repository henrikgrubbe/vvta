You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## Agent Efficiency

- **Read files once.** If a file is already in context, do not re-read it.
- **Batch tool calls.** Run independent reads/searches in parallel; never make sequential calls when parallel is possible.
- **Targeted searches only.** Use `grep_search` for known symbol names; use `semantic_search` only when the location is unknown. Never search the whole codebase for something already documented here.
- **Edit, don't rewrite.** Use `replace_string_in_file` with minimal context — avoid echoing back entire files.
- **No confirmation steps.** Don't ask "shall I proceed?" — just act. Ask only when information is genuinely missing.
- **Skip obvious explanations.** Don't narrate what you're about to do before doing it; explain only non-obvious decisions after the fact.
- **One commit per logical unit.** Don't batch unrelated changes just to reduce commit count, but don't make a commit per line either.

## Project Overview

Bike commute logging app ("Vi viber til arbejde") built with Angular 21, Firebase/Firestore, and Tailwind CSS 4. Single-feature app that tracks daily bicycle rides with auto weather detection via Open-Meteo API.

## Tech Stack

- **Framework:** Angular 21 (standalone components, signal-based forms)
- **Styling:** Tailwind CSS 4 (`@import 'tailwindcss'` in `src/styles.css`)
- **Backend:** Firebase Firestore (`@angular/fire`) — collection: `bike-entries`
- **Weather API:** Open-Meteo (archive + forecast endpoints, no API key needed)
- **Unit Tests:** Vitest via `@angular/build:unit-test`
- **E2E Tests:** Playwright (Chromium only, `e2e/` directory)
- **Formatter:** Prettier

## Commands

| Action | Command |
|---|---|
| Dev server | `npm start` (port 4200) |
| Build | `npm run build` |
| Unit tests | `npm test` |
| E2E tests | `npm run e2e` (auto-starts dev server) |
| Deploy | `firebase deploy` (builds to `dist/vvta/browser`) |

## Project Structure

```
src/app/
  app.ts                  # Root component (router-outlet only)
  app.config.ts           # Providers: router, HttpClient, Firebase
  app.routes.ts           # Top-level routes (lazy-loads feature routes)
  bike-log/
    bike-log.ts           # Main feature component + BikeEntry interface
    bike-log.html         # External template (Tailwind utility classes)
    bike-log.routes.ts    # Feature routes (default export, lazy loadComponent)
    bike-log.service.ts   # Firestore CRUD for bike-entries collection
    weather.service.ts    # Open-Meteo API (wasRaining check for Aarhus)
src/environments/
  environment.ts          # Firebase config
```

## Git Workflow

- **Always commit changes** as you go — after each logical unit of work, not all at once at the end
- Use [Conventional Commits](https://www.conventionalcommits.org/) format: `type: short summary`
  - `feat:` — new feature or behaviour
  - `fix:` — bug fix
  - `chore:` — tooling, config, deps (no production code change)
  - `docs:` — documentation only
  - `refactor:` — code change with no behaviour change
  - `test:` — adding or updating tests
- Keep the subject line short (≤72 chars); add a body with bullet points for non-obvious context
- Stage related files together in a single commit; don't mix unrelated changes
- Example: `git add src/environments/environment.ts && git commit -m "chore: migrate to vvta-bike-log Firebase project"`

## Key Patterns

### File Naming

Components use short `.ts` filenames (not `.component.ts`): `bike-log.ts` containing `BikeLogComponent`. Routes are `*.routes.ts` with default exports.

### Feature Routing

Features are lazy-loaded at two levels — `loadChildren` in `app.routes.ts`, then `loadComponent` in feature routes:
```typescript
// app.routes.ts
{ path: '', loadChildren: () => import('./bike-log/bike-log.routes') }

// bike-log/bike-log.routes.ts
{ path: '', loadComponent: () => import('./bike-log').then(m => m.BikeLogComponent) }
export default routes;
```

### Signal-Based Forms

Uses `@angular/forms/signals` (`form()`, `FormField`, `submit()`, `required()`, `min()`). See `bike-log.ts` for the pattern with `rideModel` signal + `rideForm` derived from it.

### Service Pattern

Services use `inject()` function, `providedIn: 'root'`, and AngularFire's `collectionData`/`addDoc`/`updateDoc`/`deleteDoc`. See `bike-log.service.ts`.

### Testing

- **Unit tests** (`*.spec.ts` alongside source): Use Vitest (`vi.spyOn`), `TestBed`, `provideHttpClientTesting`. Mock Firestore services with `BehaviorSubject`. Flush weather HTTP requests with `httpMock.match()`. See `bike-log.spec.ts` for the full pattern.
- **E2E tests** (`e2e/*.spec.ts`): Playwright tests with helper functions. Dev server auto-starts via `playwright.config.ts`. Target `localhost:4200`.

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
