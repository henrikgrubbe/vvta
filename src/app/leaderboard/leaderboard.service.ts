import { Injectable } from '@angular/core';
import { collection, getFirestore, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Observable } from 'rxjs';

import { BikeEntry } from '../bike-log/bike-log';

@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  private readonly firestore = getFirestore();
  private readonly entriesRef = collection(this.firestore, 'bike-entries');

  /** All entries across all users, ordered by date descending. */
  readonly allEntries$: Observable<BikeEntry[]> = new Observable<BikeEntry[]>((subscriber) => {
    const unsubscribe = onSnapshot(
      query(this.entriesRef, orderBy('date', 'desc')),
      (snapshot) => {
        const entries = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as BikeEntry[];
        subscriber.next(entries);
      },
      (error) => {
        subscriber.error(error);
      },
    );
    return () => unsubscribe();
  });
}
