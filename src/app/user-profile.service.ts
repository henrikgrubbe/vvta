import { inject, Injectable, signal } from '@angular/core';
import {
  collection,
  doc,
  Firestore,
  getDoc,
  setDoc,
} from '@angular/fire/firestore';

export interface UserProfile {
  uid: string;
  firstName: string;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private readonly firestore = inject(Firestore);
  private readonly profilesRef = collection(this.firestore, 'user-profiles');

  /** Cached profile for the signed-in user. `undefined` = not yet loaded, `null` = no profile. */
  private readonly _currentProfile = signal<UserProfile | null | undefined>(undefined);
  readonly currentProfile = this._currentProfile.asReadonly();

  setCurrentProfile(profile: UserProfile | null): void {
    this._currentProfile.set(profile);
  }

  async getProfile(uid: string): Promise<UserProfile | null> {
    const snap = await getDoc(doc(this.profilesRef, uid));
    return snap.exists() ? (snap.data() as UserProfile) : null;
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    await setDoc(doc(this.profilesRef, profile.uid), profile);
    this._currentProfile.set(profile);
  }
}

