import { inject, Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  Firestore,
  orderBy,
  query,
  updateDoc,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { BikeEntry } from './bike-log';

@Injectable({ providedIn: 'root' })
export class BikeLogService {
  private readonly firestore = inject(Firestore);
  private readonly entriesRef = collection(this.firestore, 'bike-entries');

  readonly entries$: Observable<BikeEntry[]> = collectionData(
    query(this.entriesRef, orderBy('date', 'desc')),
    { idField: 'id' },
  ) as Observable<BikeEntry[]>;

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
