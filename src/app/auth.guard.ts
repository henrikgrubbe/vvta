import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { UserProfileService } from './user-profile.service';

/** Helper to get current auth user as a Promise */
function getCurrentUser(): Promise<{ uid: string } | null> {
  return new Promise((resolve, reject) => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(
      auth,
      user => {
        unsubscribe();
        resolve(user ? { uid: user.uid } : null);
      },
      reject
    );
  });
}

/** Requires the user to be signed in and to have a saved profile (first name). */
export const authGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const profileService = inject(UserProfileService);

  const user = await getCurrentUser();
  if (!user) return router.createUrlTree(['/login']);

  const profile = await profileService.getProfile(user.uid);
  if (!profile) return router.createUrlTree(['/onboarding']);

  profileService.setCurrentProfile(profile);
  return true;
};

/** Requires the user to be signed in (but profile is not required yet). */
export const signedInGuard: CanActivateFn = async () => {
  const router = inject(Router);

  const user = await getCurrentUser();
  return user ? true : router.createUrlTree(['/login']);
};

