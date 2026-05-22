import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { form, FormField, submit, required, min } from '@angular/forms/signals';
import { DatePipe } from '@angular/common';
import { filter, switchMap, tap } from 'rxjs';
import { WeatherService } from '../weather.service';

export type SortField = 'date' | 'kilometers';
export type SortDirection = 'asc' | 'desc';

export interface BikeEntry {
  id: number;
  date: string;
  kilometers: number;
  raining: boolean;
  rainingSource: 'auto' | 'manual';
}

@Component({
  selector: 'app-bike-log',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, DatePipe],
  template: `
    <div class="max-w-lg mx-auto p-6">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">🚴 Rune's Bike Commute Log</h1>
      <p class="text-gray-600 mb-6">Track your daily bicycle commute to work.</p>

      <form (submit)="onSubmit(); $event.preventDefault()" class="mb-8 space-y-4">
        <div>
          <label for="ride-date" class="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input
            #datePicker
            id="ride-date"
            type="date"
            [formField]="rideForm.date"
            (click)="datePicker.showPicker()"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 cursor-pointer focus:outline-2 focus:outline-blue-500"
          />
          @if (rideForm.date().touched() && rideForm.date().errors().length) {
            <p class="text-red-600 text-sm mt-1" role="alert">
              {{ rideForm.date().errors()[0].message }}
            </p>
          }
        </div>

        <div>
          <label for="ride-km" class="block text-sm font-medium text-gray-700 mb-1">
            Kilometers driven
          </label>
          <input
            id="ride-km"
            type="number"
            step="0.1"
            placeholder="e.g. 12.5"
            [formField]="rideForm.kilometers"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-2 focus:outline-blue-500"
          />
          @if (rideForm.kilometers().touched() && rideForm.kilometers().errors().length) {
            <p class="text-red-600 text-sm mt-1" role="alert">
              {{ rideForm.kilometers().errors()[0].message }}
            </p>
          }
        </div>

        <div class="flex items-center gap-2">
          <input
            id="ride-raining"
            type="checkbox"
            [formField]="rideForm.raining"
            (click)="rainingSource.set('manual')"
            class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:outline-2 focus:outline-offset-2 focus:outline-blue-500"
          />
          <label for="ride-raining" class="text-sm font-medium text-gray-700">
            🌧️ It was raining
          </label>
          @if (checkingWeather()) {
            <span class="text-xs text-gray-400 italic">Checking weather…</span>
          }
        </div>

        <button
          type="submit"
          [disabled]="rideForm().invalid()"
          class="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-2 focus:outline-offset-2 focus:outline-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ editingId() !== null ? 'Update Entry' : 'Add Entry' }}
        </button>

        @if (editingId() !== null) {
          <button
            type="button"
            (click)="cancelEdit()"
            class="w-full border border-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-100 focus:outline-2 focus:outline-offset-2 focus:outline-blue-500"
          >
            Cancel
          </button>
        }
      </form>

      @if (entries().length > 0) {
        <div class="mb-3 flex justify-between items-center">
          <h2 class="text-xl font-semibold text-gray-900">Logged Rides</h2>
          <p class="text-sm text-gray-600">
            Total: <strong>{{ totalKilometers() }} km</strong>
          </p>
        </div>

        <div class="mb-3 flex items-center gap-1" role="group" aria-label="Sort rides by">
          <span class="text-xs text-gray-500 mr-1">Sort:</span>
          <button
            type="button"
            (click)="setSort('date')"
            [class]="sortField() === 'date'
              ? 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-300 focus:outline-2 focus:outline-offset-2 focus:outline-blue-500'
              : 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 focus:outline-2 focus:outline-offset-2 focus:outline-blue-500'"
            [attr.aria-pressed]="sortField() === 'date'"
            [attr.aria-label]="'Sort by date ' + (sortField() === 'date' ? (sortDirection() === 'desc' ? 'newest first' : 'oldest first') : '')"
          >
            Date
            @if (sortField() === 'date') {
              <span aria-hidden="true">{{ sortDirection() === 'desc' ? '↓' : '↑' }}</span>
            }
          </button>
          <button
            type="button"
            (click)="setSort('kilometers')"
            [class]="sortField() === 'kilometers'
              ? 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-300 focus:outline-2 focus:outline-offset-2 focus:outline-blue-500'
              : 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 focus:outline-2 focus:outline-offset-2 focus:outline-blue-500'"
            [attr.aria-pressed]="sortField() === 'kilometers'"
            [attr.aria-label]="'Sort by distance ' + (sortField() === 'kilometers' ? (sortDirection() === 'desc' ? 'longest first' : 'shortest first') : '')"
          >
            Distance
            @if (sortField() === 'kilometers') {
              <span aria-hidden="true">{{ sortDirection() === 'desc' ? '↓' : '↑' }}</span>
            }
          </button>
        </div>

        <ul class="space-y-2" aria-label="Logged bike rides">
          @for (entry of sortedEntries(); track entry.id) {
            <li class="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-200 gap-2">
              <div class="flex-1 min-w-0">
                <span class="text-gray-700">{{ entry.date | date:'mediumDate' }}</span>
                <span class="mx-2 text-gray-400" aria-hidden="true">·</span>
                <span class="font-semibold text-gray-900">{{ entry.kilometers }} km</span>
                @if (entry.raining) {
                  <span class="mx-2 text-gray-400" aria-hidden="true">·</span>
                  <span class="relative group cursor-default">
                    🌧️
                    <span
                      class="pointer-events-none invisible absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:visible"
                      role="tooltip"
                    >
                      {{ entry.rainingSource === 'auto' ? 'Detected by weather data' : 'Set manually' }}
                    </span>
                  </span>
                }
              </div>
              <div class="flex gap-1 shrink-0">
                <button
                  type="button"
                  (click)="startEdit(entry)"
                  class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg focus:outline-2 focus:outline-offset-2 focus:outline-blue-500"
                  [attr.aria-label]="'Edit ride on ' + entry.date"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  (click)="deleteEntry(entry.id)"
                  class="p-2 text-red-600 hover:bg-red-50 rounded-lg focus:outline-2 focus:outline-offset-2 focus:outline-red-500"
                  [attr.aria-label]="'Delete ride on ' + entry.date"
                >
                  🗑️
                </button>
              </div>
            </li>
          }
        </ul>
      } @else {
        <p class="text-center text-gray-500 py-8">No rides logged yet. Start tracking!</p>
      }
    </div>
  `,
})
export class BikeLogComponent {
  private nextId = 1;
  private readonly weather = inject(WeatherService);
  private readonly destroyRef = inject(DestroyRef);

