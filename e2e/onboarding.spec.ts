import { expect, test } from '@playwright/test';

import { type AuthState, deleteUserProfile, injectAuthState, signUpUser } from './test-utils';

let sharedAuth: AuthState | null = null;

test.describe('Onboarding', () => {
  // Serial mode prevents parallel workers from racing on auth state and emulator load.
  test.describe.configure({ mode: 'serial' });
  test.beforeAll(async () => {
    // Create a user WITHOUT a profile — this simulates a brand-new signup.
    const email = `onboarding-worker-${process.pid}@test.com`;
    const password = 'testpassword123';
    const { uid, idToken, refreshToken } = await signUpUser(email, password);
    sharedAuth = { uid, email, idToken, refreshToken };
  });

  test.beforeEach(async ({ page }) => {
    // Ensure no profile — authGuard will redirect to /onboarding
    await deleteUserProfile(sharedAuth!.uid);
    await injectAuthState(page, sharedAuth!);
    await page.goto('/');
    // Wait for the guard redirect — this also confirms auth injection succeeded
    await page.waitForURL('/onboarding');
  });

  test.describe('Redirect behaviour', () => {
    test('should redirect from / to /onboarding when user has no profile', async ({ page }) => {
      await expect(page).toHaveURL('/onboarding');
    });

    test('should redirect from /leaderboard to /onboarding when user has no profile', async ({
      page,
    }) => {
      await page.goto('/leaderboard');
      await expect(page).toHaveURL('/onboarding');
    });
  });

  test.describe('Form appearance', () => {
    test('should show "Welcome!" heading', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('Welcome!');
    });

    test('should show the first name input', async ({ page }) => {
      await expect(page.locator('#first-name')).toBeVisible();
    });

    test('should show "Get started" submit button', async ({ page }) => {
      await expect(page.locator('button[type="submit"]')).toContainText('Get started');
    });

    test('should have an empty name input by default', async ({ page }) => {
      await expect(page.locator('#first-name')).toHaveValue('');
    });
  });

  test.describe('Form validation', () => {
    test('should show validation error when submitting with empty name', async ({ page }) => {
      await page.click('button[type="submit"]');
      await expect(page.locator('#name-error')).toBeVisible();
      await expect(page.locator('#name-error')).toContainText('Please enter your first name');
    });

    test('should show validation error when submitting with whitespace-only name', async ({
      page,
    }) => {
      await page.fill('#first-name', '   ');
      await page.click('button[type="submit"]');
      await expect(page.locator('#name-error')).toBeVisible();
    });

    test('should not show validation error before first submit attempt', async ({ page }) => {
      await expect(page.locator('#name-error')).not.toBeVisible();
    });

    test('should not show validation error after typing a valid name', async ({ page }) => {
      await page.click('button[type="submit"]'); // trigger touched state
      await page.fill('#first-name', 'Anders');
      await expect(page.locator('#name-error')).not.toBeVisible();
    });
  });

  test.describe('Successful signup', () => {
    test('should navigate to / after saving a valid first name', async ({ page }) => {
      await page.fill('#first-name', 'Anders');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/');
    });

    test('should show the app after completing onboarding', async ({ page }) => {
      await page.fill('#first-name', 'Anders');
      await page.click('button[type="submit"]');
      await expect(page.locator('h1')).toContainText('We Vibe to Work');
    });
  });
});
