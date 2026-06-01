import { expect, test } from '@playwright/test';

type Page = import('@playwright/test').Page;

let sharedAuth: {
  uid: string;
  email: string;
  idToken: string;
  refreshToken: string;
} | null = null;

// Fixed UIDs — serial mode ensures only one worker runs at a time.
const ALICE_UID = 'ldrtest-alice-001';
const BOB_UID = 'ldrtest-bob-001';

// Use km values far higher than any bike-log test entry (~1000 km max) so that
// our three riders always occupy positions 1, 2 and 3 regardless of parallel test data.
const ALICE_KM = 10000;
const MAIN_KM = 9000; // MainRider: two entries summing to this
const BOB_KM = 8000;

async function seedEntries(
  uid: string,
  userName: string,
  entries: { date: string; kilometers: number; raining?: boolean }[],
): Promise<void> {
  await Promise.all(
    entries.map((e) =>
      fetch(
        'http://127.0.0.1:8080/v1/projects/demo-vvta/databases/(default)/documents/bike-entries',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
          body: JSON.stringify({
            fields: {
              userId: { stringValue: uid },
              date: { stringValue: e.date },
              kilometers: { doubleValue: e.kilometers },
              raining: { booleanValue: e.raining ?? false },
              rainingSource: { stringValue: 'manual' },
              userName: { stringValue: userName },
            },
          }),
        },
      ).catch(() => {
        /* ignore */
      }),
    ),
  );
}

async function wipeUserEntries(uid: string): Promise<void> {
  const queryRes = await fetch(
    'http://127.0.0.1:8080/v1/projects/demo-vvta/databases/(default)/documents:runQuery',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'bike-entries' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'userId' },
              op: 'EQUAL',
              value: { stringValue: uid },
            },
          },
          select: { fields: [{ fieldPath: '__name__' }] },
        },
      }),
    },
  ).catch(() => null);

  if (!queryRes?.ok) return;

  const results = (await queryRes.json()) as { document?: { name?: string } }[];
  await Promise.all(
    results
      .filter((r) => r.document?.name)
      .map((r) =>
        fetch(`http://127.0.0.1:8080/v1/${r.document!.name!}`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer owner' },
        }).catch(() => {
          /* ignore */
        }),
      ),
  );
}

async function injectAuthState(page: Page, auth: NonNullable<typeof sharedAuth>): Promise<void> {
  await page.addInitScript(
    ({ uid, email, idToken, refreshToken }) => {
      const KEY = 'firebase:authUser:demo-key:[DEFAULT]';
      const value = {
        uid,
        email,
        emailVerified: false,
        isAnonymous: false,
        providerData: [
          {
            providerId: 'password',
            uid: email,
            email,
            displayName: null,
            photoURL: null,
            phoneNumber: null,
          },
        ],
        stsTokenManager: {
          refreshToken,
          accessToken: idToken,
          expirationTime: Date.now() + 3600 * 1000,
        },
        createdAt: String(Date.now()),
        lastLoginAt: String(Date.now()),
        apiKey: 'demo-key',
        appName: '[DEFAULT]',
      };
      localStorage.setItem(KEY, JSON.stringify(value));
    },
    { uid: auth.uid, email: auth.email, idToken: auth.idToken, refreshToken: auth.refreshToken },
  );
}

test.describe('Leaderboard', () => {
  // Serial mode prevents parallel workers from polluting each other's leaderboard data.
  test.describe.configure({ mode: 'serial' });
  test.beforeAll(async () => {
    const email = `leaderboard-worker-${process.pid}@test.com`;
    const password = 'testpassword123';

    const signUpRes = await fetch(
      'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    );
    const {
      localId: uid,
      idToken,
      refreshToken,
    } = (await signUpRes.json()) as {
      localId: string;
      idToken: string;
      refreshToken: string;
    };

    await fetch(
      `http://127.0.0.1:8080/v1/projects/demo-vvta/databases/(default)/documents/user-profiles?documentId=${uid}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
        body: JSON.stringify({
          fields: {
            uid: { stringValue: uid },
            firstName: { stringValue: 'MainRider' },
            email: { stringValue: email },
          },
        }),
      },
    ).catch(() => {
      /* ignore */
    });

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
      await expect(page.locator('a', { hasText: '← Mine ture' })).toBeVisible();
    });

    test('should navigate back to home when clicking the link', async ({ page }) => {
      await page.click('a', { hasText: '← Mine ture' });
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
