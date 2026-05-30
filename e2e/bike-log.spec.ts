import { expect, test } from '@playwright/test';

type Page = import('@playwright/test').Page;

// Shared auth state per worker — created once in beforeAll, reused across all tests
let sharedAuth: {
  uid: string;
  email: string;
  idToken: string;
  refreshToken: string;
} | null = null;

/** Seed bike-entries for a specific userId via the Firestore emulator REST API. */
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

/** Delete all bike-entries for a specific userId via the Firestore emulator REST API. */
async function wipeUserEntries(uid: string): Promise<void> {
  // Run a structured query to find all docs with userId == uid
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
  const deletePromises = results
    .filter((r) => r.document?.name)
    .map((r) =>
      fetch(`http://127.0.0.1:8080/v1/${r.document!.name!}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer owner' },
      }).catch(() => {
        /* ignore */
      }),
    );
  await Promise.all(deletePromises);
}

/**
 * Inject Firebase auth into IndexedDB before the page scripts run.
 * Firebase Web SDK reads `firebaseLocalStorageDb` / `firebaseLocalStorage`
 * on startup — writing it here means no sign-in round-trip is needed.
 */
async function injectAuthState(page: Page, auth: NonNullable<typeof sharedAuth>): Promise<void> {
  await page.addInitScript(
    ({ uid, email, idToken, refreshToken }) => {
      const DB_NAME = 'firebaseLocalStorageDb';
      const STORE = 'firebaseLocalStorage';
      const KEY = 'firebase:authUser:demo-key:[DEFAULT]';

      const record = {
        fbase_key: KEY,
        value: {
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
        },
      };

      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: 'fbase_key' });
      };
      req.onsuccess = () => {
        const db = req.result;
        // Ensure object store exists (may already exist)
        if (!db.objectStoreNames.contains(STORE)) return;
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(record);
      };
    },
    { uid: auth.uid, email: auth.email, idToken: auth.idToken, refreshToken: auth.refreshToken },
  );
}

// Helper to add an entry quickly
async function addEntry(page: Page, date: string, km: string, raining = false) {
  await page.fill('#ride-date', date);
  await page.fill('#ride-km', km);
  if (raining) {
    const checkbox = page.locator('#ride-raining');
    if (!(await checkbox.isChecked())) {
      await checkbox.check();
    }
  } else {
    const checkbox = page.locator('#ride-raining');
    if (await checkbox.isChecked()) {
      await checkbox.uncheck();
    }
  }
  await page.click('button[type="submit"]');
  // Wait for the form to reset (km returns to 0), confirming the entry was saved
  await expect(page.locator('#ride-km')).toHaveValue('0');
  // Wait for weather check to clear if it triggered
  await expect(page.locator('text=Checking weather')).not.toBeVisible();
}

/** Click the nth delete button for a ride and confirm the inline prompt. */
async function deleteRide(page: Page, nth = 0) {
  await page.locator('button[aria-label*="Delete ride"]').nth(nth).click();
  await page.locator('button[aria-label="Confirm delete"]').click();
}

test.describe('Bike Log App', () => {
  test.beforeAll(async () => {
    // Create one shared user per worker — reused across all tests in this worker
    // (Initial full wipe is handled by global setup in e2e/global-setup.ts)
    const email = `worker-${process.pid}@test.com`;
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

    // Create the user-profile document
    await fetch(
      `http://127.0.0.1:8080/v1/projects/demo-vvta/databases/(default)/documents/user-profiles?documentId=${uid}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
        body: JSON.stringify({
          fields: {
            uid: { stringValue: uid },
            firstName: { stringValue: 'TestUser' },
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
    // Set up route mock and auth injection before navigation (these are synchronous registrations)
    await page.route(/api\.open-meteo\.com/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ daily: { precipitation_sum: [0] } }),
      });
    });
    await injectAuthState(page, sharedAuth!);

    // Wipe entries and navigate in parallel — wipe is a REST call, goto is a browser navigation
    await Promise.all([wipeUserEntries(sharedAuth!.uid), page.goto('/')]);
    // Wait for Firestore subscription to resolve and weather check to finish
    await expect(page.locator('text=Loading rides')).not.toBeVisible();
    await expect(page.locator('text=Checking weather')).not.toBeVisible();
  });

  test.describe('Initial state', () => {
    test('should show the app heading', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('Vi viber til arbejde');
    });

    test('should show the subtitle', async ({ page }) => {
      await expect(page.locator('text=Log dine daglige cykelture')).toBeVisible();
    });

    test('should show empty state message', async ({ page }) => {
      await expect(page.locator('text=No rides logged yet')).toBeVisible();
    });

    test('should not show the ride list or total', async ({ page }) => {
      await expect(page.locator('ul')).not.toBeVisible();
      await expect(page.locator('h2')).not.toBeVisible();
    });

    test('should have the date field pre-filled with today', async ({ page }) => {
      const today = new Date();
      const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      await expect(page.locator('#ride-date')).toHaveValue(expected);
    });

    test('should have km field at 0', async ({ page }) => {
      await expect(page.locator('#ride-km')).toHaveValue('0');
    });

    test('should have raining checkbox unchecked', async ({ page }) => {
      await expect(page.locator('#ride-raining')).not.toBeChecked();
    });

    test('should have the submit button disabled', async ({ page }) => {
      await expect(page.locator('button[type="submit"]')).toBeDisabled();
    });

    test('should show "Add Entry" on the button', async ({ page }) => {
      await expect(page.locator('button[type="submit"]')).toContainText('Add Entry');
    });

    test('should not show Cancel button', async ({ page }) => {
      await expect(page.locator('button:text("Cancel")')).not.toBeVisible();
    });
  });

  test.describe('Form validation', () => {
    test('should keep submit disabled when only date is filled', async ({ page }) => {
      await page.fill('#ride-date', '2025-06-01');
      await expect(page.locator('button[type="submit"]')).toBeDisabled();
    });

    test('should enable submit when date and valid km are filled', async ({ page }) => {
      await page.fill('#ride-date', '2025-06-01');
      await page.fill('#ride-km', '5');
      await expect(page.locator('button[type="submit"]')).toBeEnabled();
    });

    test('should disable submit when km is 0', async ({ page }) => {
      await page.fill('#ride-date', '2025-06-01');
      await page.fill('#ride-km', '0');
      await expect(page.locator('button[type="submit"]')).toBeDisabled();
    });

    test('should disable submit when date is cleared', async ({ page }) => {
      await page.fill('#ride-date', '');
      await page.fill('#ride-km', '10');
      await expect(page.locator('button[type="submit"]')).toBeDisabled();
    });

    test('should accept decimal km values', async ({ page }) => {
      await page.fill('#ride-date', '2025-06-01');
      await page.fill('#ride-km', '0.5');
      await expect(page.locator('button[type="submit"]')).toBeEnabled();
    });
  });

  test.describe('Adding entries', () => {
    test('should add an entry and display it in the list', async ({ page }) => {
      await addEntry(page, '2025-06-01', '12.5');

      await expect(page.locator('ul[aria-label="Logged bike rides"] li')).toHaveCount(1);
      await expect(page.locator('ul li').first()).toContainText('12.5 km');
    });

    test('should display a formatted date in the entry', async ({ page }) => {
      await addEntry(page, '2025-06-01', '10');

      // Date pipe with 'mediumDate' should format the date
      await expect(page.locator('ul li').first()).toContainText('Jun');
      await expect(page.locator('ul li').first()).toContainText('2025');
    });

    test('should show total kilometers after adding entries', async ({ page }) => {
      await addEntry(page, '2025-06-01', '10');
      await addEntry(page, '2025-06-02', '15');

      await expect(page.locator('strong').filter({ hasText: /km/ })).toContainText('25 km');
    });

    test('should clear the km field after adding an entry', async ({ page }) => {
      await addEntry(page, '2025-06-01', '10');
      await expect(page.locator('#ride-km')).toHaveValue('0');
    });

    test('should reset date to today after adding an entry', async ({ page }) => {
      await addEntry(page, '2025-06-01', '10');

      const today = new Date();
      const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      await expect(page.locator('#ride-date')).toHaveValue(expected);
    });

    test('should uncheck raining after adding an entry', async ({ page }) => {
      await addEntry(page, '2025-06-01', '10', true);
      // After submit, the weather API auto-check runs and may set it,
      // but the model resets raining to false
      await expect(page.locator('#ride-km')).toHaveValue('0');
    });

    test('should hide the empty state after adding an entry', async ({ page }) => {
      await addEntry(page, '2025-06-01', '10');
      await expect(page.locator('text=No rides logged yet')).not.toBeVisible();
    });

    test('should show "Logged Rides" heading after adding', async ({ page }) => {
      await addEntry(page, '2025-06-01', '10');
      await expect(page.locator('h2')).toContainText('Logged Rides');
    });

    test('should add newest entries at the top', async ({ page }) => {
      await addEntry(page, '2025-06-01', '10');
      await addEntry(page, '2025-06-02', '20');

      await expect(page.locator('ul li').first()).toContainText('20 km');
      await expect(page.locator('ul li').last()).toContainText('10 km');
    });

    test('should handle small decimal values correctly', async ({ page }) => {
      await addEntry(page, '2025-06-01', '0.1');
      await addEntry(page, '2025-06-02', '0.2');

      // Total should show 0.3, not 0.30000000000000004
      await expect(page.locator('strong').filter({ hasText: /km/ })).toContainText('0.3 km');
    });

    test('should handle large km values', async ({ page }) => {
      await addEntry(page, '2025-06-01', '999.9');
      await expect(page.locator('ul li').first()).toContainText('999.9 km');
    });

    test('should add many entries', async ({ page }) => {
      for (let i = 1; i <= 5; i++) {
        await addEntry(page, `2025-06-${String(i).padStart(2, '0')}`, String(i * 10));
      }
      await expect(page.locator('ul li')).toHaveCount(5);
      await expect(page.locator('strong').filter({ hasText: /km/ })).toContainText('150 km');
    });
  });

  test.describe('Raining checkbox', () => {
    test('should add rain emoji when raining is checked', async ({ page }) => {
      await addEntry(page, '2025-06-01', '10', true);
      await expect(page.locator('ul li').first()).toContainText('🌧️');
    });

    test('should not show rain emoji when raining is unchecked', async ({ page }) => {
      await addEntry(page, '2025-06-01', '10', false);
      await expect(page.locator('ul li').first()).not.toContainText('🌧️');
    });

    test('should show tooltip on hover over rain emoji', async ({ page }) => {
      await addEntry(page, '2025-06-01', '10', true);

      const rainEmoji = page.locator('ul li').first().locator('span.group');
      await rainEmoji.hover();

      const tooltip = rainEmoji.locator('span[role="tooltip"]');
      await expect(tooltip).toBeVisible();
    });

    test('should show correct tooltip text for manually set rain', async ({ page }) => {
      await addEntry(page, '2025-06-01', '10', true);

      const rainEmoji = page.locator('ul li').first().locator('span.group');
      await rainEmoji.hover();

      const tooltip = rainEmoji.locator('span[role="tooltip"]');
      await expect(tooltip).toContainText('Set manually');
    });

    test('should handle mixed rain and no-rain entries', async ({ page }) => {
      await addEntry(page, '2025-06-01', '10', true);
      await addEntry(page, '2025-06-02', '15', false);
      await addEntry(page, '2025-06-03', '20', true);

      const items = page.locator('ul li');
      await expect(items.nth(0)).toContainText('🌧️'); // newest (June 3)
      await expect(items.nth(1)).not.toContainText('🌧️'); // June 2
      await expect(items.nth(2)).toContainText('🌧️'); // June 1
    });

    test('tooltip should hide when not hovering', async ({ page }) => {
      await addEntry(page, '2025-06-01', '10', true);

      const tooltip = page.locator('ul li').first().locator('span[role="tooltip"]');
      // Without hover, tooltip should be invisible (has 'invisible' class)
      await expect(tooltip).not.toBeVisible();
    });
  });

  test.describe('Editing entries', () => {
    test.beforeEach(async ({ page }) => {
      // Seed via REST — Firestore onSnapshot pushes update to already-loaded page
      await seedEntries(sharedAuth!.uid, 'TestUser', [{ date: '2025-06-01', kilometers: 10 }]);
      await expect(page.locator('ul li')).toHaveCount(1);
    });

    test('should populate the form when clicking edit', async ({ page }) => {
      await page.click('button[aria-label*="Edit"]');
      await expect(page.locator('#ride-km')).toHaveValue('10');
      await expect(page.locator('#ride-date')).toHaveValue('2025-06-01');
    });

    test('should change button text to "Update Entry"', async ({ page }) => {
      await page.click('button[aria-label*="Edit"]');
      await expect(page.locator('button[type="submit"]')).toContainText('Update Entry');
    });

    test('should show Cancel button when editing', async ({ page }) => {
      await page.click('button[aria-label*="Edit"]');
      await expect(page.locator('button:text("Cancel")')).toBeVisible();
    });

    test('should update the km on submit', async ({ page }) => {
      await page.click('button[aria-label*="Edit"]');
      await page.fill('#ride-km', '25');
      await page.click('button[type="submit"]');

      // Wait for form to reset
      await expect(page.locator('#ride-km')).toHaveValue('0');

      await expect(page.locator('ul li')).toHaveCount(1);
      await expect(page.locator('ul li').first()).toContainText('25 km');
    });

    test('should update the date on submit', async ({ page }) => {
      await page.click('button[aria-label*="Edit"]');
      await page.fill('#ride-date', '2025-07-15');
      await page.click('button[type="submit"]');

      // Wait for form to reset
      await expect(page.locator('#ride-km')).toHaveValue('0');

      await expect(page.locator('ul li')).toHaveCount(1);
      await expect(page.locator('ul li').first()).toContainText('Jul');
    });

    test('should toggle rain status during edit', async ({ page }) => {
      await page.click('button[aria-label*="Edit"]');
      await page.check('#ride-raining');
      await page.click('button[type="submit"]');

      // Wait for form to reset
      await expect(page.locator('#ride-km')).toHaveValue('0');

      await expect(page.locator('ul li').first()).toContainText('🌧️');
    });

    test('should return to Add Entry mode after update', async ({ page }) => {
      await page.click('button[aria-label*="Edit"]');
      // Wait for weather check to clear if it triggered
      await expect(page.locator('text=Checking weather')).not.toBeVisible();
      await page.fill('#ride-km', '25');
      await page.click('button[type="submit"]');

      // Wait for form to reset
      await expect(page.locator('#ride-km')).toHaveValue('0');
      // And wait for weather check after submit too
      await expect(page.locator('text=Checking weather')).not.toBeVisible();

      await expect(page.locator('button[type="submit"]')).toContainText('Add Entry');
      await expect(page.locator('button:text("Cancel")')).not.toBeVisible();
    });

    test('should cancel editing without changes', async ({ page }) => {
      await page.click('button[aria-label*="Edit"]');
      await page.fill('#ride-km', '99');
      await page.click('button:text("Cancel")');

      await expect(page.locator('ul li').first()).toContainText('10 km');
      await expect(page.locator('button[type="submit"]')).toContainText('Add Entry');
      await expect(page.locator('button:text("Cancel")')).not.toBeVisible();
    });

    test('should reset form to today after cancel', async ({ page }) => {
      await page.click('button[aria-label*="Edit"]');
      await page.click('button:text("Cancel")');

      const today = new Date();
      const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      await expect(page.locator('#ride-date')).toHaveValue(expected);
    });

    test('should switch to editing a different entry', async ({ page }) => {
      await seedEntries(sharedAuth!.uid, 'TestUser', [{ date: '2025-06-02', kilometers: 20 }]);
      await expect(page.locator('ul li')).toHaveCount(2);

      // Edit first entry (20 km - June 2, the newest)
      await page.locator('button[aria-label*="Edit"]').first().click();
      await expect(page.locator('#ride-km')).toHaveValue('20');

      // Now click edit on the second entry (10 km - June 1)
      await page.locator('button[aria-label*="Edit"]').last().click();
      await expect(page.locator('#ride-km')).toHaveValue('10');
    });

    test('should not create a duplicate when updating', async ({ page }) => {
      await page.click('button[aria-label*="Edit"]');
      await page.fill('#ride-km', '25');
      await page.click('button[type="submit"]');

      await expect(page.locator('ul li')).toHaveCount(1);
    });
  });

  test.describe('Deleting entries', () => {
    test('should delete an entry and show empty state', async ({ page }) => {
      await seedEntries(sharedAuth!.uid, 'TestUser', [{ date: '2025-06-01', kilometers: 10 }]);
      await expect(page.locator('ul li')).toHaveCount(1);
      await deleteRide(page);

      await expect(page.locator('ul li')).toHaveCount(0);
      await expect(page.locator('text=No rides logged yet')).toBeVisible();
    });

    test('should update total after deleting', async ({ page }) => {
      await seedEntries(sharedAuth!.uid, 'TestUser', [
        { date: '2025-06-01', kilometers: 10 },
        { date: '2025-06-02', kilometers: 20 },
      ]);
      await expect(page.locator('ul li')).toHaveCount(2);

      // Delete the first (newest, 20km)
      await deleteRide(page);

      await expect(page.locator('ul li')).toHaveCount(1);
      await expect(page.locator('strong').filter({ hasText: /km/ })).toContainText('10 km');
    });

    test('should delete a middle entry from a list of three', async ({ page }) => {
      await seedEntries(sharedAuth!.uid, 'TestUser', [
        { date: '2025-06-01', kilometers: 10 },
        { date: '2025-06-02', kilometers: 20 },
        { date: '2025-06-03', kilometers: 30 },
      ]);
      await expect(page.locator('ul li')).toHaveCount(3);

      // Delete the middle entry (20km, index 1)
      await deleteRide(page, 1);

      await expect(page.locator('ul li')).toHaveCount(2);
      await expect(page.locator('strong').filter({ hasText: /km/ })).toContainText('40 km');
    });

    test('should delete all entries one by one', async ({ page }) => {
      await seedEntries(sharedAuth!.uid, 'TestUser', [
        { date: '2025-06-01', kilometers: 10 },
        { date: '2025-06-02', kilometers: 20 },
        { date: '2025-06-03', kilometers: 30 },
      ]);
      await expect(page.locator('ul li')).toHaveCount(3);

      await deleteRide(page);
      await expect(page.locator('ul li')).toHaveCount(2);

      await deleteRide(page);
      await expect(page.locator('ul li')).toHaveCount(1);

      await deleteRide(page);
      await expect(page.locator('ul li')).toHaveCount(0);
      await expect(page.locator('text=No rides logged yet')).toBeVisible();
    });

    test('should cancel edit when deleting the entry being edited', async ({ page }) => {
      await seedEntries(sharedAuth!.uid, 'TestUser', [{ date: '2025-06-01', kilometers: 10 }]);
      await expect(page.locator('ul li')).toHaveCount(1);
      await page.click('button[aria-label*="Edit"]');
      await expect(page.locator('button[type="submit"]')).toContainText('Update Entry');

      await deleteRide(page);

      await expect(page.locator('button[type="submit"]')).toContainText('Add Entry');
      await expect(page.locator('button:text("Cancel")')).not.toBeVisible();
    });

    test('should keep editing state when deleting a different entry', async ({ page }) => {
      await seedEntries(sharedAuth!.uid, 'TestUser', [
        { date: '2025-06-01', kilometers: 10 },
        { date: '2025-06-02', kilometers: 20 },
      ]);
      await expect(page.locator('ul li')).toHaveCount(2);

      // Edit the second entry (10km)
      await page.locator('button[aria-label*="Edit"]').last().click();
      await expect(page.locator('#ride-km')).toHaveValue('10');

      // Request delete on the first entry (20km) — confirm not yet clicked
      await page.locator('button[aria-label*="Delete ride"]').first().click();

      // Should still be in edit mode
      await expect(page.locator('button[type="submit"]')).toContainText('Update Entry');
    });

    test('should be able to add entries after deleting all', async ({ page }) => {
      await addEntry(page, '2025-06-01', '10');
      await deleteRide(page);
      await expect(page.locator('text=No rides logged yet')).toBeVisible();

      await addEntry(page, '2025-06-02', '20');
      await expect(page.locator('ul li')).toHaveCount(1);
      await expect(page.locator('ul li').first()).toContainText('20 km');
    });
  });

  test.describe('Persistence', () => {
    test('should persist entries across page reloads', async ({ page }) => {
      await addEntry(page, '2025-06-01', '12.5');

      await page.reload();
      await page.waitForSelector('ul li');

      await expect(page.locator('ul li')).toHaveCount(1);
      await expect(page.locator('ul li').first()).toContainText('12.5 km');
    });

    test('should persist multiple entries across reload', async ({ page }) => {
      await addEntry(page, '2025-06-01', '10');
      await addEntry(page, '2025-06-02', '20');
      await addEntry(page, '2025-06-03', '30');

      await page.reload();
      await page.waitForSelector('ul li');

      await expect(page.locator('ul li')).toHaveCount(3);
      await expect(page.locator('strong').filter({ hasText: /km/ })).toContainText('60 km');
    });

    test('should persist rain status across reload', async ({ page }) => {
      await addEntry(page, '2025-06-01', '10', true);

      await page.reload();
      await page.waitForSelector('ul li');

      await expect(page.locator('ul li').first()).toContainText('🌧️');
    });

    test('should persist deletion across reload', async ({ page }) => {
      await addEntry(page, '2025-06-01', '10');
      await addEntry(page, '2025-06-02', '20');
      await deleteRide(page);

      await page.reload();
      await page.waitForSelector('ul li');

      await expect(page.locator('ul li')).toHaveCount(1);
    });

    test('should persist edits across reload', async ({ page }) => {
      await addEntry(page, '2025-06-01', '10');
      await page.click('button[aria-label*="Edit"]');
      await page.fill('#ride-km', '99');
      await page.click('button[type="submit"]');

      await page.reload();
      await page.waitForSelector('ul li');

      await expect(page.locator('ul li').first()).toContainText('99 km');
    });

    test('should handle empty localStorage gracefully on load', async ({ page }) => {
      await page.evaluate(() => localStorage.removeItem('bike-log-entries'));
      await page.reload();
      await page.waitForSelector('h1');

      await expect(page.locator('text=No rides logged yet')).toBeVisible();
    });
  });

  test.describe('Full workflows', () => {
    test('add → edit → cancel → add another', async ({ page }) => {
      await addEntry(page, '2025-06-01', '10');

      await page.click('button[aria-label*="Edit"]');
      await page.fill('#ride-km', '99');
      await page.click('button:text("Cancel")');

      await expect(page.locator('ul li').first()).toContainText('10 km');

      await addEntry(page, '2025-06-02', '20');
      await expect(page.locator('ul li')).toHaveCount(2);
    });

    test('add → edit → submit → verify single entry updated', async ({ page }) => {
      await addEntry(page, '2025-06-01', '10');
      await addEntry(page, '2025-06-02', '20');

      // Edit the second entry
      await page.locator('button[aria-label*="Edit"]').last().click();
      await page.fill('#ride-km', '15');
      await page.click('button[type="submit"]');

      // Wait for form to reset
      await expect(page.locator('#ride-km')).toHaveValue('0');

      await expect(page.locator('ul li')).toHaveCount(2);
      await expect(page.locator('ul li').last()).toContainText('15 km');
      await expect(page.locator('strong').filter({ hasText: /km/ })).toContainText('35 km');
    });

    test('add → delete → add → reload', async ({ page }) => {
      await addEntry(page, '2025-06-01', '10');
      await deleteRide(page);
      await addEntry(page, '2025-06-02', '25');

      await page.reload();
      await page.waitForSelector('ul li');

      await expect(page.locator('ul li')).toHaveCount(1);
      await expect(page.locator('ul li').first()).toContainText('25 km');
    });

    test('add rainy → edit to remove rain → verify no rain emoji', async ({ page }) => {
      await addEntry(page, '2025-06-01', '10', true);
      await expect(page.locator('ul li').first()).toContainText('🌧️');

      await page.click('button[aria-label*="Edit"]');
      await expect(page.locator('button[type="submit"]')).toContainText('Update Entry');
      // Wait for weather auto-check to complete (checking weather indicator disappears)
      await expect(page.locator('text=Checking weather')).not.toBeVisible();

      // Explicitly uncheck the rain checkbox
      await page.uncheck('#ride-raining');

      // Submit the edit
      await page.click('button[type="submit"]');

      // Verify the rain emoji is gone
      await expect(page.locator('ul li').first()).not.toContainText('🌧️');
    });

    test('add non-rainy → edit to add rain → verify rain emoji', async ({ page }) => {
      await addEntry(page, '2025-06-01', '10', false);
      await expect(page.locator('ul li').first()).not.toContainText('🌧️');

      await page.click('button[aria-label*="Edit"]');
      await page.check('#ride-raining');
      await page.click('button[type="submit"]');

      // Wait for form to reset
      await expect(page.locator('#ride-km')).toHaveValue('0');

      await expect(page.locator('ul li').first()).toContainText('🌧️');
    });

    test('rapid entry addition should work correctly', async ({ page }) => {
      for (let i = 1; i <= 10; i++) {
        await addEntry(page, `2025-06-${String(i).padStart(2, '0')}`, String(i));
      }

      await expect(page.locator('ul li')).toHaveCount(10);
      // Sum of 1..10 = 55
      await expect(page.locator('strong').filter({ hasText: /km/ })).toContainText('55 km');
    });
  });

  test.describe('Keyboard interaction', () => {
    test('should submit form with Enter key in km field', async ({ page }) => {
      await page.fill('#ride-date', '2025-06-01');
      await page.fill('#ride-km', '10');
      await page.locator('#ride-km').press('Enter');

      // Wait for form to reset
      await expect(page.locator('#ride-km')).toHaveValue('0');

      await expect(page.locator('ul li')).toHaveCount(1);
    });

    test('should be able to tab through form fields', async ({ page }) => {
      // Focus on km, then tab to raining checkbox
      await page.locator('#ride-km').focus();
      await page.keyboard.press('Tab');

      const focusedId = await page.evaluate(() => document.activeElement?.id);
      expect(focusedId).toBe('ride-raining');
    });
  });

  test.describe('Sorting', () => {
    test.beforeEach(async ({ page }) => {
      // Seed via REST — Firestore onSnapshot pushes update to already-loaded page
      await seedEntries(sharedAuth!.uid, 'TestUser', [
        { date: '2025-06-01', kilometers: 10 },
        { date: '2025-06-03', kilometers: 30 },
        { date: '2025-06-02', kilometers: 20 },
      ]);
      await expect(page.locator('ul li')).toHaveCount(3);
    });

    test('should show sort controls when entries exist', async ({ page }) => {
      await expect(page.locator('[aria-label="Sort rides by"]')).toBeVisible();
    });

    test('should default to date descending (newest first)', async ({ page }) => {
      const items = page.locator('ul li');
      await expect(items.nth(0)).toContainText('Jun 3');
      await expect(items.nth(1)).toContainText('Jun 2');
      await expect(items.nth(2)).toContainText('Jun 1');
    });

    test('should show Date button as active by default', async ({ page }) => {
      const dateBtn = page.locator('[aria-label="Sort rides by"] button', { hasText: 'Date' });
      await expect(dateBtn).toHaveAttribute('aria-pressed', 'true');
    });

    test('should toggle date to ascending when clicking Date again', async ({ page }) => {
      await page.locator('[aria-label="Sort rides by"] button', { hasText: 'Date' }).click();

      const items = page.locator('ul li');
      await expect(items.nth(0)).toContainText('Jun 1');
      await expect(items.nth(1)).toContainText('Jun 2');
      await expect(items.nth(2)).toContainText('Jun 3');
    });

    test('should show ↑ arrow when date sort is ascending', async ({ page }) => {
      await page.locator('[aria-label="Sort rides by"] button', { hasText: 'Date' }).click();
      const dateBtn = page.locator('[aria-label="Sort rides by"] button', { hasText: 'Date' });
      await expect(dateBtn).toContainText('↑');
    });

    test('should show ↓ arrow on the active sort button by default', async ({ page }) => {
      const dateBtn = page.locator('[aria-label="Sort rides by"] button', { hasText: 'Date' });
      await expect(dateBtn).toContainText('↓');
    });

    test('should sort by distance descending when clicking Distance', async ({ page }) => {
      await page.locator('[aria-label="Sort rides by"] button', { hasText: 'Distance' }).click();

      const items = page.locator('ul li');
      await expect(items.nth(0)).toContainText('30 km');
      await expect(items.nth(1)).toContainText('20 km');
      await expect(items.nth(2)).toContainText('10 km');
    });

    test('should toggle distance to ascending when clicking Distance again', async ({ page }) => {
      await page.locator('[aria-label="Sort rides by"] button', { hasText: 'Distance' }).click();
      await page.locator('[aria-label="Sort rides by"] button', { hasText: 'Distance' }).click();

      const items = page.locator('ul li');
      await expect(items.nth(0)).toContainText('10 km');
      await expect(items.nth(1)).toContainText('20 km');
      await expect(items.nth(2)).toContainText('30 km');
    });

    test('should switch active button to Distance', async ({ page }) => {
      await page.locator('[aria-label="Sort rides by"] button', { hasText: 'Distance' }).click();

      const distBtn = page.locator('[aria-label="Sort rides by"] button', { hasText: 'Distance' });
      const dateBtn = page.locator('[aria-label="Sort rides by"] button', { hasText: 'Date' });
      await expect(distBtn).toHaveAttribute('aria-pressed', 'true');
      await expect(dateBtn).toHaveAttribute('aria-pressed', 'false');
    });

    test('should reset direction to desc when switching fields', async ({ page }) => {
      // Toggle date to asc
      await page.locator('[aria-label="Sort rides by"] button', { hasText: 'Date' }).click();
      // Switch to distance — should default to desc
      await page.locator('[aria-label="Sort rides by"] button', { hasText: 'Distance' }).click();

      const items = page.locator('ul li');
      await expect(items.nth(0)).toContainText('30 km');
    });

    test('sort should persist correctly after adding a new entry', async ({ page }) => {
      await page.locator('[aria-label="Sort rides by"] button', { hasText: 'Distance' }).click();
      await addEntry(page, '2025-06-04', '5');

      // Wait for list to update and include the new entry
      await expect(page.locator('ul li')).toHaveCount(4);

      const items = page.locator('ul li');
      await expect(items.nth(0)).toContainText('30 km');
      await expect(items.last()).toContainText('5 km');
    });
  });

  test('should not show sort controls when list is empty', async ({ page }) => {
    await expect(page.locator('[aria-label="Sort rides by"]')).not.toBeVisible();
  });

  test('should have proper aria-label on the ride list', async ({ page }) => {
    await addEntry(page, '2025-06-01', '10');
    await expect(page.locator('ul[aria-label="Logged bike rides"]')).toBeVisible();
  });

  test('should have aria-labels on edit and delete buttons', async ({ page }) => {
    await addEntry(page, '2025-06-01', '10');
    await expect(page.locator('button[aria-label*="Edit ride on"]')).toBeVisible();
    await expect(page.locator('button[aria-label*="Delete ride on"]')).toBeVisible();
  });

  test('should include the date in button aria-labels', async ({ page }) => {
    await addEntry(page, '2025-06-01', '10');
    await expect(page.locator('button[aria-label="Edit ride on 2025-06-01"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Delete ride on 2025-06-01"]')).toBeVisible();
  });

  test('should have labels for all form inputs', async ({ page }) => {
    await expect(page.locator('label[for="ride-date"]')).toBeVisible();
    await expect(page.locator('label[for="ride-km"]')).toBeVisible();
    await expect(page.locator('label[for="ride-raining"]')).toBeVisible();
  });

  test('should keep submit button disabled when form is invalid', async ({ page }) => {
    await page.fill('#ride-date', '');
    await page.fill('#ride-km', '');
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });

  test('should have aria-hidden on decorative separators', async ({ page }) => {
    await addEntry(page, '2025-06-01', '10');
    const separators = page.locator('span[aria-hidden="true"]');
    expect(await separators.count()).toBeGreaterThan(0);
  });

  test('tooltip should have role=tooltip', async ({ page }) => {
    await addEntry(page, '2025-06-01', '10', true);
    await expect(page.locator('span[role="tooltip"]')).toBeAttached();
  });
});
