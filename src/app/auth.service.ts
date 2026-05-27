import { Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = getAuth();

  /** Emits `null` when signed out, `User` when signed in, `undefined` while loading. */
  readonly user = toSignal(this.userState$());

  private userState$(): Observable<User | null> {
    return new Observable((subscriber) => {
      const unsubscribe = onAuthStateChanged(
        this.auth,
        (user) => {
          subscriber.next(user);
        },
        (error) => {
          subscriber.error(error);
        },
      );
      return () => unsubscribe();
    });
  }

  signInWithGoogle(): Promise<User> {
    return signInWithPopup(this.auth, new GoogleAuthProvider()).then((r) => r.user);
  }

  signOut(): Promise<void> {
    return signOut(this.auth);
  }
}
