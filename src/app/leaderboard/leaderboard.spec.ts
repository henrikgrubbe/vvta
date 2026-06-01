import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../auth.service';
import { provideTranslateTesting } from '../testing/translate-testing';
import { LeaderboardComponent } from './leaderboard';
import { LeaderboardService } from './leaderboard.service';

describe('LeaderboardComponent', () => {
  let fixture: ComponentFixture<LeaderboardComponent>;
  let component: LeaderboardComponent;
  let el: HTMLElement;
  const mockSignOut = vi.fn().mockResolvedValue(undefined);
  const entriesSubject = new BehaviorSubject<unknown[]>([]);

  beforeEach(async () => {
    mockSignOut.mockClear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [LeaderboardComponent],
      providers: [
        provideRouter([{ path: 'login', redirectTo: '' }]),
        ...provideTranslateTesting(),
        {
          provide: AuthService,
          useValue: {
            user: signal({ uid: 'u1', email: 'a@b.com' }),
            signOut: mockSignOut,
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

  it('should render a sign-out button', () => {
    const buttons = Array.from(el.querySelectorAll('button'));
    const signOut = buttons.find((b) => b.textContent?.includes('Sign out'));
    expect(signOut).toBeTruthy();
  });

  it('should call authService.signOut and navigate to /login on sign-out', async () => {
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await component.signOut();

    expect(mockSignOut).toHaveBeenCalledOnce();
    expect(navSpy).toHaveBeenCalledWith('/login');
  });
});
