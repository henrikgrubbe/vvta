import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Auth,
  authState,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from '@angular/fire/auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);

  /** Emits `null` when signed out, `User` when signed in, `undefined` while loading. */
  readonly user = toSignal(authState(this.auth));

  signInWithGoogle(): Promise<User> {
    return signInWithPopup(this.auth, new GoogleAuthProvider()).then(r => r.user);
  }

  signOut(): Promise<void> {
    return signOut(this.auth);
  }
}

