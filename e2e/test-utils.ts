import type { Page } from '@playwright/test';

// ============================================================================
// Emulator base URLs
// ============================================================================

export const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';
export const FIRESTORE_EMULATOR_URL = 'http://127.0.0.1:8080';
export const FIRESTORE_PROJECT = 'demo-vvta';
export const FIREBASE_API_KEY = 'demo-key';

const FIRESTORE_BASE = `${FIRESTORE_EMULATOR_URL}/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents`;

// ============================================================================
// Auth types
// ============================================================================

export interface AuthState {
  uid: string;
  email: string;
  idToken: string;
  refreshToken: string;
}

// ============================================================================
// Auth emulator helpers
// ============================================================================

/** Sign up a new user via the Auth emulator. */
export async function signUpUser(email: string, password: string): Promise<AuthState> {
  const res = await fetch(
    `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
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
  return { uid, email, idToken, refreshToken };
}

/** Sign in an existing user via the Auth emulator. */
export async function signInUser(email: string, password: string): Promise<AuthState> {
  const res = await fetch(
    `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
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
  return { uid, email, idToken, refreshToken };
}

/** Sign up, falling back to sign-in if the user already exists. */
export async function signUpOrSignIn(email: string, password: string): Promise<AuthState> {
  return signUpUser(email, password).catch(() => signInUser(email, password));
}

// ============================================================================
// Firestore emulator helpers
// ============================================================================

/** Create a user-profile document in the emulator. */
export async function createUserProfile(
  uid: string,
  firstName: string,
  email: string,
): Promise<void> {
  await fetch(`${FIRESTORE_BASE}/user-profiles?documentId=${uid}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({
      fields: {
        uid: { stringValue: uid },
        firstName: { stringValue: firstName },
        email: { stringValue: email },
      },
    }),
  }).catch(() => {
    /* ignore */
  });
}

/** Delete a user-profile document from the emulator. */
export async function deleteUserProfile(uid: string): Promise<void> {
  await fetch(`${FIRESTORE_BASE}/user-profiles/${uid}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer owner' },
  }).catch(() => {
    /* ignore */
  });
}

/** Seed bike-entries for a user via the Firestore emulator REST API. */
export async function seedEntries(
  uid: string,
  userName: string,
  entries: { date: string; kilometers: number; raining?: boolean }[],
): Promise<void> {
  await Promise.all(
    entries.map((e) =>
      fetch(`${FIRESTORE_BASE}/bike-entries`, {
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
      }).catch(() => {
        /* ignore */
      }),
    ),
  );
}

/** Delete all bike-entries for a user via the Firestore emulator REST API. */
export async function wipeUserEntries(uid: string): Promise<void> {
  const queryRes = await fetch(
    `${FIRESTORE_EMULATOR_URL}/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents:runQuery`,
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
        fetch(`${FIRESTORE_EMULATOR_URL}/v1/${r.document!.name!}`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer owner' },
        }).catch(() => {
          /* ignore */
        }),
      ),
  );
}

// ============================================================================
// Page helpers
// ============================================================================

const AUTH_LS_KEY = `firebase:authUser:${FIREBASE_API_KEY}:[DEFAULT]`;

function buildAuthLsValue(auth: AuthState) {
  return {
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
    apiKey: FIREBASE_API_KEY,
    appName: '[DEFAULT]',
  };
}

/**
 * Inject Firebase auth state into localStorage before page scripts run.
 * Must be called before `page.goto()`.
 */
export async function injectAuthState(page: Page, auth: AuthState): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    { key: AUTH_LS_KEY, value: buildAuthLsValue(auth) },
  );
}

const THEME_LS_KEY = 'theme';

/**
 * Inject Firebase auth and an optional theme preference into localStorage before page load.
 * - `auth`: pass null for unauthenticated pages
 * - `theme`: 'dark'/'light' sets preference; null explicitly clears it; undefined leaves it untouched
 *
 * Must be called before `page.goto()`.
 */
export async function injectPageState(
  page: Page,
  auth: AuthState | null,
  theme?: 'dark' | 'light' | null,
): Promise<void> {
  await page.addInitScript(
    ({ authKey, themeKey, authValue, themeValue }) => {
      if (authValue) localStorage.setItem(authKey, JSON.stringify(authValue));
      // 'UNSET' sentinel = caller didn't specify — leave localStorage alone
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
      // undefined cannot survive JSON serialisation — use sentinel
      themeValue: theme !== undefined ? theme : 'UNSET',
      authValue: auth ? buildAuthLsValue(auth) : null,
    },
  );
}
