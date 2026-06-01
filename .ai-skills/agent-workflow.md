Agent workflow: branching, commits, and PRs

Purpose: keep a short, unambiguous checklist that automated agents and humans can follow when making changes to this repository.

## Rule summary
- Always start by understanding the skills present.
- Activate caveman mode.
- Always create a feature branch off `main` for a single logical feature or bugfix. Branch name format: `feature/<short-desc>` or `fix/<short-desc>`.
- Make small, focused commits. One logical unit per commit. Use Conventional Commits (e.g., `feat:`, `fix:`, `chore:`).
- Run formatting and linting locally before pushing. The repo exposes `npm run format` and `npm run lint` (see `package.json`).
- Open a Pull Request against `main` and reference related work. PR title should match the commit(s) intent and include a short description in the body.

## ⚠️ MANDATORY: Tests must be written for every code change

**This is non-negotiable.** Every PR that touches production code MUST include corresponding test updates. Skipping this is not acceptable under any circumstances.

### What to test

| Change type | Required |
|---|---|
| New component / feature | New unit test file (`*.spec.ts`) covering key behaviours |
| Modified component / template | Update existing spec to cover the changed behaviour |
| New/changed service method | Unit tests for the method |
| i18n translation files only | No test required |
| CSS / layout-only change | No unit test required (consider e2e if visual correctness matters) |

### How to run tests

```bash
npm test            # Vitest unit tests — run after every code change
npm run e2e         # Playwright e2e — run when user-visible behaviour changes
```

### Before opening a PR, confirm

1. `npm test` passes with no regressions
2. New or changed logic has at least one test that would fail if the logic were deleted
3. Spec changes are committed in the **same commit** as the source changes they cover

**If you touch source code and open a PR with zero test changes, you have not finished the task.**

---

## Minimal command recipe

1) Start from an up-to-date `main`:

```bash
git fetch origin --prune
git checkout main
git pull origin main
```

2) Create a feature branch:

```bash
git checkout -b feature/<short-desc>
```

3) Work in small commits. Example:

```bash
git add path/to/file1 path/to/file2
git commit -m "feat: add X feature" -m "Short bullets describing non-obvious details"
```

4) Keep the branch rebased onto main while working (optional but recommended):

```bash
git fetch origin
git rebase origin/main
# resolve conflicts if any, then continue
```

5) Before pushing:

```bash
npm install        # if package.json changed
npm run lint:fix   # Runs Prettier + ESLint fix (use this for all formatting)
npm run lint        # final check (CI will also run this)
npm test            # ALL tests must pass
```

6) Push branch and open PR:

```bash
git push --set-upstream origin feature/<short-desc>
# Create a PR via GitHub UI or the CLI:
gh pr create --base main --head feature/<short-desc> --title "feat: ..." --body-file pr-body.txt
```

## Agent-specific notes
- Agents MUST prefer creating branches from `origin/main` (not from other feature branches) so each PR contains only the intended changes.
- If a PR should contain *only* a single prior commit, agents should either:
  - reset the branch to `origin/main` and cherry-pick only the desired commit, or
  - create a fresh branch from `origin/main` and cherry-pick the commit there.
- Prefer using `--force-with-lease` when updating an existing branch remotely after rebasing/cherry-picking to avoid stomping others' work.
- When possible, run `gh pr create` to open PRs programmatically. Use the repository owner and default branch from `git remote show origin`.

## Why this matters
- Keeps PRs small and reviewable.
- Ensures CI tests run against a clean main + feature diff.
- Makes it easy for other agents (and humans) to rebase, cherry-pick, or backport changes.
- **Tests are the only way to know that code works and continues to work.**
