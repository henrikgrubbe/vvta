import { expect, test } from '@playwright/test';

import {
  type AuthState,
  createUserProfile,
  deleteUserProfile,
  injectPageState,
  signUpOrSignIn,
} from './test-utils';

const DARK_TEST_EMAIL = 'dark-test@test.com';

// ============================================================================
// Unauthenticated pages (login / onboarding)
// ============================================================================

test.describe('Dark mode — unauthenticated pages', () => {
  test.describe.configure({ mode: 'serial' });

  test('login page: no dark class by default (OS light)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await injectPageState(page, null); // no auth, no stored theme
    await page.goto('/');
    await page.waitForURL('/login');

    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('login page: dark class when OS prefers dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await injectPageState(page, null); // no stored override
    await page.goto('/');
    await page.waitForURL('/login');

    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('login page: dark class when localStorage preference is dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' }); // OS says light but explicit pref wins
    await injectPageState(page, null, 'dark');
    await page.goto('/');
    await page.waitForURL('/login');

    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('login page: no dark class when localStorage preference is light', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' }); // OS says dark but explicit pref wins
    await injectPageState(page, null, 'light');
    await page.goto('/');
    await page.waitForURL('/login');

    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });
});

// ============================================================================
// Authenticated pages (bike-log + leaderboard)
// ============================================================================

let sharedAuth: AuthState | null = null;

test.describe('Dark mode — main app', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    const password = 'testpassword123';
    const { uid, idToken, refreshToken } = await signUpOrSignIn(DARK_TEST_EMAIL, password);
    await deleteUserProfile(uid);
    await createUserProfile(uid, 'DarkTester', DARK_TEST_EMAIL);
    sharedAuth = { uid, email: DARK_TEST_EMAIL, idToken, refreshToken };
  });

  test.afterAll(async () => {
    if (sharedAuth) await deleteUserProfile(sharedAuth.uid);
  });

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' }); // start with OS light for predictability
    await injectPageState(page, sharedAuth!); // no stored theme preference
    await page.goto('/');
    await page.waitForURL('/');
  });

  // Toggle button — bike-log
  test('toggle button is visible in bike-log nav', async ({ page }) => {
    const toggle = page.locator('button[aria-label="Switch to dark mode"]');
    await expect(toggle).toBeVisible();
  });

  test('toggle button aria-pressed is false in light mode', async ({ page }) => {
    const toggle = page.locator('button[aria-label="Switch to dark mode"]');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  test('toggle click applies dark class to html element', async ({ page }) => {
    await page.locator('button[aria-label="Switch to dark mode"]').click();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('toggle click updates aria attributes to reflect dark mode', async ({ page }) => {
    await page.locator('button[aria-label="Switch to dark mode"]').click();
    const toggle = page.locator('button[aria-label="Switch to light mode"]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  test('second toggle click removes dark class', async ({ page }) => {
    await page.locator('button[aria-label="Switch to dark mode"]').click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.locator('button[aria-label="Switch to light mode"]').click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('dark mode preference persists after page reload', async ({ page }) => {
    await page.locator('button[aria-label="Switch to dark mode"]').click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.reload();
    await page.waitForURL('/');
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('light mode preference persists after page reload when OS is dark', async ({ page }) => {
    // Set explicit light preference, then switch OS to dark — light pref should still win
    await injectPageState(page, sharedAuth!, 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.waitForURL('/');
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  // Toggle button — leaderboard
  test('toggle button is visible in leaderboard nav', async ({ page }) => {
    await page.locator('header nav a', { hasText: 'Leaderboard' }).click();
    await page.waitForURL('/leaderboard');
    await expect(page.locator('button[aria-label="Switch to dark mode"]')).toBeVisible();
  });

  test('toggle on leaderboard applies dark class', async ({ page }) => {
    await page.locator('header nav a', { hasText: 'Leaderboard' }).click();
    await page.waitForURL('/leaderboard');
    await page.locator('button[aria-label="Switch to dark mode"]').click();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('dark mode set on bike-log persists when navigating to leaderboard', async ({ page }) => {
    await page.locator('button[aria-label="Switch to dark mode"]').click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.locator('header nav a', { hasText: 'Leaderboard' }).click();
    await page.waitForURL('/leaderboard');
    await expect(page.locator('html')).toHaveClass(/dark/);
    // Toggle shows light_mode icon (currently dark → button offers switch to light)
    await expect(page.locator('button[aria-label="Switch to light mode"]')).toBeVisible();
  });
});
