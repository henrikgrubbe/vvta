import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../auth.service';
import { provideTranslateTesting } from '../testing/translate-testing';
import { UserProfileService } from '../user-profile.service';
import { BikeEntry, BikeLogComponent } from './bike-log';
import { BikeLogService } from './bike-log.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

let nextId = 1;

class MockBikeLogService {
  private readonly subject = new BehaviorSubject<BikeEntry[]>([]);
  readonly entries$ = this.subject.asObservable();

  reset(): void {
    this.subject.next([]);
    nextId = 1;
  }

  add(entry: Omit<BikeEntry, 'id'>): Promise<void> {
    const newEntry: BikeEntry = { ...entry, id: String(nextId++) };
    this.subject.next([newEntry, ...this.subject.value]);
    return Promise.resolve();
  }

  update(id: string, changes: Partial<Omit<BikeEntry, 'id'>>): Promise<void> {
    this.subject.next(this.subject.value.map((e) => (e.id === id ? { ...e, ...changes } : e)));
    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    this.subject.next(this.subject.value.filter((e) => e.id !== id));
    return Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('BikeLogComponent', () => {
  let fixture: ComponentFixture<BikeLogComponent>;
  let component: BikeLogComponent;
  let el: HTMLElement;
  let httpMock: HttpTestingController;
  let mockService: MockBikeLogService;

  function flushWeatherRequests(raining = false): void {
    const reqs = httpMock.match((r) => r.url.includes('open-meteo.com'));
    reqs.forEach((r) => {
      if (!r.cancelled) r.flush({ daily: { precipitation_sum: [raining ? 5.0 : 0] } });
    });
  }

  function getSubmitButton(): HTMLButtonElement {
    return el.querySelector('button[type="submit"]')!;
  }

  function getListItems(): NodeListOf<HTMLLIElement> {
    return el.querySelectorAll('ul li');
  }

  function getEditButtons(): HTMLButtonElement[] {
    return Array.from(el.querySelectorAll('button[aria-label^="Edit"]'));
  }

  function getDeleteButtons(): HTMLButtonElement[] {
    return Array.from(el.querySelectorAll('button[aria-label^="Delete ride"]'));
  }

  function getCancelButton(): HTMLButtonElement | null {
    const buttons = Array.from(el.querySelectorAll('button[type="button"]'));
    return (buttons.find((b) => b.textContent?.trim() === 'Cancel') as HTMLButtonElement) ?? null;
  }

  function entries(): BikeEntry[] {
    return component.entries() ?? [];
  }

  async function addEntry(date: string, km: number, raining = false): Promise<void> {
    component.rideModel.set({ date, kilometers: km, raining });
    component.rainingSource.set(raining ? 'manual' : 'auto');
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();
    // Re-set in case weather response overrode raining
    component.rideModel.update((m) => ({ ...m, raining }));
    component.rainingSource.set(raining ? 'manual' : 'auto');
    component.onSubmit();
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    mockService = new MockBikeLogService();
    mockService.reset();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [BikeLogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        ...provideTranslateTesting(),
        { provide: BikeLogService, useValue: mockService },
        {
          provide: AuthService,
          useValue: {
            user: signal({ uid: 'test-uid', email: 'test@test.com' }),
            signOut: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: UserProfileService,
          useValue: {
            currentProfile: signal({ uid: 'test-uid', firstName: 'Test', email: 'test@test.com' }),
            getProfile: vi.fn().mockResolvedValue(null),
            saveProfile: vi.fn().mockResolvedValue(undefined),
            setCurrentProfile: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BikeLogComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;

    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  // -------------------------------------------------------------------------
  // Initial rendering
  // -------------------------------------------------------------------------

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should display the heading', () => {
    expect(el.querySelector('h1')?.textContent).toContain('Vi viber til arbejde');
  });

  it('should show empty state message when no entries', () => {
    expect(el.textContent).toContain('No rides logged yet');
  });

  it('should default date to today', () => {
    expect(component.rideModel().date).toBe(todayIso());
  });

  it('should show "Add Entry" on the submit button', () => {
    expect(getSubmitButton().textContent?.trim()).toBe('Add Entry');
  });

  it('should have the submit button disabled initially', () => {
    expect(getSubmitButton().disabled).toBe(true);
  });

  it('should not show Cancel button when not editing', () => {
    expect(getCancelButton()).toBeFalsy();
  });

  // -------------------------------------------------------------------------
  // Adding entries
  // -------------------------------------------------------------------------

  it('should add an entry to the list', async () => {
    await addEntry('2025-06-01', 12.5);
    expect(entries().length).toBe(1);
    expect(entries()[0].date).toBe('2025-06-01');
    expect(entries()[0].kilometers).toBe(12.5);
  });

  it('should display the entry in the DOM', async () => {
    await addEntry('2025-06-01', 12.5);
    expect(getListItems().length).toBe(1);
    expect(getListItems()[0].textContent).toContain('12.5 km');
  });

  it('should prepend new entries (newest first by default)', async () => {
    await addEntry('2025-06-01', 10);
    await addEntry('2025-06-02', 15);
    expect(entries()[0].date).toBe('2025-06-02');
    expect(entries()[1].date).toBe('2025-06-01');
  });

  it('should calculate total kilometers', async () => {
    await addEntry('2025-06-01', 10);
    await addEntry('2025-06-02', 15.5);
    expect(component.totalKilometers()).toBe(25.5);
  });

  it('should reset the form after adding', async () => {
    await addEntry('2025-06-01', 12.5);
    expect(component.rideModel().kilometers).toBe(0);
  });

  it('should assign unique IDs to entries', async () => {
    await addEntry('2025-06-01', 10);
    await addEntry('2025-06-02', 15);
    const ids = entries().map((e) => e.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('should call add on the service when submitting a new entry', async () => {
    const spy = vi.spyOn(mockService, 'add');
    await addEntry('2025-06-01', 12.5);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2025-06-01', kilometers: 12.5 }),
    );
  });

  // -------------------------------------------------------------------------
  // Raining field
  // -------------------------------------------------------------------------

  it('should save raining status with entry', async () => {
    await addEntry('2025-06-01', 10, true);
    expect(entries()[0].raining).toBe(true);
  });

  it('should save rainingSource "manual" when set by user', async () => {
    await addEntry('2025-06-01', 10, true);
    expect(entries()[0].rainingSource).toBe('manual');
  });

  it('should save rainingSource "auto" when not overridden', async () => {
    await addEntry('2025-06-01', 10, false);
    expect(entries()[0].rainingSource).toBe('auto');
  });

  // -------------------------------------------------------------------------
  // Editing entries
  // -------------------------------------------------------------------------

  it('should populate the form when editing', async () => {
    await addEntry('2025-06-01', 10);
    component.startEdit(entries()[0]);
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();

    expect(component.rideModel().date).toBe('2025-06-01');
    expect(component.rideModel().kilometers).toBe(10);
  });

  it('should set editingId when editing', async () => {
    await addEntry('2025-06-01', 10);
    const entry = entries()[0];
    component.startEdit(entry);
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();

    expect(component.editingId()).toBe(entry.id);
  });

  it('should show "Update Entry" button when editing', async () => {
    await addEntry('2025-06-01', 10);
    component.startEdit(entries()[0]);
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getSubmitButton().textContent?.trim()).toBe('Update Entry');
  });

  it('should show Cancel button when editing', async () => {
    await addEntry('2025-06-01', 10);
    component.startEdit(entries()[0]);
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getCancelButton()).toBeTruthy();
  });

  it('should update the entry on submit', async () => {
    await addEntry('2025-06-01', 10);
    const entry = entries()[0];

    component.startEdit(entry);
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();

    component.rideModel.set({ date: '2025-07-01', kilometers: 20, raining: false });
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();
    component.rideModel.update((m) => ({ ...m, kilometers: 20 }));

    component.onSubmit();
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();

    const updated = entries().find((e) => e.id === entry.id);
    expect(updated?.date).toBe('2025-07-01');
    expect(updated?.kilometers).toBe(20);
    expect(entries().length).toBe(1);
  });

  it('should clear editing state after update', async () => {
    await addEntry('2025-06-01', 10);
    component.startEdit(entries()[0]);
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();

    component.rideModel.set({ date: '2025-07-01', kilometers: 20, raining: false });
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();
    component.rideModel.update((m) => ({ ...m, kilometers: 20 }));

    component.onSubmit();
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();

    expect(component.editingId()).toBeNull();
  });

  it('should call update on the service when submitting an edit', async () => {
    await addEntry('2025-06-01', 10);
    const entry = entries()[0];
    const spy = vi.spyOn(mockService, 'update');

    component.startEdit(entry);
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();

    component.rideModel.set({ date: '2025-07-01', kilometers: 20, raining: false });
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();

    component.onSubmit();
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();

    expect(spy).toHaveBeenCalledWith(entry.id, expect.any(Object));
  });

  // -------------------------------------------------------------------------
  // Cancelling edit
  // -------------------------------------------------------------------------

  it('should clear editingId on cancel', async () => {
    await addEntry('2025-06-01', 10);
    component.startEdit(entries()[0]);
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();

    component.cancelEdit();
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();

    expect(component.editingId()).toBeNull();
  });

  it('should reset form to default values on cancel', async () => {
    await addEntry('2025-06-01', 10);
    component.startEdit(entries()[0]);
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();

    component.cancelEdit();
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();

    expect(component.rideModel().kilometers).toBe(0);
    expect(component.rideModel().date).toBe(todayIso());
  });

  it('should not modify entries on cancel', async () => {
    await addEntry('2025-06-01', 10);
    const entriesBefore = [...entries()];

    component.startEdit(entries()[0]);
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();

    component.cancelEdit();
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();

    expect(entries()).toEqual(entriesBefore);
  });

  // -------------------------------------------------------------------------
  // Deleting entries
  // -------------------------------------------------------------------------

  it('should remove an entry from the list', async () => {
    await addEntry('2025-06-01', 10);
    await addEntry('2025-06-02', 15);
    const id = entries()[0].id;
    component.deleteEntry(id);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(entries().length).toBe(1);
    expect(entries().find((e) => e.id === id)).toBeUndefined();
  });

  it('should update total kilometers after deletion', async () => {
    await addEntry('2025-06-01', 10);
    await addEntry('2025-06-02', 15);
    const id = entries().find((e) => e.kilometers === 15)!.id;
    component.deleteEntry(id);
    await fixture.whenStable();

    expect(component.totalKilometers()).toBe(10);
  });

  it('should call delete on the service', async () => {
    await addEntry('2025-06-01', 10);
    const id = entries()[0].id;
    const spy = vi.spyOn(mockService, 'delete');
    component.deleteEntry(id);
    expect(spy).toHaveBeenCalledWith(id);
  });

  it('should cancel edit if deleting the entry being edited', async () => {
    await addEntry('2025-06-01', 10);
    const entry = entries()[0];

    component.startEdit(entry);
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();

    component.deleteEntry(entry.id);
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();

    expect(component.editingId()).toBeNull();
  });

  it('should show empty state after deleting all entries', async () => {
    await addEntry('2025-06-01', 10);
    component.deleteEntry(entries()[0].id);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('No rides logged yet');
  });

  it('should preserve editing state when deleting a different entry', async () => {
    await addEntry('2025-06-01', 10);
    await addEntry('2025-06-02', 15);
    const entryToEdit = entries()[1];
    const entryToDelete = entries()[0];

    component.startEdit(entryToEdit);
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();

    component.deleteEntry(entryToDelete.id);
    await fixture.whenStable();

    expect(component.editingId()).toBe(entryToEdit.id);
    expect(entries().length).toBe(1);
  });

  it('should handle deleting the only entry', async () => {
    await addEntry('2025-06-01', 10);
    component.deleteEntry(entries()[0].id);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(entries().length).toBe(0);
    expect(component.totalKilometers()).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Total kilometers
  // -------------------------------------------------------------------------

  it('should have 0 total with no entries', () => {
    expect(component.totalKilometers()).toBe(0);
  });

  it('should round total to 1 decimal place', async () => {
    await addEntry('2025-06-01', 1.15);
    await addEntry('2025-06-02', 2.25);
    expect(component.totalKilometers()).toBe(3.4);
  });

  it('should handle floating point precision in totals', async () => {
    await addEntry('2025-06-01', 0.1);
    await addEntry('2025-06-02', 0.2);
    expect(component.totalKilometers()).toBe(0.3);
  });

  // -------------------------------------------------------------------------
  // Weather auto-check
  // -------------------------------------------------------------------------

  it('should set raining to true when API reports rain', async () => {
    component.rideModel.update((m) => ({ ...m, date: '2025-03-15' }));
    await fixture.whenStable();
    httpMock
      .match((r) => r.url.includes('open-meteo.com'))
      .forEach((r) => r.flush({ daily: { precipitation_sum: [8.5] } }));
    await fixture.whenStable();

    expect(component.rideModel().raining).toBe(true);
  });

  it('should set rainingSource to auto when filled by API', async () => {
    component.rideModel.update((m) => ({ ...m, date: '2025-03-15' }));
    await fixture.whenStable();
    httpMock
      .match((r) => r.url.includes('open-meteo.com'))
      .forEach((r) => r.flush({ daily: { precipitation_sum: [3.0] } }));
    await fixture.whenStable();

    expect(component.rainingSource()).toBe('auto');
  });

  it('should set rainingSource to manual when user sets it', () => {
    component.rainingSource.set('manual');
    expect(component.rainingSource()).toBe('manual');
  });

  it('should show checking weather indicator while loading', async () => {
    component.checkingWeather.set(true);
    fixture.detectChanges();
    expect(el.textContent).toContain('Checking weather');
  });

  it('should not show checking weather indicator when not loading', () => {
    expect(el.textContent).not.toContain('Checking weather');
  });

  // -------------------------------------------------------------------------
  // DOM rendering
  // -------------------------------------------------------------------------

  it('should show edit and delete buttons for each entry', async () => {
    await addEntry('2025-06-01', 10);
    await addEntry('2025-06-02', 15);
    expect(getEditButtons().length).toBe(2);
    expect(getDeleteButtons().length).toBe(2);
  });

  it('should show total kilometers in the DOM', async () => {
    await addEntry('2025-06-01', 10);
    await addEntry('2025-06-02', 15);
    expect(el.textContent).toContain('25 km');
  });

  it('should display rain emoji for rainy entries', async () => {
    await addEntry('2025-06-01', 10, true);
    expect(getListItems()[0].textContent).toContain('🌧');
  });

  it('should not show rain emoji for non-rainy entries', async () => {
    await addEntry('2025-06-01', 10, false);
    expect(getListItems()[0].textContent).not.toContain('🌧');
  });

  it('should have accessible aria-labels on edit/delete buttons', async () => {
    await addEntry('2025-06-01', 10);
    expect(getEditButtons()[0].getAttribute('aria-label')).toContain('Edit ride on');
    expect(getDeleteButtons()[0].getAttribute('aria-label')).toContain('Delete ride on');
  });

  it('should have an accessible list label', async () => {
    await addEntry('2025-06-01', 10);
    expect(el.querySelector('ul')?.getAttribute('aria-label')).toBe('Logged bike rides');
  });

  it('should show tooltip "Detected by weather data" for auto-rainy entries', async () => {
    component.rideModel.set({ date: '2025-06-01', kilometers: 10, raining: true });
    component.rainingSource.set('auto');
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();
    component.rideModel.update((m) => ({ ...m, raining: true }));
    component.rainingSource.set('auto');
    component.onSubmit();
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();
    fixture.detectChanges();

    const tooltip = getListItems()[0].querySelector('span[role="tooltip"]');
    expect(tooltip?.textContent?.trim()).toBe('Detected by weather data');
  });

  it('should show tooltip "Set manually" for manually-set rainy entries', async () => {
    await addEntry('2025-06-01', 10, true);
    const tooltip = getListItems()[0].querySelector('span[role="tooltip"]');
    expect(tooltip?.textContent?.trim()).toBe('Set manually');
  });

  // -------------------------------------------------------------------------
  // Form validation / edge cases
  // -------------------------------------------------------------------------

  it('should not add entry when form is invalid (km = 0)', async () => {
    component.rideModel.set({ date: todayIso(), kilometers: 0, raining: false });
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();
    component.onSubmit();
    await fixture.whenStable();

    expect(entries().length).toBe(0);
  });

  it('should not add entry when date is empty', async () => {
    component.rideModel.set({ date: '', kilometers: 10, raining: false });
    await fixture.whenStable();
    component.onSubmit();
    await fixture.whenStable();

    expect(entries().length).toBe(0);
  });

  it('should reset date to today after successful submission', async () => {
    await addEntry('2025-06-15', 10);
    expect(component.rideModel().date).toBe(todayIso());
  });

  it('should reset raining to false after submission', async () => {
    await addEntry('2025-06-01', 10, true);
    expect(component.rideModel().raining).toBe(false);
  });

  it('should display multiple entries correctly', async () => {
    await addEntry('2025-06-01', 10);
    await addEntry('2025-06-02', 20);
    await addEntry('2025-06-03', 30);
    expect(getListItems().length).toBe(3);
    expect(component.totalKilometers()).toBe(60);
  });

  it('should handle editing then adding a new entry', async () => {
    await addEntry('2025-06-01', 10);
    component.startEdit(entries()[0]);
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();

    component.cancelEdit();
    await fixture.whenStable();
    flushWeatherRequests();
    await fixture.whenStable();

    await addEntry('2025-06-02', 20);
    expect(entries().length).toBe(2);
    expect(component.editingId()).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Sorting
  // -------------------------------------------------------------------------

  it('should default sort field to date', () => {
    expect(component.sortField()).toBe('date');
  });

  it('should default sort direction to desc', () => {
    expect(component.sortDirection()).toBe('desc');
  });

  it('should sort by date descending by default', async () => {
    await addEntry('2025-06-01', 10);
    await addEntry('2025-06-03', 30);
    await addEntry('2025-06-02', 20);
    const sorted = component.sortedEntries();
    expect(sorted[0].date).toBe('2025-06-03');
    expect(sorted[1].date).toBe('2025-06-02');
    expect(sorted[2].date).toBe('2025-06-01');
  });

  it('should sort by date ascending when toggled', async () => {
    await addEntry('2025-06-01', 10);
    await addEntry('2025-06-03', 30);
    await addEntry('2025-06-02', 20);
    component.setSort('date');
    const sorted = component.sortedEntries();
    expect(sorted[0].date).toBe('2025-06-01');
    expect(sorted[2].date).toBe('2025-06-03');
  });

  it('should sort by kilometers descending when switching to distance', async () => {
    await addEntry('2025-06-01', 10);
    await addEntry('2025-06-02', 30);
    await addEntry('2025-06-03', 20);
    component.setSort('kilometers');
    const sorted = component.sortedEntries();
    expect(sorted[0].kilometers).toBe(30);
    expect(sorted[2].kilometers).toBe(10);
  });

  it('should sort by kilometers ascending when toggled twice', async () => {
    await addEntry('2025-06-01', 10);
    await addEntry('2025-06-02', 30);
    await addEntry('2025-06-03', 20);
    component.setSort('kilometers');
    component.setSort('kilometers');
    const sorted = component.sortedEntries();
    expect(sorted[0].kilometers).toBe(10);
    expect(sorted[2].kilometers).toBe(30);
  });

  it('should reset direction to desc when switching between fields', async () => {
    await addEntry('2025-06-01', 10);
    component.setSort('date');
    component.setSort('kilometers');
    expect(component.sortDirection()).toBe('desc');
  });

  it('should toggle direction when clicking the active sort field', () => {
    component.setSort('date');
    expect(component.sortDirection()).toBe('asc');
    component.setSort('date');
    expect(component.sortDirection()).toBe('desc');
  });

  it('should show sort buttons in the DOM when entries exist', async () => {
    await addEntry('2025-06-01', 10);
    expect(el.querySelector('[aria-label="Sort rides by"]')).toBeTruthy();
  });

  it('should not show sort controls when list is empty', () => {
    expect(el.querySelector('[aria-label="Sort rides by"]')).toBeFalsy();
  });

  it('should mark the active sort button as aria-pressed=true', async () => {
    await addEntry('2025-06-01', 10);
    const buttons = Array.from(el.querySelectorAll('[aria-label="Sort rides by"] button'));
    const dateBtn = buttons.find((b) => b.textContent?.includes('Date'));
    const distBtn = buttons.find((b) => b.textContent?.includes('Distance'));
    expect(dateBtn?.getAttribute('aria-pressed')).toBe('true');
    expect(distBtn?.getAttribute('aria-pressed')).toBe('false');
  });

  it('should update aria-pressed when switching sort field', async () => {
    await addEntry('2025-06-01', 10);
    component.setSort('kilometers');
    fixture.detectChanges();
    const buttons = Array.from(el.querySelectorAll('[aria-label="Sort rides by"] button'));
    const dateBtn = buttons.find((b) => b.textContent?.includes('Date'));
    const distBtn = buttons.find((b) => b.textContent?.includes('Distance'));
    expect(dateBtn?.getAttribute('aria-pressed')).toBe('false');
    expect(distBtn?.getAttribute('aria-pressed')).toBe('true');
  });

  it('should show a direction arrow only on the active sort button', async () => {
    await addEntry('2025-06-01', 10);
    component.setSort('kilometers');
    fixture.detectChanges();
    const buttons = Array.from(el.querySelectorAll('[aria-label="Sort rides by"] button'));
    const dateBtn = buttons.find((b) => b.textContent?.includes('Date'))!;
    const distBtn = buttons.find((b) => b.textContent?.includes('Distance'))!;
    expect(dateBtn.textContent).not.toMatch(/[↑↓]/);
    expect(distBtn.textContent).toMatch(/[↑↓]/);
  });
});
