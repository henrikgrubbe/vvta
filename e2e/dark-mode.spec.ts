import { expect, test } from '@playwright/test';

type Page = import('@playwright/test').Page;

const AUTH_LS_KEY = 'firebase:authUser:demo-key:[DEFAULT]';
const THEME_LS_KEY = 'theme';

const DARK_TEST_EMAIL = 'dark-test@test.com';

async function signUpUser(
  email: string,
  password: string,
): Promise<{ uid: string; idToken: string; refreshToken: string }> {
  const res = await fetch(
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
  } = (await res.json()) as {
    localId: string;
    idToken: string;
    refreshToken: string;
  };
  return { uid, idToken, refreshToken };
}

async function createUserProfile(uid: string, firstName: string, email: string): Promise<void> {
  await fetch(
    `http://127.0.0.1:8080/v1/projects/demo-vvta/databases/(default)/documents/user-profiles?documentId=${uid}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({
        fields: {
          uid: { stringValue: uid },
          firstName: { stringValue: firstName },
          email: { stringValue: email },
        },
      }),
    },
  ).catch(() => {
    /* ignore */
  });
}

async function deleteUserProfile(uid: string): Promise<void> {
  await fetch(
    `http://127.0.0.1:8080/v1/projects/demo-vvta/databases/(default)/documents/user-profiles/${uid}`,
    {
      method: 'DELETE',
      headers: { Authorization: 'Bearer owner' },
    },
  ).catch(() => {
    /* ignore */
  });
}

/** Inject Firebase auth token and an optional theme preference into localStorage before page load. */
async function injectPageState(
  page: Page,
  auth: { uid: string; email: string; idToken: string; refreshToken: string } | null,
  theme?: 'dark' | 'light' | null, // null = explicitly clear; undefined = don't touch
): Promise<void> {
  await page.addInitScript(
    ({ authKey, themeKey, authValue, themeValue }) => {
      if (authValue) localStorage.setItem(authKey, JSON.stringify(authValue));
      // 'UNSET' sentinel means caller didn't specify a preference — leave localStorage alone
      if (themeValue !== 'UNSET') {
        if (themeValue) {
          localStorage.setItem(themeKey, themeValue as string);
        } else {
          localStorage.removeItem(themeKey);
        }
      }
    },
    {
      authKey: AUTH_LS_KEY,
      themeKey: THEME_LS_KEY,
      // undefined cannot survive JSON serialisation — use a sentinel instead
      themeValue: theme !== undefined ? theme : 'UNSET',
      authValue: auth
        ? {
            uid: auth.uid,
            email: auth.email,
            emailVerified: false,
            isAnonymous: false,
            providerData: [
              {
                providerId: 'password',
                uid: auth.email,
                email: auth.email,
                displayName: null,
                photoURL: null,
                phoneNumber: null,
              },
            ],
            stsTokenManager: {
              refreshToken: auth.refreshToken,
              accessToken: auth.idToken,
              expirationTime: Date.now() + 3600 * 1000,
            },
            createdAt: String(Date.now()),
            lastLoginAt: String(Date.now()),
            apiKey: 'demo-key',
            appName: '[DEFAULT]',
          }
        : null,
    },
  );
}

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

let sharedAuth: { uid: string; email: string; idToken: string; refreshToken: string } | null = null;

test.describe('Dark mode — main app', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    const password = 'testpassword123';
    // Try to sign up; if the user already exists sign-in token may be stale — just create fresh
    const { uid, idToken, refreshToken } = await signUpUser(DARK_TEST_EMAIL, password).catch(
      async () => {
        // User may exist from a previous run — sign in instead
        const res = await fetch(
          'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: DARK_TEST_EMAIL, password, returnSecureToken: true }),
          },
        );
        const data = (await res.json()) as {
          localId: string;
          idToken: string;
          refreshToken: string;
        };
        return { uid: data.localId, idToken: data.idToken, refreshToken: data.refreshToken };
      },
    );

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
    await page.locator('a', { hasText: 'Leaderboard' }).click();
    await page.waitForURL('/leaderboard');
    await expect(page.locator('button[aria-label="Switch to dark mode"]')).toBeVisible();
  });

  test('toggle on leaderboard applies dark class', async ({ page }) => {
    await page.locator('a', { hasText: 'Leaderboard' }).click();
    await page.waitForURL('/leaderboard');
    await page.locator('button[aria-label="Switch to dark mode"]').click();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('dark mode set on bike-log persists when navigating to leaderboard', async ({ page }) => {
    await page.locator('button[aria-label="Switch to dark mode"]').click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.locator('a', { hasText: 'Leaderboard' }).click();
    await page.waitForURL('/leaderboard');
    await expect(page.locator('html')).toHaveClass(/dark/);
    // Toggle shows light_mode icon (currently dark → button offers switch to light)
    await expect(page.locator('button[aria-label="Switch to light mode"]')).toBeVisible();
  });
});
