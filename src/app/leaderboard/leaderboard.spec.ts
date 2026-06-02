import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

import { AuthService } from '../auth.service';
import { provideTranslateTesting } from '../testing/translate-testing';
import { LeaderboardComponent } from './leaderboard';
import { LeaderboardService } from './leaderboard.service';

describe('LeaderboardComponent', () => {
  let fixture: ComponentFixture<LeaderboardComponent>;
  let component: LeaderboardComponent;
  let el: HTMLElement;
  const entriesSubject = new BehaviorSubject<unknown[]>([]);

  beforeEach(async () => {
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [LeaderboardComponent],
      providers: [
        ...provideTranslateTesting(),
        {
          provide: AuthService,
          useValue: {
            user: signal({ uid: 'u1', email: 'a@b.com' }),
          },
        },
        {
          provide: LeaderboardService,
          useValue: { allEntries$: entriesSubject.asObservable() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LeaderboardComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows empty state when there are no entries', () => {
    entriesSubject.next([]);
    fixture.detectChanges();
    expect(el.textContent).toContain('No rides logged yet. Be the first!');
  });
});
