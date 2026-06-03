import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { BikeEntry } from '../bike-log/bike-log';
import { BikeLogService } from '../bike-log/bike-log.service';
import { provideTranslateTesting } from '../testing/translate-testing';
import { UserProfileService } from '../user-profile.service';
import { OverviewComponent } from './overview';

class MockBikeLogService {
  private readonly subject = new BehaviorSubject<BikeEntry[]>([]);
  readonly entries$ = this.subject.asObservable();

  setEntries(entries: BikeEntry[]): void {
    this.subject.next(entries);
  }
}

describe('OverviewComponent', () => {
  let fixture: ComponentFixture<OverviewComponent>;
  let el: HTMLElement;
  let mockBikeLogService: MockBikeLogService;

  beforeEach(async () => {
    mockBikeLogService = new MockBikeLogService();

    await TestBed.configureTestingModule({
      imports: [OverviewComponent],
      providers: [
        provideRouter([]),
        ...provideTranslateTesting(),
        { provide: BikeLogService, useValue: mockBikeLogService },
        {
          provide: UserProfileService,
          useValue: {
            currentProfile: signal({ uid: 'uid', firstName: 'Anders', email: 'a@test.com' }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OverviewComponent);
    el = fixture.nativeElement;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders a greeting with the user name', () => {
    expect(el.textContent).toContain('Anders');
  });

  it('renders navigation links to /rides and /leaderboard', () => {
    const links: NodeListOf<HTMLAnchorElement> = el.querySelectorAll('a[routerLink]');
    const hrefs = Array.from(links).map(
      (a) => a.getAttribute('routerLink') ?? a.getAttribute('ng-reflect-router-link'),
    );
    expect(hrefs.some((h) => h?.includes('rides'))).toBe(true);
    expect(hrefs.some((h) => h?.includes('leaderboard'))).toBe(true);
  });

  it('shows stats when entries are present', async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    mockBikeLogService.setEntries([
      {
        id: '1',
        date: `${currentMonth}-01`,
        kilometers: 12,
        raining: false,
        rainingSource: 'auto',
        userId: 'uid',
        userName: 'Anders',
      },
      {
        id: '2',
        date: `${currentMonth}-02`,
        kilometers: 8,
        raining: true,
        rainingSource: 'auto',
        userId: 'uid',
        userName: 'Anders',
      },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('20');
    expect(el.textContent).toContain('2');
  });

  it('hides stats section when no entries exist', async () => {
    mockBikeLogService.setEntries([]);
    await fixture.whenStable();
    fixture.detectChanges();

    const statSection = el.querySelector('section');
    expect(statSection).toBeNull();
  });
});
