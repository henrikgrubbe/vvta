import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { form, FormField, min, required, submit } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { filter, switchMap, tap } from 'rxjs';

import { AuthService } from '../auth.service';
import { UserProfileService } from '../user-profile.service';
import { BikeLogService } from './bike-log.service';
import { WeatherService } from './weather.service';

export type SortField = 'date' | 'kilometers';
export type SortDirection = 'asc' | 'desc';

export interface BikeEntry {
  id: string;
  date: string;
  kilometers: number;
  raining: boolean;
  rainingSource: 'auto' | 'manual';
  userId: string;
  userName: string;
}

@Component({
  selector: 'app-bike-log',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, DatePipe, TranslateModule],
  templateUrl: './bike-log.html',
})
export class BikeLogComponent {
  private readonly weather = inject(WeatherService);
  private readonly bikeLogService = inject(BikeLogService);
  private readonly authService = inject(AuthService);
  private readonly profileService = inject(UserProfileService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('datePicker') private datePicker!: ElementRef<HTMLInputElement>;

  readonly rideModel = signal({ date: this.todayIso(), kilometers: 0, raining: false });

  readonly rideForm = form(this.rideModel, (s) => {
    required(s.date, { message: 'VALIDATION.DATE_REQUIRED' });
    required(s.kilometers, { message: 'VALIDATION.KM_REQUIRED' });
    min(s.kilometers, 0.1, { message: 'VALIDATION.KM_MIN' });
  });

  readonly currentUser = this.authService.user;
  readonly firstName = computed(() => this.profileService.currentProfile()?.firstName ?? null);
  /** ISO date string for today — used as the `max` attribute on the date input. */
  readonly today = this.todayIso();

  readonly entries = toSignal(this.bikeLogService.entries$);
  readonly loadError = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly confirmDeleteId = signal<string | null>(null);
  readonly checkingWeather = signal(false);
  readonly rainingSource = signal<'auto' | 'manual'>('auto');
  readonly saving = signal(false);

  readonly totalKilometers = computed(
    () => Math.round((this.entries() ?? []).reduce((sum, e) => sum + e.kilometers, 0) * 10) / 10,
  );

  readonly sortField = signal<SortField>('date');
  readonly sortDirection = signal<SortDirection>('desc');

  readonly sortedEntries = computed(() => {
    const field = this.sortField();
    const dir = this.sortDirection();
    return [...(this.entries() ?? [])].sort((a, b) => {
      const aVal = field === 'date' ? a.date : a.kilometers;
      const bVal = field === 'date' ? b.date : b.kilometers;
      if (aVal < bVal) return dir === 'asc' ? -1 : 1;
      if (aVal > bVal) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  });

  constructor() {
    // Set max=today on the date picker so future dates can't be selected
    afterNextRender(() => {
      this.datePicker.nativeElement.max = this.today;
    });

    // Redirect to login when the user signs out while on this page
    toObservable(this.currentUser)
      .pipe(
        filter((u) => u !== undefined),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(async (user) => {
        if (!user) {
          await this.router.navigateByUrl('/login');
        }
      });

    // Auto-check weather whenever the date changes
    toObservable(computed(() => this.rideForm.date().value()))
      .pipe(
        filter(Boolean),
        // Only auto-check if we're not currently editing an entry that was set manually
        filter(() => this.rainingSource() === 'auto'),
        tap(() => this.checkingWeather.set(true)),
        switchMap((date) => this.weather.wasRaining(date)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((raining) => {
        this.checkingWeather.set(false);
        if (raining !== null && this.rainingSource() === 'auto') {
          this.rideModel.update((m) => ({ ...m, raining }));
        }
      });
  }

  onDateChange(): void {
    this.rainingSource.set('auto');
  }

  onSubmit(): void {
    submit(this.rideForm, async () => {
      const { date, kilometers, raining } = this.rideModel();
      const currentEditId = this.editingId();
      const rainingSource = this.rainingSource();
      const user = this.currentUser();
      const userName = this.firstName() ?? 'Unknown';

      if (!user) return;

      this.saving.set(true);
      try {
        if (currentEditId !== null) {
          await this.bikeLogService.update(currentEditId, {
            date,
            kilometers,
            raining,
            rainingSource,
          });
          this.editingId.set(null);
        } else {
          await this.bikeLogService.add({
            date,
            kilometers,
            raining,
            rainingSource,
            userId: user.uid,
            userName,
          });
        }
      } finally {
        this.saving.set(false);
      }

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

  deleteEntry(id: string): void {
    if (this.editingId() === id) {
      this.cancelEdit();
    }
    this.bikeLogService.delete(id);
    this.confirmDeleteId.set(null);
  }

  requestDelete(id: string): void {
    this.confirmDeleteId.set(id);
  }

  cancelDelete(): void {
    this.confirmDeleteId.set(null);
  }

  setSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDirection.update((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      this.sortField.set(field);
      this.sortDirection.set('desc');
    }
  }

  private todayIso(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
