import { expect, test } from '@playwright/test';

import {
  type AuthState,
  createUserProfile,
  injectAuthState,
  seedEntries,
  signUpUser,
  wipeUserEntries,
} from './test-utils';

let sharedAuth: AuthState | null = null;

// Fixed UIDs — serial mode ensures only one worker runs at a time.
const ALICE_UID = 'ldrtest-alice-001';
const BOB_UID = 'ldrtest-bob-001';

// Use km values far higher than any bike-log test entry (~1000 km max) so that
// our three riders always occupy positions 1, 2 and 3 regardless of parallel test data.
const ALICE_KM = 10000;
const MAIN_KM = 9000; // MainRider: two entries summing to this
const BOB_KM = 8000;

test.describe('Leaderboard', () => {
  // Serial mode prevents parallel workers from polluting each other's leaderboard data.
  test.describe.configure({ mode: 'serial' });
  test.beforeAll(async () => {
    const email = `leaderboard-worker-${process.pid}@test.com`;
    const password = 'testpassword123';
    const { uid, idToken, refreshToken } = await signUpUser(email, password);
    await createUserProfile(uid, 'MainRider', email);
    sharedAuth = { uid, email, idToken, refreshToken };
  });

  test.beforeEach(async ({ page }) => {
    await injectAuthState(page, sharedAuth!);
    // Only wipe entries for our own test UIDs — avoids racing with bike-log tests.
    await Promise.all([
      wipeUserEntries(sharedAuth!.uid),
      wipeUserEntries(ALICE_UID),
      wipeUserEntries(BOB_UID),
    ]);
    await page.goto('/leaderboard');
    await expect(page.locator('text=Loading')).not.toBeVisible();
  });

  test.describe('Page', () => {
    test('should show leaderboard heading', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('Leaderboard');
    });

    test('should have a link back to home', async ({ page }) => {
      await expect(page.locator('nav a[routerlink="/"]')).toBeVisible();
    });

    test('should navigate back to home when clicking the link', async ({ page }) => {
      await page.click('nav a[routerlink="/"]');
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('Rankings', () => {
    test.beforeEach(async ({ page }) => {
      await Promise.all([
        // Two entries for MainRider summing to MAIN_KM
        seedEntries(sharedAuth!.uid, 'MainRider', [
          { date: '2025-06-01', kilometers: MAIN_KM * 0.6 },
          { date: '2025-06-02', kilometers: MAIN_KM * 0.4 },
        ]),
        seedEntries(ALICE_UID, 'AliceRider', [{ date: '2025-06-01', kilometers: ALICE_KM }]),
        seedEntries(BOB_UID, 'BobRider', [{ date: '2025-06-01', kilometers: BOB_KM }]),
      ]);
      // Wait for all three riders to appear (Firestore real-time update)
      await expect(
        page.locator('[aria-label="Rider rankings"] li').filter({ hasText: 'AliceRider' }),
      ).toBeVisible();
      await expect(
        page.locator('[aria-label="Rider rankings"] li').filter({ hasText: 'MainRider' }),
      ).toBeVisible();
      await expect(
        page.locator('[aria-label="Rider rankings"] li').filter({ hasText: 'BobRider' }),
      ).toBeVisible();
    });

    test('should show rider rankings section', async ({ page }) => {
      await expect(page.locator('[aria-label="Rider rankings"]')).toBeVisible();
    });

    test('should rank riders by total km descending', async ({ page }) => {
      const items = page.locator('[aria-label="Rider rankings"] li');
      // Our riders have the top 3 highest km totals across all parallel tests.
      await expect(items.nth(0)).toContainText('AliceRider');
      await expect(items.nth(1)).toContainText('MainRider');
      await expect(items.nth(2)).toContainText('BobRider');
    });

    test('should show gold medal for 1st place rider', async ({ page }) => {
      await expect(
        page.locator('[aria-label="Rider rankings"] li').filter({ hasText: 'AliceRider' }),
      ).toContainText('🥇');
    });

    test('should show silver medal for 2nd place rider', async ({ page }) => {
      await expect(
        page.locator('[aria-label="Rider rankings"] li').filter({ hasText: 'MainRider' }),
      ).toContainText('🥈');
    });

    test('should show bronze medal for 3rd place rider', async ({ page }) => {
      await expect(
        page.locator('[aria-label="Rider rankings"] li').filter({ hasText: 'BobRider' }),
      ).toContainText('🥉');
    });

    test('should show total km for each rider', async ({ page }) => {
      await expect(
        page.locator('[aria-label="Rider rankings"] li').filter({ hasText: 'AliceRider' }),
      ).toContainText(`${ALICE_KM} km`);
      await expect(
        page.locator('[aria-label="Rider rankings"] li').filter({ hasText: 'MainRider' }),
      ).toContainText(`${MAIN_KM} km`);
      await expect(
        page.locator('[aria-label="Rider rankings"] li').filter({ hasText: 'BobRider' }),
      ).toContainText(`${BOB_KM} km`);
    });

    test('should show ride count for each rider', async ({ page }) => {
      await expect(
        page.locator('[aria-label="Rider rankings"] li').filter({ hasText: 'MainRider' }),
      ).toContainText('2 rides');
      await expect(
        page.locator('[aria-label="Rider rankings"] li').filter({ hasText: 'AliceRider' }),
      ).toContainText('1 ride');
    });

    test('should show "(you)" badge next to the current user', async ({ page }) => {
      await expect(
        page.locator('[aria-label="Rider rankings"] li').filter({ hasText: 'MainRider' }),
      ).toContainText('(you)');
    });

    test('should not show "(you)" badge for other riders', async ({ page }) => {
      await expect(
        page.locator('[aria-label="Rider rankings"] li').filter({ hasText: 'AliceRider' }),
      ).not.toContainText('(you)');
    });
  });

  test.describe('Rainy rides', () => {
    test('should show rainy ride count when rider has rainy rides', async ({ page }) => {
      await seedEntries(sharedAuth!.uid, 'MainRider', [
        { date: '2025-06-01', kilometers: MAIN_KM * 0.5, raining: true },
        { date: '2025-06-02', kilometers: MAIN_KM * 0.3, raining: true },
        { date: '2025-06-03', kilometers: MAIN_KM * 0.2, raining: false },
      ]);

      const myItem = page
        .locator('[aria-label="Rider rankings"] li')
        .filter({ hasText: 'MainRider' });
      await expect(myItem).toBeVisible();
      await expect(myItem).toContainText('2 🌧️');
    });

    test('should not show rainy count when rider has no rainy rides', async ({ page }) => {
      await seedEntries(sharedAuth!.uid, 'MainRider', [
        { date: '2025-06-01', kilometers: 100, raining: false },
      ]);

      const myItem = page
        .locator('[aria-label="Rider rankings"] li')
        .filter({ hasText: 'MainRider' });
      await expect(myItem).toBeVisible();
      await expect(myItem).not.toContainText('🌧️');
    });
  });

  test.describe('Recent rides', () => {
    test('should show recent rides section after adding entries', async ({ page }) => {
      await seedEntries(sharedAuth!.uid, 'MainRider', [{ date: '2025-06-01', kilometers: 15 }]);
      await expect(page.locator('[aria-label="Recent rides"]')).toBeVisible();
    });

    test('should list rider name and km in recent rides', async ({ page }) => {
      await seedEntries(sharedAuth!.uid, 'MainRider', [{ date: '2025-06-01', kilometers: 15 }]);

      const recentSection = page.locator('[aria-label="Recent rides"]');
      await expect(recentSection).toBeVisible();
      await expect(recentSection).toContainText('MainRider');
      await expect(recentSection).toContainText('15 km');
    });

    test('should show at most 10 recent rides', async ({ page }) => {
      const entries = Array.from({ length: 12 }, (_, i) => ({
        date: `2025-06-${String(i + 1).padStart(2, '0')}`,
        kilometers: 100,
      }));
      await seedEntries(sharedAuth!.uid, 'MainRider', entries);

      await expect(page.locator('[aria-label="Recent rides"] li')).toHaveCount(10);
    });

    test('should show rain emoji in recent rides for rainy entry', async ({ page }) => {
      await seedEntries(sharedAuth!.uid, 'MainRider', [
        { date: '2025-06-01', kilometers: 10, raining: true },
      ]);

      const recentSection = page.locator('[aria-label="Recent rides"]');
      await expect(recentSection).toBeVisible();
      await expect(recentSection).toContainText('🌧️');
    });
  });
});
