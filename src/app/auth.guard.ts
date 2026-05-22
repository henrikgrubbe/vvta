import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';
import { UserProfileService } from './user-profile.service';

/** Requires the user to be signed in and to have a saved profile (first name). */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  const profileService = inject(UserProfileService);

  const user = await firstValueFrom(authState(auth));
  if (!user) return router.createUrlTree(['/login']);

  const profile = await profileService.getProfile(user.uid);
  if (!profile) return router.createUrlTree(['/onboarding']);

  profileService.setCurrentProfile(profile);
  return true;
};

/** Requires the user to be signed in (but profile is not required yet). */
export const signedInGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);

  const user = await firstValueFrom(authState(auth));
  return user ? true : router.createUrlTree(['/login']);
};

