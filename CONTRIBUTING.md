# Contributing

## Branching & Pull Requests

The **main branch is protected**. All changes must go through pull requests:

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** and commit using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` — new feature or behaviour
   - `fix:` — bug fix
   - `chore:` — tooling, config, deps (no production code change)
   - `docs:` — documentation only
   - `refactor:` — code change with no behaviour change
   - `test:` — adding or updating tests
   - `style:` — formatting/style changes

   Example:
   ```bash
   git commit -m "feat: add email notifications for bike rides"
   ```

3. **Push your branch** to GitHub:
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Open a pull request** and request review. CI will automatically:
   - Run `npm run lint`
   - Run `npm test` (unit tests)
   - Run `npm run e2e` (E2E tests)
   - Deploy a live preview (when merged to main via `firebase deploy`)

## Code Quality

- **Linting**: `npm run lint` — fixes style issues automatically where possible
- **Unit tests**: `npm test` — must pass before PR can be merged
- **E2E tests**: `npm run e2e` — runs with Firebase emulator, must pass before merge
- **Type safety**: TypeScript strict mode enabled; avoid `any` types

## Development Server

```bash
npm start
```

Opens `http://localhost:4200/` and auto-reloads on file changes.

## Building

```bash
npm run build
```

Produces optimized production build in `dist/vvta/browser/`.

## Testing

- **Unit**: `npm test` — Vitest, runs on file changes
- **E2E**: `npm run e2e` — Playwright with Firebase emulator
- **UI mode**: `npm run e2e:ui` — interactive Playwright debugger

## Git Workflow

- **Always commit as you go** — one logical unit per commit, not all at once at the end
- **Keep commits focused** — don't mix unrelated changes in a single commit
- **Write clear commit messages** — follow Conventional Commits format for automatic versioning

