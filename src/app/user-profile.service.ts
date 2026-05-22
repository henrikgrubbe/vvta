import { inject, Injectable } from '@angular/core';
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

  async getProfile(uid: string): Promise<UserProfile | null> {
    const snap = await getDoc(doc(this.profilesRef, uid));
    return snap.exists() ? (snap.data() as UserProfile) : null;
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    await setDoc(doc(this.profilesRef, profile.uid), profile);
  }
}

