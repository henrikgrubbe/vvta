
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

## Project Features

Key routes and features agents must be aware of to avoid regressions:

| Route | Component | Auth | Description |
|-------|-----------|------|-------------|
| `/` | `OverviewComponent` | Required (profile) | Personalised home with ride stats and nav cards |
| `/rides` | `BikeLogComponent` | Required (profile) | Add/edit/delete rides; auto weather detection |
| `/leaderboard` | `LeaderboardComponent` | Required (profile) | All-user ranking by total km |
| `/login` | `LoginComponent` | None | Google Sign-In |
| `/onboarding` | `OnboardingComponent` | Signed-in, no profile | First-name entry |
| `/snake` | `SnakeComponent` | None | Cycling-themed Snake easter egg (see below) |

### Snake easter egg (`/snake`)

- Triggered by typing `--snake` anywhere in the app — a rolling 7-char buffer in `App.onGlobalKeyDown` matches the sequence and calls `router.navigateByUrl('/snake')`
- Lazy-loaded at `src/app/snake/`; no auth guard
- 20×20 grid board, signals-only state, `setInterval` game loop
- 🚴 head (CSS rotate with direction), 🚲 food, green body
- Controls: Arrow/WASD · Space pause/resume · Esc → `/`
- Speed: starts 150 ms/tick, decreases 5 ms per food eaten, floor 80 ms
- i18n keys live under `SNAKE.*` in all three translation files (`public/assets/i18n/`)
- **Do not remove** the `/snake` route or the `--snake` key listener — the issue requesting this feature was explicitly accepted
