import { Injectable } from '@angular/core';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { catchError, Observable, of } from 'rxjs';

import { BikeEntry } from './bike-log';

@Injectable({ providedIn: 'root' })
export class BikeLogService {
  private readonly firestore = getFirestore();
  private readonly auth = getAuth();
  private readonly entriesRef = collection(this.firestore, 'bike-entries');

  /** Current user's entries. Sorted client-side; errors fall back to empty array. */
  readonly entries$ = this.createEntriesObservable();

  private createEntriesObservable(): Observable<BikeEntry[]> {
    return new Observable<BikeEntry[]>((subscriber) => {
      let unsubscribeSnapshot: (() => void) | null = null;

      const unsubscribeAuth = onAuthStateChanged(
        this.auth,
        (user) => {
          // Clean up previous snapshot listener if it exists
          if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
          }

          if (!user) {
            subscriber.next([]);
            return;
          }

          try {
            unsubscribeSnapshot = onSnapshot(
              query(this.entriesRef, where('userId', '==', user.uid)),
              (snapshot) => {
                const entries = snapshot.docs.map((d) => ({
                  id: d.id,
                  ...d.data(),
                })) as BikeEntry[];
                subscriber.next(entries);
              },
            );
          } catch (error) {
            subscriber.error(error);
          }
        },
        (error) => {
          if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
          }
          subscriber.error(error);
        },
      );

      return () => {
        unsubscribeAuth();
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
        }
      };
    }).pipe(catchError(() => of([])));
  }

  add(entry: Omit<BikeEntry, 'id'>): Promise<void> {
    return addDoc(this.entriesRef, entry).then(() => undefined);
  }

  update(id: string, changes: Partial<Omit<BikeEntry, 'id'>>): Promise<void> {
    return updateDoc(doc(this.firestore, 'bike-entries', id), changes);
  }

  delete(id: string): Promise<void> {
    return deleteDoc(doc(this.firestore, 'bike-entries', id));
  }
}
