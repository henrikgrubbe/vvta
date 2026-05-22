import { inject, Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  Firestore,
  query,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { catchError, Observable, of, switchMap } from 'rxjs';
import { Auth, authState } from '@angular/fire/auth';
import { BikeEntry } from './bike-log';

@Injectable({ providedIn: 'root' })
export class BikeLogService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly entriesRef = collection(this.firestore, 'bike-entries');

  /** Current user's entries. Sorted client-side; errors fall back to empty array. */
  readonly entries$: Observable<BikeEntry[]> = authState(this.auth).pipe(
    switchMap(user => {
      if (!user) return of([]);
      return (
        collectionData(
          query(this.entriesRef, where('userId', '==', user.uid)),
          { idField: 'id' },
        ) as Observable<BikeEntry[]>
      ).pipe(catchError(() => of([])));
    }),
  );

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