  readonly rideModel = signal({ date: this.todayIso(), kilometers: 0, raining: false });

  readonly rideForm = form(this.rideModel, (s) => {
    required(s.date, { message: 'Date is required' });
    required(s.kilometers, { message: 'Kilometers is required' });
    min(s.kilometers, 0.1, { message: 'Must be at least 0.1 km' });
  });

  readonly entries = signal<BikeEntry[]>(this.loadEntries());
  readonly editingId = signal<number | null>(null);
  readonly checkingWeather = signal(false);
  readonly rainingSource = signal<'auto' | 'manual'>('auto');

  readonly totalKilometers = computed(() =>
    Math.round(this.entries().reduce((sum, e) => sum + e.kilometers, 0) * 10) / 10
  );

  readonly sortField = signal<SortField>('date');
  readonly sortDirection = signal<SortDirection>('desc');

  readonly sortedEntries = computed(() => {
    const field = this.sortField();
    const dir = this.sortDirection();
    return [...this.entries()].sort((a, b) => {
      const aVal = field === 'date' ? a.date : a.kilometers;
      const bVal = field === 'date' ? b.date : b.kilometers;
      if (aVal < bVal) return dir === 'asc' ? -1 : 1;
      if (aVal > bVal) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  });

  constructor() {
    const maxId = this.entries().reduce((max, e) => Math.max(max, e.id), 0);
    this.nextId = maxId + 1;

    // Auto-check weather whenever the date changes
    toObservable(computed(() => this.rideForm.date().value()))
      .pipe(
        filter(Boolean),
        tap(() => this.checkingWeather.set(true)),
        switchMap(date => this.weather.wasRaining(date)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(raining => {
        this.checkingWeather.set(false);
        if (raining !== null) {
          this.rainingSource.set('auto');
          this.rideModel.update(m => ({ ...m, raining }));
        }
      });
  }

  onSubmit(): void {
    submit(this.rideForm, async () => {
      const { date, kilometers, raining } = this.rideModel();
      const currentEditId = this.editingId();
      const rainingSource = this.rainingSource();

      if (currentEditId !== null) {
        this.entries.update(list =>
          list.map(e => e.id === currentEditId ? { ...e, date, kilometers, raining, rainingSource } : e)
        );
        this.editingId.set(null);
      } else {
        this.entries.update(list => [{ id: this.nextId++, date, kilometers, raining, rainingSource }, ...list]);
      }

      this.saveEntries();
      this.rideModel.set({ date: this.todayIso(), kilometers: 0, raining: false });
      this.rideForm().reset();
    });
  }

  startEdit(entry: BikeEntry): void {
    this.editingId.set(entry.id);
    this.rideForm().reset();
    this.rainingSource.set(entry.rainingSource ?? 'manual');
    this.rideModel.set({ date: entry.date, kilometers: entry.kilometers, raining: entry.raining });
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.rainingSource.set('auto');
    this.rideModel.set({ date: this.todayIso(), kilometers: 0, raining: false });
    this.rideForm().reset();
  }


  private todayIso(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  deleteEntry(id: number): void {
    this.entries.update(list => list.filter(e => e.id !== id));
    if (this.editingId() === id) {
      this.cancelEdit();
    }
    this.saveEntries();
  }

  private saveEntries(): void {
    localStorage.setItem('bike-log-entries', JSON.stringify(this.entries()));
  }

  private loadEntries(): BikeEntry[] {
    try {
      const raw = localStorage.getItem('bike-log-entries');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  setSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDirection.update(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      this.sortField.set(field);
      this.sortDirection.set('desc');
    }
  }
}
