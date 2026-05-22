import { inject, Injectable } from '@angular/core';
import {
  collection,
  collectionData,
  Firestore,
  orderBy,
  query,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { BikeEntry } from '../bike-log/bike-log';

@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  private readonly firestore = inject(Firestore);
  private readonly entriesRef = collection(this.firestore, 'bike-entries');

  /** All entries across all users, ordered by date descending. */
  readonly allEntries$: Observable<BikeEntry[]> = collectionData(
    query(this.entriesRef, orderBy('date', 'desc')),
    { idField: 'id' },
  ) as Observable<BikeEntry[]>;
}

